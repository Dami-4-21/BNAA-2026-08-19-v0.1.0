import { Buffer } from "node:buffer";

import type { PoolClient } from "pg";
import { v5 as uuidv5 } from "uuid";

import {
  getPilotDocumentHubSeedByLegacyId,
  type PilotDocumentSeed,
  type PilotDocumentVersionSeed,
} from "@/bootstrap/pilot-document-hub-catalog";
import { pilotProjects, pilotUsers } from "@/bootstrap/pilot-catalog";

const DOCUMENT_NAMESPACE = "1e590010-a26b-41df-a79f-f3cf3972fc82";

type TenantUserRecord = {
  email: string;
  id: string;
  role: string;
};

const projectSeedByBackendId = new Map(
  pilotProjects.map((project) => [project.backendId, project]),
);

export async function seedPilotDocumentHubData(
  client: PoolClient,
  projectBackendId: string,
  projectId: string,
  tenantUsers: TenantUserRecord[],
) {
  const projectSeed = projectSeedByBackendId.get(projectBackendId);
  if (!projectSeed) {
    return;
  }

  const hubSeed = getPilotDocumentHubSeedByLegacyId(projectSeed.legacyId);
  if (!hubSeed) {
    return;
  }

  const tenantUserByEmail = new Map(
    tenantUsers.map((user) => [normalizeValue(user.email), user]),
  );
  const fallbackUserId = tenantUserByEmail.get("admin@bnaa.com")?.id ?? tenantUsers[0]?.id;

  if (!fallbackUserId) {
    return;
  }

  for (const document of hubSeed.documents) {
    await ensureSeededDocument(client, projectId, tenantUserByEmail, fallbackUserId, document);
  }
}

