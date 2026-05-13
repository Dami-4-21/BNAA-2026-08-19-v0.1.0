import { Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";

import {
  buildStatementDocumentCode,
  FINANCE_DOCUMENT_DISCIPLINE,
  FINANCE_DOCUMENT_LOT,
  FINANCE_DOCUMENT_PHASE,
  FINANCE_DOCUMENT_VISIBILITY,
} from "@/finance/finance-helpers";

type FinanceDocumentType = "invoice" | "payment" | "statement";

type UpsertFinanceDocumentInput = {
  documentCode?: string;
  fileBuffer: Buffer;
  fileName: string;
  parentDocumentId?: string | null;
  pdfUrl: string;
  periodMonth?: string;
  projectId: string;
  projectName: string;
  recordedBy: string;
  sourceRecordId: string;
  title: string;
  type: FinanceDocumentType;
};

@Injectable()
export class FinanceDocumentsService {
  async findDocumentIdBySourceRecord(
    client: PoolClient,
    projectId: string,
    sourceRecordId: string,
  ) {
    const result = await client.query<{ id: string }>(
      `SELECT id
       FROM documents
       WHERE project_id = $1
         AND source_module = 'Finance'
         AND source_record_id = $2
       LIMIT 1`,
      [projectId, sourceRecordId],
    );

    return result.rows[0]?.id ?? null;
  }

  async syncStatementPdf(
    client: PoolClient,
    input: Omit<UpsertFinanceDocumentInput, "type"> & { periodMonth: string },
  ) {
    return this.upsertFinanceDocument(client, {
      ...input,
      title: input.title,
      type: "statement",
    });
  }

  async syncInvoicePdf(
    client: PoolClient,
    input: Omit<UpsertFinanceDocumentInput, "type">,
  ) {
    return this.upsertFinanceDocument(client, {
      ...input,
      type: "invoice",
    });
  }

  async syncPaymentProof(
    client: PoolClient,
    input: Omit<UpsertFinanceDocumentInput, "type">,
  ) {
    return this.upsertFinanceDocument(client, {
      ...input,
      type: "payment",
    });
  }

  private async upsertFinanceDocument(client: PoolClient, input: UpsertFinanceDocumentInput) {
    const existing = await client.query<{
      code: string | null;
      id: string;
      parent_document_id: string | null;
    }>(
      `SELECT id, code, parent_document_id
       FROM documents
       WHERE project_id = $1
         AND source_module = 'Finance'
         AND source_record_id = $2
       LIMIT 1`,
      [input.projectId, input.sourceRecordId],
    );

    const documentId = existing.rows[0]?.id ?? uuidv4();
    const code = this.buildDocumentCode(existing.rows[0]?.code, input);

    if (!existing.rowCount) {
      await client.query(
        `INSERT INTO documents (
          id,
          project_id,
          name,
          code,
          lot,
          discipline,
          phase,
          doc_type,
          source_module,
          source_record_id,
          parent_document_id,
          hub_type,
          priority,
          visibility_scope,
          offline_ready,
          storage_mode,
          status,
          created_by,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          CAST($7 AS text)::tenant_template."DocumentPhase",
          CAST($8 AS text)::tenant_template."DocumentType",
          'Finance', $9, $10, 'finance', 'high', $11::jsonb, false, 'inline',
          CAST('active' AS text)::tenant_template."DocumentStatus",
          $12, NOW()
        )`,
        [
          documentId,
          input.projectId,
          input.title,
          code,
          FINANCE_DOCUMENT_LOT,
          FINANCE_DOCUMENT_DISCIPLINE,
          FINANCE_DOCUMENT_PHASE,
          "other",
          input.sourceRecordId,
          input.parentDocumentId ?? null,
          JSON.stringify(FINANCE_DOCUMENT_VISIBILITY),
          input.recordedBy,
        ],
      );
    } else {
      await client.query(
        `UPDATE documents
         SET name = $3,
             code = $4,
             parent_document_id = $5,
             lot = $6,
             discipline = $7,
             priority = 'high',
             visibility_scope = $8::jsonb
         WHERE id = $1
           AND project_id = $2`,
        [
          documentId,
          input.projectId,
          input.title,
          code,
          input.parentDocumentId ?? existing.rows[0]?.parent_document_id ?? null,
          FINANCE_DOCUMENT_LOT,
          FINANCE_DOCUMENT_DISCIPLINE,
          JSON.stringify(FINANCE_DOCUMENT_VISIBILITY),
        ],
      );
    }

    const currentVersion = await client.query<{ id: string }>(
      `SELECT id
       FROM document_versions
       WHERE document_id = $1
         AND is_current = true
       LIMIT 1`,
      [documentId],
    );

    if (currentVersion.rowCount) {
      await client.query(
        `UPDATE document_versions
         SET is_current = false,
             status = 'pending'::tenant_template."DocumentVersionStatus"
         WHERE document_id = $1
           AND is_current = true`,
        [documentId],
      );
    }

    const versionId = uuidv4();
    const versionLabel = await this.nextVersionLabel(client, documentId);
    const dataUrl = buildDataUrl(input.fileBuffer, "application/pdf");
    const fileKey = `generated/finance/${input.type}/${documentId}/${sanitizeFileSegment(input.fileName)}`;

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
        $1, $2, $3, $4, $5, $6, $7, 'PDF', 'application/pdf', $8, true,
        'active'::tenant_template."DocumentVersionStatus",
        $9, NOW()
      )`,
      [
        versionId,
        documentId,
        versionLabel,
        dataUrl,
        fileKey,
        input.fileName,
        roundFileSizeMb(input.fileBuffer),
        `${input.type} finance`,
        input.recordedBy,
      ],
    );

    return {
      code,
      documentId,
      versionId,
    };
  }

  private buildDocumentCode(existingCode: string | null | undefined, input: UpsertFinanceDocumentInput) {
    if (existingCode?.trim()) {
      return existingCode.trim();
    }

    if (input.documentCode?.trim()) {
      return input.documentCode.trim();
    }

    switch (input.type) {
      case "statement":
        return buildStatementDocumentCode(
          input.projectId,
          input.projectName,
          input.periodMonth ?? new Date().toISOString().slice(0, 10),
        );
      case "payment":
        return input.fileName.replace(/\.pdf$/i, "").trim();
      case "invoice":
      default:
        return input.fileName.replace(/\.pdf$/i, "").trim();
    }
  }

  private async nextVersionLabel(client: PoolClient, documentId: string) {
    const result = await client.query<{ version_label: string }>(
      `SELECT version_label
       FROM document_versions
       WHERE document_id = $1
       ORDER BY uploaded_at DESC
       LIMIT 1`,
      [documentId],
    );

    const latest = result.rows[0]?.version_label ?? "";
    const match = latest.match(/^v(\d+)\.(\d+)$/i);
    if (!match) {
      return "v1.0";
    }

    return `v${Number(match[1]) + 1}.0`;
  }
}

function buildDataUrl(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function roundFileSizeMb(buffer: Buffer) {
  return Number((buffer.byteLength / (1024 * 1024)).toFixed(2));
}

function sanitizeFileSegment(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}