async function ensureSeededDocument(
  client: PoolClient,
  projectId: string,
  tenantUserByEmail: Map<string, TenantUserRecord>,
  fallbackUserId: string,
  seed: PilotDocumentSeed,
) {
  const existingDocument = await client.query<{ id: string }>(
    `SELECT id
     FROM documents
     WHERE project_id = $1
       AND code = $2
     LIMIT 1`,
    [projectId, seed.code],
  );

  const documentId =
    existingDocument.rows[0]?.id ??
    uuidv5(`pilot-document:${projectId}:${seed.code}`, DOCUMENT_NAMESPACE);
  const createdBy =
    resolveTenantUserId(seed.recipients[0]?.email, tenantUserByEmail) ?? fallbackUserId;

  if (!existingDocument.rowCount) {
    await client.query(
      `INSERT INTO documents (
        id,
        project_id,
        name,
        code,
        lot,
        discipline,
        zone,
        phase,
        doc_type,
        source_module,
        source_record_id,
        hub_type,
        priority,
        visibility_scope,
        offline_ready,
        last_distributed_at,
        storage_mode,
        status,
        created_by,
        created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        CAST($8 AS text)::tenant_template."DocumentPhase",
        CAST($9 AS text)::tenant_template."DocumentType",
        $10, $11, $12, $13, $14::jsonb, $15, $16, $17,
        CAST($18 AS text)::tenant_template."DocumentStatus",
        $19, $20
      )`,
      [
        documentId,
        projectId,
        seed.title,
        seed.code,
        seed.lot,
        seed.discipline,
        seed.zone ?? null,
        seed.phase,
        mapHubTypeToDocType(seed.hubType),
        seed.sourceModule,
        seed.sourceRecordId ?? null,
        seed.hubType,
        seed.priority,
        JSON.stringify(seed.visibilityScope),
        seed.offlineReady,
        seed.recipients.length > 0 ? seed.publishedAt : null,
        seed.storageMode ?? "managed",
        seed.status === "Obsolete" ? "obsolete" : "active",
        createdBy,
        `${seed.publishedAt}T08:00:00.000Z`,
      ],
    );
  }

  for (const version of seed.versions) {
    await ensureSeededDocumentVersion(
      client,
      documentId,
      tenantUserByEmail,
      fallbackUserId,
      seed,
      version,
      version.version === seed.revision,
    );
  }

  const currentVersion = await client.query<{ id: string }>(
    `SELECT id
     FROM document_versions
     WHERE document_id = $1
       AND is_current = true
     ORDER BY uploaded_at DESC
     LIMIT 1`,
    [documentId],
  );

  const fallbackVersion = await client.query<{ id: string }>(
    `SELECT id
     FROM document_versions
     WHERE document_id = $1
     ORDER BY uploaded_at DESC
     LIMIT 1`,
    [documentId],
  );

  const currentVersionId = currentVersion.rows[0]?.id ?? fallbackVersion.rows[0]?.id;
  if (!currentVersionId) {
    return;
  }

  await client.query(
    `UPDATE document_versions
     SET is_current = CASE WHEN id = $2 THEN true ELSE false END,
         status = CASE
           WHEN id = $2 THEN 'active'::tenant_template."DocumentVersionStatus"
           ELSE 'pending'::tenant_template."DocumentVersionStatus"
         END
     WHERE document_id = $1`,
    [documentId, currentVersionId],
  );

  for (const recipient of seed.recipients) {
    const recipientUserId = resolveTenantUserId(recipient.email, tenantUserByEmail);
    if (!recipientUserId) {
      continue;
    }

    const existingDistribution = await client.query<{ id: string }>(
      `SELECT id
       FROM document_distributions
       WHERE document_id = $1
         AND version_id = $2
         AND recipient_id = $3
       LIMIT 1`,
      [documentId, currentVersionId, recipientUserId],
    );

      if (existingDistribution.rowCount) {
        continue;
      }

    await client.query(
      `INSERT INTO document_distributions (
        id,
        document_id,
        version_id,
        recipient_id,
        audience,
        note,
        sent_at,
        read_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        uuidv5(
          `pilot-document-distribution:${documentId}:${currentVersionId}:${recipientUserId}`,
          DOCUMENT_NAMESPACE,
        ),
        documentId,
        currentVersionId,
        recipientUserId,
        recipient.audience,
        "Diffusion pilote BNAA",
        `${seed.publishedAt}T10:00:00.000Z`,
        recipient.status === "Lu"
          ? recipient.acknowledgedAt ?? `${seed.publishedAt}T12:00:00.000Z`
          : null,
      ],
    );
  }
}

async function ensureSeededDocumentVersion(
  client: PoolClient,
  documentId: string,
  tenantUserByEmail: Map<string, TenantUserRecord>,
  fallbackUserId: string,
  document: PilotDocumentSeed,
  version: PilotDocumentVersionSeed,
  isCurrent: boolean,
) {
  const existingVersion = await client.query<{ id: string }>(
    `SELECT id
     FROM document_versions
     WHERE document_id = $1
       AND version_label = $2
     LIMIT 1`,
    [documentId, version.version],
  );

  const versionId =
    existingVersion.rows[0]?.id ??
    uuidv5(`pilot-document-version:${documentId}:${version.version}`, DOCUMENT_NAMESPACE);
  const uploadedBy =
    resolveTenantUserId(document.recipients[0]?.email, tenantUserByEmail) ?? fallbackUserId;
  const fileName = `${document.code}-${version.version}.${document.format.toLowerCase()}`;
  const buffer =
    version.fileKind === "pdf"
      ? buildSeedPdfBuffer(document, version)
      : Buffer.from(buildSeedText(document, version), "utf8");
  const fileUrl = buildDataUrl(buffer, version.mimeType);
  const fileKey = `seed/documents/${documentId}/${fileName}`;

  if (isCurrent) {
    await client.query(
      `UPDATE document_versions
       SET is_current = false,
           status = CASE
             WHEN status = 'active'::tenant_template."DocumentVersionStatus"
               THEN 'pending'::tenant_template."DocumentVersionStatus"
             ELSE status
           END
       WHERE document_id = $1
         AND version_label <> $2`,
      [documentId, version.version],
    );
  }

  if (!existingVersion.rowCount) {
    await client.query(
      `INSERT INTO document_versions (
        id,
        document_id,
        version_label,
        file_url,
        file_key,
        file_name,
        file_size_mb,
        file_type,
        mime_type,
        version_note,
        is_current,
        status,
        uploaded_by,
        uploaded_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        CAST($12 AS text)::tenant_template."DocumentVersionStatus",
        $13, $14
      )`,
      [
        versionId,
        documentId,
        version.version,
        fileUrl,
        fileKey,
        fileName,
        roundFileSizeMb(buffer),
        document.format,
        version.mimeType,
        version.fileLabel,
        isCurrent,
        version.status === "Courante" ? "active" : "pending",
        uploadedBy,
        `${version.publishedAt}T08:15:00.000Z`,
      ],
    );
    return;
  }

  return;
}

function resolveTenantUserId(
  email: string | undefined,
  tenantUserByEmail: Map<string, TenantUserRecord>,
) {
  if (!email) {
    return null;
  }

  return tenantUserByEmail.get(normalizeValue(email))?.id ?? null;
}

function mapHubTypeToDocType(hubType: PilotDocumentSeed["hubType"]) {
  switch (hubType) {
    case "plan":
      return "plan";
    case "finance":
      return "other";
    case "audit":
    case "export":
      return "report";
    default:
      return "other";
  }
}

function roundFileSizeMb(buffer: Buffer) {
  return Number((buffer.byteLength / (1024 * 1024)).toFixed(2));
}

function buildDataUrl(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function normalizeValue(value: string) {
  return value.trim().toLowerCase();
}

function buildSeedText(document: PilotDocumentSeed, version: PilotDocumentVersionSeed) {
  return [
    "BnaaSaaS - Document hub pilote",
    `Document : ${document.code}`,
    `Titre : ${document.title}`,
    `Version : ${version.version}`,
    `Discipline : ${document.discipline}`,
    `Lot : ${document.lot}`,
    `Phase : ${document.phase}`,
    `Source : ${document.sourceModule}`,
  ].join("\n");
}

function buildSeedPdfBuffer(document: PilotDocumentSeed, version: PilotDocumentVersionSeed) {
  const lines = [
    "BnaaSaaS - Espace documentaire",
    `Document : ${document.code}`,
    `Titre : ${document.title}`,
    `Version : ${version.version}`,
    `Discipline : ${document.discipline}`,
    `Lot : ${document.lot}`,
    `Phase : ${document.phase}`,
    `Module source : ${document.sourceModule}`,
    `Etat : ${document.status}`,
  ];

  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = "<< /Type /Pages /Count 1 /Kids [4 0 R] >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  const content = [
    "BT",
    "/F1 11 Tf",
    "14 TL",
    "50 800 Td",
    ...lines.flatMap((line, index) =>
      index === 0 ? [`(${escapePdfText(line)}) Tj`] : ["T*", `(${escapePdfText(line)}) Tj`],
    ),
    "ET",
  ].join("\n");
  objects[4] =
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>";
  objects[5] = `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`;

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = Buffer.byteLength(pdf, "latin1");
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

function escapePdfText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}
