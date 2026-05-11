import { Buffer } from "node:buffer";

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import type { PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";

import { AuthenticatedUser } from "@/common/types/authenticated-user.interface";
import { AcknowledgeDocumentDto } from "@/documents/dto/acknowledge-document.dto";
import { DistributeDocumentDto } from "@/documents/dto/distribute-document.dto";
import { PublishVersionDto } from "@/documents/dto/publish-version.dto";
import { UpdateDocumentDto } from "@/documents/dto/update-document.dto";
import { MailService } from "@/mail/mail.service";
import { NotificationsService } from "@/notifications/notifications.service";
import { PdfService } from "@/pdf/pdf.service";
import { SiteScopeService } from "@/site-reports/site-scope.service";

type DocumentListRow = {
  code: string | null;
  created_at: string;
  created_by: string;
  current_version_id: string | null;
  discipline: string | null;
  doc_type: string | null;
  file_key: string | null;
  file_name: string | null;
  file_size_mb: number | string | null;
  file_type: string | null;
  file_url: string | null;
  hub_type: string | null;
  id: string;
  is_current: boolean | null;
  last_distributed_at: string | null;
  lot: string | null;
  mime_type: string | null;
  name: string;
  offline_ready: boolean | null;
  parent_document_id: string | null;
  phase: string | null;
  priority: string | null;
  project_id: string;
  read_count: number | string | null;
  recipient_count: number | string | null;
  source_module: string | null;
  source_record_id: string | null;
  status: string;
  storage_mode: string | null;
  uploaded_at: string | null;
  uploaded_by: string | null;
  version_count: number | string | null;
  version_label: string | null;
  version_note: string | null;
  visibility_scope: unknown;
  zone: string | null;
};

type DocumentVersionRow = {
  document_id: string;
  file_key: string;
  file_name: string | null;
  file_size_mb: number | string | null;
  file_type: string | null;
  file_url: string;
  id: string;
  is_current: boolean;
  mime_type: string | null;
  status: string;
  uploaded_at: string;
  uploaded_by: string;
  version_label: string;
  version_note: string | null;
};

type DistributionRow = {
  acknowledged_at: string | null;
  audience: string | null;
  document_id: string;
  full_name: string;
  id: string;
  role: string;
  sent_at: string;
  user_id: string;
  version_id: string;
};

type ProjectMemberRow = {
  email: string;
  full_name: string;
  id: string;
  role: string;
};

type ReportRow = {
  activities: string | null;
  created_at: string;
  created_by: string;
  id: string;
  notes: string | null;
  pdf_url: string | null;
  progress_by_lot: unknown;
  report_date: string;
  signed_at: string | null;
  signed_by: string | null;
  status: string;
  weather: string | null;
  workforce_count: number | string | null;
};

type PhotoRow = {
  file_key: string;
  file_url: string;
  gps_lat: number | null;
  gps_lng: number | null;
  id: string;
  location_label: string | null;
  report_id: string | null;
  taken_at: string;
  task_tag: string | null;
  uploaded_by: string;
};

type NcrRow = {
  assigned_to: string | null;
  closed_at: string | null;
  closed_by: string | null;
  created_at: string;
  created_by: string;
  deadline: string | null;
  description: string | null;
  evidence_url: string | null;
  id: string;
  reference: string | null;
  severity: string;
  status: string;
  title: string;
  updated_at: string;
};

type NcrPhotoRow = {
  file_key: string;
  file_url: string;
  id: string;
  ncr_id: string;
  uploaded_at: string;
};

type HubAttachment = {
  href?: string;
  id: string;
  kind: string;
  label: string;
  meta: string;
  status: string;
};

type DocumentActionCapabilities = {
  acknowledge?: boolean;
  compare?: boolean;
  distribute?: boolean;
  download?: boolean;
  markObsolete?: boolean;
  open?: boolean;
  prepareOffline?: boolean;
  publishVersion?: boolean;
};

type DocumentVersionPayload = {
  downloadUrl?: string;
  fileName?: string;
  filePath?: string;
  id?: string;
  isCurrent?: boolean;
  mimeType?: string;
  publishedAt: string;
  status: string;
  version: string;
};

type DocumentFilePayload = {
  actionCapabilities?: DocumentActionCapabilities;
  attachments?: HubAttachment[];
  code: string;
  compareWith: string;
  discipline: string;
  distributionState?: string;
  documentType?: "audit" | "export" | "finance" | "photo" | "plan" | "quality" | "report";
  downloadUrl?: string;
  fileName?: string;
  filePath?: string;
  fileSizeMb: number;
  format: string;
  id: string;
  isCurrent: boolean;
  lastDistributedAt: string;
  lot: string;
  mimeType?: string;
  offlineReady: boolean;
  offlineState?: string;
  parentDocumentId?: string | null;
  phase: string;
  priority?: "high" | "low" | "medium";
  publishedAt: string;
  readCount: number;
  readState?: string;
  recipients: number;
  relatedPhotos?: HubAttachment[];
  revision: string;
  sourceModule?: string;
  sourceRecordId?: string | null;
  status: string;
  storage: string;
  tone: "danger" | "primary" | "success" | "warning";
  title: string;
  uploadedBy: string;
  versions: DocumentVersionPayload[];
  visibilityScope?: string;
  zone?: string | null;
};

type DocumentRecipientPayload = {
  acknowledgedAt: string;
  audience?: string;
  distributedAt?: string;
  documentId: string;
  id: string;
  name: string;
  role: string;
  status: string;
  userId?: string;
};

const DOCUMENT_EDIT_ROLES = new Set<UserRole>([UserRole.ADMIN, UserRole.BE]);
const DOCUMENT_DISTRIBUTION_ROLES = new Set<UserRole>([UserRole.ADMIN, UserRole.BE, UserRole.CP]);

@Injectable()
export class DocumentsService {
  constructor(
    private readonly siteScope: SiteScopeService,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
    private readonly pdfService: PdfService,
  ) {}

  async list(currentUser: AuthenticatedUser, projectId: string) {
    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) =>
      this.buildWorkspacePayload(client, currentUser, projectId),
    );
  }

  async detail(currentUser: AuthenticatedUser, projectId: string, documentId: string) {
    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      const payload = await this.buildWorkspacePayload(client, currentUser, projectId);
      const item = payload.files.find((document) => document.id === documentId);

      if (!item) {
        throw new NotFoundException("Document not found.");
      }

      return {
        item,
        recipients: payload.recipients.filter((recipient) => recipient.documentId === documentId),
      };
    });
  }

  async search(currentUser: AuthenticatedUser, projectId: string, query: string) {
    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      const payload = await this.buildWorkspacePayload(client, currentUser, projectId);
      const needle = normalizeLookupKey(query);
      const items = needle
        ? payload.files.filter((document) =>
            normalizeLookupKey(
              [
                document.code,
                document.title,
                document.lot,
                document.phase,
                document.discipline,
                document.sourceModule,
                document.documentType,
              ]
                .filter(Boolean)
                .join(" "),
            ).includes(needle),
          )
        : payload.files;

      return {
        items: items.map((document) => ({
          code: document.code,
          id: document.id,
          sourceModule: document.sourceModule ?? "Plans",
          status: document.status,
          title: document.title,
        })),
      };
    });
  }

  async compare(currentUser: AuthenticatedUser, projectId: string, documentId: string) {
    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      const payload = await this.buildWorkspacePayload(client, currentUser, projectId);
      const item = payload.files.find((document) => document.id === documentId);
      if (!item) {
        throw new NotFoundException("Document not found.");
      }

      return {
        item: {
          code: item.code,
          downloadUrl: item.downloadUrl,
          revision: item.revision,
          versions: item.versions.filter((version) => version.downloadUrl),
        },
      };
    });
  }

  async publishVersion(
    currentUser: AuthenticatedUser,
    projectId: string,
    documentId: string,
    payload: PublishVersionDto,
  ) {
    this.assertCanPublish(currentUser);

    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      const document = await this.getStoredDocument(client, projectId, documentId);
      this.assertStoredDocument(document);
      const revision = payload.revision.trim();
      if (!revision) {
        throw new BadRequestException("Document revision is required.");
      }

      const fileBuffer = payload.fileBase64
        ? Buffer.from(payload.fileBase64, "base64")
        : buildInlinePdfBuffer([
            "BnaaSaaS - Nouvelle revision",
            `Document : ${document.code ?? document.name}`,
            `Revision : ${revision}`,
            `Projet : ${projectId}`,
          ]);
      const fileUrl = buildDataUrl(fileBuffer, payload.mimeType);
      const versionId = uuidv4();
      const versionLabel = revision;

      await client.query(
        `UPDATE document_versions
         SET is_current = false,
             status = 'pending'::tenant_template."DocumentVersionStatus"
         WHERE document_id = $1`,
        [documentId],
      );

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
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, 'active'::tenant_template."DocumentVersionStatus", $11, NOW()
        )`,
        [
          versionId,
          documentId,
          versionLabel,
          fileUrl,
          `inline/documents/${documentId}/${sanitizeFileSegment(payload.fileName)}`,
          payload.fileName,
          roundFileSizeMb(fileBuffer),
          payload.format.trim() || document.file_type || inferFormatFromMimeType(payload.mimeType),
          payload.mimeType,
          `Revision ${revision}`,
          currentUser.sub,
        ],
      );

      await this.setCurrentStoredVersion(client, documentId, versionId);

      await client.query(
        `UPDATE documents
         SET status = 'active'::tenant_template."DocumentStatus",
             offline_ready = true,
             last_distributed_at = NULL,
             created_by = created_by
         WHERE id = $1`,
        [documentId],
      );

      await this.notificationsService.createForProjectRoles(client, {
        projectId,
        roles: [UserRole.BE, UserRole.CP, UserRole.CT, UserRole.MO],
        type: "documents.version.published",
        title: "Nouvelle revision publiee",
        body: `${document.code ?? document.name} ${revision} est disponible dans la GED.`,
        link: `/documents?document=${documentId}&tab=versions`,
        excludeUserIds: [currentUser.sub],
      });

      return this.buildWorkspacePayload(client, currentUser, projectId);
    });
  }

  async updateMetadata(
    currentUser: AuthenticatedUser,
    projectId: string,
    documentId: string,
    payload: UpdateDocumentDto,
  ) {
    this.assertCanPublish(currentUser);

    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      await this.getStoredDocument(client, projectId, documentId);
      await client.query(
        `UPDATE documents
         SET name = $3,
             discipline = $4,
             lot = $5,
             phase = CAST($6 AS text)::tenant_template."DocumentPhase"
         WHERE id = $1 AND project_id = $2`,
        [
          documentId,
          projectId,
          payload.title.trim(),
          payload.discipline.trim(),
          payload.lot.trim(),
          payload.phase.trim(),
        ],
      );

      return this.buildWorkspacePayload(client, currentUser, projectId);
    });
  }

  async markObsolete(currentUser: AuthenticatedUser, projectId: string, documentId: string) {
    this.assertCanPublish(currentUser);

    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      await this.getStoredDocument(client, projectId, documentId);
      await client.query(
        `UPDATE documents
         SET status = 'obsolete'::tenant_template."DocumentStatus"
         WHERE id = $1 AND project_id = $2`,
        [documentId, projectId],
      );

      await this.notificationsService.createForProjectRoles(client, {
        projectId,
        roles: [UserRole.BE, UserRole.CP, UserRole.CT, UserRole.MO],
        type: "documents.obsolete",
        title: "Document obsolete",
        body: "Une revision a ete retiree des documents en vigueur.",
        link: `/documents?document=${documentId}&tab=distribution`,
      });

      return this.buildWorkspacePayload(client, currentUser, projectId);
    });
  }

  async distribute(
    currentUser: AuthenticatedUser,
    projectId: string,
    documentId: string,
    payload: DistributeDocumentDto,
  ) {
    this.assertCanDistribute(currentUser);

    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      const document = await this.getStoredDocument(client, projectId, documentId);
      this.assertStoredDocument(document);
      const audience = payload.audience.trim();
      if (!audience) {
        throw new BadRequestException("Document audience is required.");
      }

      const members = await this.listProjectMembers(client, currentUser.tenantId, projectId);
      const historicalRecipientIds = audience.startsWith("Lot ")
        ? await this.listHistoricalAudienceRecipientIds(client, projectId, document.lot, audience)
        : [];
      const recipients = resolveDistributionRecipients({
        audience,
        documentType: mapHubTypeToUiDocumentType(document.hub_type),
        historicalRecipientIds,
        members,
        visibilityRoles: parseVisibilityScopeRoles(document.visibility_scope),
      });
      if (recipients.length === 0) {
        throw new BadRequestException("No recipient is associated with this distribution.");
      }

      const currentVersion = await this.getCurrentStoredVersion(client, documentId);
      if (!currentVersion) {
        throw new BadRequestException("No current version is available for this document.");
      }

      const existingDistributions = await client.query<{ id: string; recipient_id: string }>(
        `SELECT id, recipient_id
         FROM document_distributions
         WHERE document_id = $1
           AND version_id = $2`,
        [documentId, currentVersion.id],
      );
      const distributionByRecipientId = new Map(
        existingDistributions.rows.map((distribution) => [distribution.recipient_id, distribution.id]),
      );

      for (const recipient of recipients) {
        const existingDistributionId = distributionByRecipientId.get(recipient.id);

        if (existingDistributionId) {
          await client.query(
            `UPDATE document_distributions
             SET audience = $2,
                 note = $3,
                 sent_at = NOW()
             WHERE id = $1`,
            [existingDistributionId, audience, "Diffusion controlee BNAA"],
          );
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
            sent_at
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [uuidv4(), documentId, currentVersion.id, recipient.id, audience, "Diffusion controlee BNAA"],
        );
      }

      await client.query(
        `UPDATE documents
         SET last_distributed_at = NOW()
         WHERE id = $1`,
        [documentId],
      );

      const project = await this.siteScope.getProjectSummary(client, projectId);
      await this.notificationsService.createForUsers(client, {
        userIds: recipients.map((recipient) => recipient.id),
        projectId,
        type: "documents.distributed",
        title: "Document diffuse",
        body: `${document.code ?? document.name} attend un accuse de lecture.`,
        link: `/documents?document=${documentId}&tab=distribution`,
      });

      for (const recipient of recipients) {
        await this.mailService.sendDocumentDistributedEmail({
          documentCode: document.code ?? document.name,
          documentLink: `/documents?document=${documentId}&tab=distribution`,
          documentTitle: document.name,
          projectName: project.name,
          recipientEmail: recipient.email,
          recipientName: recipient.full_name,
          revision: currentVersion.version_label,
        });
      }

      return this.buildWorkspacePayload(client, currentUser, projectId);
    });
  }

  async acknowledge(
    currentUser: AuthenticatedUser,
    projectId: string,
    documentId: string,
    payload: AcknowledgeDocumentDto,
  ) {
    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      await this.getAnyDocument(client, projectId, documentId);
      const distribution = await client.query<DistributionRow & { recipient_id: string }>(
        `SELECT
           dd.id,
           dd.document_id,
           dd.recipient_id,
           dd.audience,
           dd.sent_at,
           dd.read_at AS acknowledged_at,
           u.id AS user_id,
           u.full_name,
           u.role
         FROM document_distributions dd
         INNER JOIN public.users u
           ON u.id = dd.recipient_id
         WHERE dd.document_id = $1
           AND dd.id = $2
         LIMIT 1`,
        [documentId, payload.recipientId],
      );

      const item = distribution.rows[0];
      if (!item) {
        throw new NotFoundException("Recipient not found.");
      }

      if (currentUser.role !== UserRole.ADMIN && item.recipient_id !== currentUser.sub) {
        throw new ForbiddenException("Only the assigned recipient can acknowledge this document.");
      }

      await client.query(
        `UPDATE document_distributions
         SET read_at = COALESCE(read_at, NOW())
         WHERE id = $1`,
        [payload.recipientId],
      );

      return this.buildWorkspacePayload(client, currentUser, projectId);
    });
  }

  async toggleOffline(currentUser: AuthenticatedUser, projectId: string, documentId: string) {
    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      const document = await this.getStoredDocument(client, projectId, documentId);
      this.assertStoredDocument(document);

      await client.query(
        `UPDATE documents
         SET offline_ready = NOT offline_ready
         WHERE id = $1 AND project_id = $2`,
        [documentId, projectId],
      );

      return this.buildWorkspacePayload(client, currentUser, projectId);
    });
  }

  async downloadDocument(currentUser: AuthenticatedUser, projectId: string, documentId: string) {
    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      if (documentId.startsWith("site-report--")) {
        return this.buildReportDownload(client, projectId, documentId.replace("site-report--", ""));
      }

      if (documentId.startsWith("site-photo--")) {
        return this.buildPhotoDownload(client, projectId, documentId.replace("site-photo--", ""));
      }

      if (documentId.startsWith("site-ncr--")) {
        return this.buildNcrDownload(client, projectId, documentId.replace("site-ncr--", ""));
      }

      const document = await this.getStoredDocument(client, projectId, documentId);
      this.assertStoredDocument(document);
      const version = await this.getCurrentStoredVersion(client, documentId);
      if (!version) {
        throw new NotFoundException("Document version not found.");
      }

      return {
        buffer: decodeDataUrlToBuffer(version.file_url),
        fileName:
          version.file_name ??
          `${document.code ?? document.name}-${version.version_label}.${(version.file_type ?? "pdf").toLowerCase()}`,
        mimeType: version.mime_type ?? inferMimeType(version.file_type),
      };
    });
  }

  async downloadDocumentVersion(
    currentUser: AuthenticatedUser,
    projectId: string,
    documentId: string,
    versionLabel: string,
  ) {
    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      if (documentId.startsWith("site-report--")) {
        return this.buildReportDownload(client, projectId, documentId.replace("site-report--", ""));
      }

      const document = await this.getStoredDocument(client, projectId, documentId);
      this.assertStoredDocument(document);
      const version = await client.query<DocumentVersionRow>(
        `SELECT
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
         FROM document_versions
         WHERE document_id = $1
           AND version_label = $2
         LIMIT 1`,
        [documentId, versionLabel],
      );

      const item = version.rows[0];
      if (!item) {
        throw new NotFoundException("Document version not found.");
      }

      return {
        buffer: decodeDataUrlToBuffer(item.file_url),
        fileName:
          item.file_name ??
          `${document.code ?? document.name}-${item.version_label}.${(item.file_type ?? "pdf").toLowerCase()}`,
        mimeType: item.mime_type ?? inferMimeType(item.file_type),
      };
    });
  }

  private async buildWorkspacePayload(
    client: PoolClient,
    currentUser: AuthenticatedUser,
    projectId: string,
  ) {
    const members = await this.listProjectMembers(client, currentUser.tenantId, projectId);
    const membersById = new Map(members.map((member) => [member.id, member]));

    const documents = await this.listStoredDocuments(client, projectId);
    const versions = await this.listDocumentVersions(client, projectId);
    const distributions = await this.listDocumentDistributions(
      client,
      projectId,
      currentUser.tenantId,
    );
    const reports = await this.listReports(client, projectId);
    const photos = await this.listPhotos(client, projectId);
    const ncrs = await this.listNcrs(client, projectId);
    const ncrPhotos = await this.listNcrPhotos(client, projectId);

    const versionsByDocument = groupBy(versions, (version) => version.document_id);
    const distributionsByDocument = groupBy(distributions, (distribution) => distribution.document_id);
    const photosByReport = groupBy(
      photos.filter((photo) => photo.report_id),
      (photo) => String(photo.report_id),
    );
    const photosByNcr = groupBy(ncrPhotos, (photo) => photo.ncr_id);
    const reportById = new Map(reports.map((report) => [report.id, report]));
    const ncrById = new Map(ncrs.map((ncr) => [ncr.id, ncr]));

    const storedDocumentItems = documents
      .filter((document) =>
        this.canViewStoredDocument(currentUser, document, distributionsByDocument.get(document.id) ?? []),
      )
      .map((document) =>
        this.mapStoredDocument(
          document,
          versionsByDocument.get(document.id) ?? [],
          distributionsByDocument.get(document.id) ?? [],
          membersById,
          projectId,
        ),
      );
    const reportDocumentItems = reports
      .map((report) =>
        this.mapReportDocument(report, photosByReport.get(report.id) ?? [], membersById, projectId),
      )
      .filter((document) => this.canViewDerivedDocument(currentUser.role, document));
    const photoDocumentItems = photos
      .map((photo) =>
        this.mapPhotoDocument(
          photo,
          reportById.get(String(photo.report_id ?? "")) ?? null,
          membersById,
          projectId,
        ),
      )
      .filter((document) => this.canViewDerivedDocument(currentUser.role, document));
    const ncrDocumentItems = ncrs
      .map((ncr) => this.mapNcrDocument(ncr, photosByNcr.get(ncr.id) ?? [], membersById, projectId))
      .filter((document) => this.canViewDerivedDocument(currentUser.role, document));

    const allDocuments = [
      ...storedDocumentItems,
      ...reportDocumentItems,
      ...photoDocumentItems,
      ...ncrDocumentItems,
    ];

    const visibleDocumentIds = new Set(allDocuments.map((document) => document.id));
    const currentVersionByDocumentId = new Map(
      documents.map((document) => [document.id, document.current_version_id]),
    );
    const visibleRecipients = distributions
      .filter(
        (distribution) =>
          visibleDocumentIds.has(distribution.document_id) &&
          distribution.version_id === currentVersionByDocumentId.get(distribution.document_id),
      )
      .map((distribution) => ({
        acknowledgedAt: distribution.acknowledged_at
          ? formatDateTimeLabel(distribution.acknowledged_at)
          : "",
        audience: distribution.audience ?? undefined,
        distributedAt: formatDateTimeLabel(distribution.sent_at),
        documentId: distribution.document_id,
        id: distribution.id,
        name: distribution.full_name,
        role: mapBackendRoleToLegacyLabel(distribution.role),
        status: distribution.acknowledged_at ? "Lu" : "Non lu",
        userId: distribution.user_id,
      })) as DocumentRecipientPayload[];

    const kpis = buildDocumentKpis(allDocuments);
    const lots = uniqueValues(allDocuments.map((document) => document.lot).filter(Boolean));
    const phases = uniqueValues(allDocuments.map((document) => document.phase).filter(Boolean));
    const zones = uniqueValues(allDocuments.map((document) => document.zone).filter(Boolean));
    const disciplines = uniqueValues(
      allDocuments.map((document) => document.discipline).filter(Boolean),
    );

    return {
      overview: {
        kpis,
        offline: {
          syncedAt: formatDateTimeLabel(new Date().toISOString()),
          cachedFiles: allDocuments.filter((document) => document.offlineReady).length,
          coverage: "Dernieres revisions, rapports, preuves et justificatifs visibles pour votre role",
        },
      },
      tree: [
        {
          title: (await this.siteScope.getProjectSummary(client, projectId)).name,
          nodes: lots.length
            ? lots.map((lot) => ({
                label: lot,
                phases: phases.length ? phases : ["EXE"],
              }))
            : [
                {
                  label: "Projet",
                  phases: phases.length ? phases : ["EXE"],
                },
              ],
        },
      ],
      files: allDocuments,
      recipients: visibleRecipients,
      draftVersion: {
        revision: suggestNextRevision(storedDocumentItems[0]?.revision ?? "Rev.A"),
        format: storedDocumentItems[0]?.format ?? "PDF",
        audience: "Equipe projet complete",
      },
      distributionOptions: [
        "Equipe projet complete",
        ...lots.map((lot) => `Lot ${lot}`),
        ...members.map((member) => `${member.full_name} - ${mapBackendRoleToLegacyLabel(member.role)}`),
      ],
      projectMembers: members.map((member) => ({
        id: member.id,
        initials: buildInitials(member.full_name),
        name: member.full_name,
        role: mapBackendRoleToLegacyLabel(member.role),
      })),
      projectSetup: {
        lots,
        memberIds: members.map((member) => member.id),
        phases,
        workflowOwners: {
          clientApproverId: "",
          designLeadId: "",
          financeLeadId: "",
          projectManagerId: "",
          siteLeadId: "",
        },
        zones,
      },
      dimensions: {
        disciplines,
      },
    };
  }

  private mapStoredDocument(
    document: DocumentListRow,
    versions: DocumentVersionRow[],
    distributions: DistributionRow[],
    membersById: Map<string, ProjectMemberRow>,
    projectId: string,
  ): DocumentFilePayload {
    const currentDistributions = document.current_version_id
      ? distributions.filter((distribution) => distribution.version_id === document.current_version_id)
      : distributions;
    const currentVersion =
      versions.find((version) => version.is_current) ??
      versions[versions.length - 1] ??
      null;
    const currentRevision = currentVersion?.version_label ?? "v1.0";
    const readCount = currentDistributions.filter((distribution) => distribution.acknowledged_at).length;
    const recipients = currentDistributions.length;
    const status = resolveDocumentStatus(document.status, recipients, readCount);
    const tone = resolveDocumentTone(status);
    const publishDate = formatIsoDate(currentVersion?.uploaded_at ?? document.created_at);
    const allVersions = versions.map((version) => ({
      downloadUrl: `/api/v1/projects/${projectId}/documents/${document.id}/versions/${encodeURIComponent(version.version_label)}/file`,
      fileName: version.file_name ?? undefined,
      id: version.id,
      isCurrent: version.is_current,
      mimeType: version.mime_type ?? inferMimeType(version.file_type),
      publishedAt: formatIsoDate(version.uploaded_at),
      status: mapVersionStatus(version.status, version.is_current),
      version: version.version_label,
    }));

    return {
      actionCapabilities: {
        compare:
          (document.hub_type ?? "plan") === "plan" &&
          allVersions.filter((version) => version.downloadUrl && isPdfMimeType(version.mimeType)).length >
            1,
        distribute: (document.hub_type ?? "plan") !== "photo",
        download: Boolean(currentVersion?.file_url),
        markObsolete: (document.hub_type ?? "plan") !== "finance",
        open: Boolean(currentVersion?.file_url),
        prepareOffline: Boolean(currentVersion?.file_url),
        publishVersion: (document.hub_type ?? "plan") === "plan",
      },
      attachments: [],
      code: document.code ?? document.name,
      compareWith: allVersions.slice(-2)[0]?.version ?? currentRevision,
      discipline: document.discipline ?? "Document",
      distributionState: recipients === 0 ? "A diffuser" : readCount < recipients ? "Diffusion en cours" : "Diffuse",
      documentType: mapHubTypeToUiDocumentType(document.hub_type),
      downloadUrl: currentVersion?.file_url
        ? `/api/v1/projects/${projectId}/documents/${document.id}/file`
        : undefined,
      fileName: currentVersion?.file_name ?? undefined,
      fileSizeMb: Number(currentVersion?.file_size_mb ?? document.file_size_mb ?? 0),
      format: currentVersion?.file_type ?? document.file_type ?? "PDF",
      id: document.id,
      isCurrent: status !== "Obsolete",
      lastDistributedAt: formatIsoDate(document.last_distributed_at ?? currentVersion?.uploaded_at ?? document.created_at),
      lot: document.lot ?? "General",
      mimeType: currentVersion?.mime_type ?? inferMimeType(currentVersion?.file_type ?? document.file_type),
      offlineReady: Boolean(document.offline_ready),
      offlineState: Boolean(document.offline_ready) ? "Disponible hors connexion" : "Non synchronise",
      parentDocumentId: document.parent_document_id,
      phase: document.phase ?? "EXE",
      priority: normalizePriority(document.priority),
      publishedAt: publishDate,
      readCount,
      readState:
        recipients === 0 ? "Lecture non requise" : readCount < recipients ? "Lecture incomplete" : "Lecture complete",
      recipients,
      relatedPhotos: [],
      revision: currentRevision,
      sourceModule: mapSourceModuleLabel(document.source_module),
      sourceRecordId: document.source_record_id,
      status,
      storage: document.storage_mode ?? "managed",
      tone,
      title: document.name,
      uploadedBy:
        membersById.get(String(currentVersion?.uploaded_by ?? document.created_by))?.full_name ??
        "Equipe projet",
      versions: allVersions,
      visibilityScope: buildVisibilityScopeLabel(document.visibility_scope),
      zone: document.zone,
    };
  }

  private mapReportDocument(
    report: ReportRow,
    photos: PhotoRow[],
    membersById: Map<string, ProjectMemberRow>,
    projectId: string,
  ): DocumentFilePayload {
    const code = `RJC-${formatIsoDate(report.report_date).replaceAll("-", "")}`;
    const canDownload = report.status !== "draft";
    const title = `Rapport journalier ${formatDateLabel(report.report_date)}`;
    return {
      actionCapabilities: {
        compare: false,
        distribute: false,
        download: canDownload,
        markObsolete: false,
        open: canDownload,
        prepareOffline: canDownload,
        publishVersion: false,
      },
      attachments: report.pdf_url
        ? [
            {
              href: `/api/v1/projects/${projectId}/documents/site-report--${report.id}/file`,
              id: `attachment-report-pdf-${report.id}`,
              kind: "PDF signe",
              label: `${code}.pdf`,
              meta: "Export genere depuis le chantier",
              status: report.status === "signed" ? "Signe" : "Pret a signer",
            },
          ]
        : [],
      code,
      compareWith: "v1.0",
      discipline: "Chantier",
      distributionState: "Suivi chantier",
      documentType: "report",
      downloadUrl: canDownload
        ? `/api/v1/projects/${projectId}/documents/site-report--${report.id}/file`
        : undefined,
      fileName: canDownload ? `${code}.pdf` : undefined,
      fileSizeMb: 0.35,
      format: canDownload ? "PDF" : "TXT",
      id: `site-report--${report.id}`,
      isCurrent: true,
      lastDistributedAt: formatIsoDate(report.signed_at ?? report.created_at),
      lot: resolvePrimaryLot(report.progress_by_lot),
      mimeType: canDownload ? "application/pdf" : "text/plain",
      offlineReady: canDownload,
      offlineState: canDownload ? "Disponible hors connexion" : "Non synchronise",
      parentDocumentId: null,
      phase: "EXE",
      priority: isToday(report.report_date) ? "high" : "medium",
      publishedAt: formatIsoDate(report.report_date),
      readCount: 0,
      readState: "Lecture non requise",
      recipients: 0,
      relatedPhotos: photos.map((photo) => this.mapPhotoAttachment(photo)),
      revision: "v1.0",
      sourceModule: "Chantier",
      sourceRecordId: report.id,
      status: report.status === "signed" ? "Courante" : report.status === "pending_signature" ? "Diffusion" : "Non diffuse",
      storage: "generated",
      tone: report.status === "signed" ? "success" : report.status === "pending_signature" ? "primary" : "warning",
      title,
      uploadedBy:
        membersById.get(String(report.created_by))?.full_name ??
        "Equipe chantier",
      versions: [
        {
          downloadUrl: canDownload
            ? `/api/v1/projects/${projectId}/documents/site-report--${report.id}/file`
            : undefined,
          fileName: canDownload ? `${code}.pdf` : undefined,
          isCurrent: true,
          mimeType: canDownload ? "application/pdf" : "text/plain",
          publishedAt: formatIsoDate(report.report_date),
          status: "Courante",
          version: "v1.0",
        },
      ],
      visibilityScope: "Projet / chantier",
      zone: derivePrimaryZoneFromPhotos(photos),
    };
  }

  private mapPhotoDocument(
    photo: PhotoRow,
    report: ReportRow | null,
    membersById: Map<string, ProjectMemberRow>,
    projectId: string,
  ): DocumentFilePayload {
    const decodedTag = decodePhotoTaskTag(photo.task_tag);
    const title = decodedTag.title ?? derivePhotoTitle(photo.file_key);
    const lot = decodedTag.lot ?? "Preuve terrain";
    const zone = photo.location_label ?? null;
    const fileFormat = inferFormatFromMimeType(inferMimeTypeFromDataUrl(photo.file_url));
    return {
      actionCapabilities: {
        compare: false,
        distribute: false,
        download: true,
        markObsolete: false,
        open: true,
        prepareOffline: true,
        publishVersion: false,
      },
      attachments: [],
      code: `PH-${photo.id.replace(/-/g, "").slice(-6).toUpperCase()}`,
      compareWith: "v1.0",
      discipline: "Preuve photo",
      distributionState: "Preuve liee",
      documentType: "photo",
      downloadUrl: `/api/v1/projects/${projectId}/documents/site-photo--${photo.id}/file`,
      fileName: deriveFileName(photo.file_key),
      fileSizeMb: roundFileSizeMb(decodeDataUrlToBuffer(photo.file_url)),
      format: fileFormat,
      id: `site-photo--${photo.id}`,
      isCurrent: true,
      lastDistributedAt: formatIsoDate(photo.taken_at),
      lot,
      mimeType: inferMimeTypeFromDataUrl(photo.file_url),
      offlineReady: true,
      offlineState: "Disponible hors connexion",
      parentDocumentId: report ? `site-report--${report.id}` : null,
      phase: "EXE",
      priority: report ? "medium" : "low",
      publishedAt: formatIsoDate(photo.taken_at),
      readCount: 0,
      readState: "Lecture non requise",
      recipients: 0,
      relatedPhotos: [
        {
          href: photo.file_url,
          id: `photo-preview-${photo.id}`,
          kind: "Preuve liee",
          label: title,
          meta: `${lot} · ${zone ?? "Zone chantier"}`,
          status: "Liee",
        },
      ],
      revision: "v1.0",
      sourceModule: "Chantier",
      sourceRecordId: photo.id,
      status: "Courante",
      storage: "evidence",
      tone: "primary",
      title,
      uploadedBy:
        membersById.get(String(photo.uploaded_by))?.full_name ??
        "Equipe terrain",
      versions: [
        {
          downloadUrl: `/api/v1/projects/${projectId}/documents/site-photo--${photo.id}/file`,
          fileName: deriveFileName(photo.file_key),
          isCurrent: true,
          mimeType: inferMimeTypeFromDataUrl(photo.file_url),
          publishedAt: formatIsoDate(photo.taken_at),
          status: "Courante",
          version: "v1.0",
        },
      ],
      visibilityScope: report ? "Projet / chantier" : "Preuve terrain",
      zone,
    };
  }

  private mapNcrDocument(
    ncr: NcrRow,
    photos: NcrPhotoRow[],
    membersById: Map<string, ProjectMemberRow>,
    projectId: string,
  ): DocumentFilePayload {
    return {
      actionCapabilities: {
        compare: false,
        distribute: false,
        download: true,
        markObsolete: false,
        open: true,
        prepareOffline: photos.length > 0,
        publishVersion: false,
      },
      attachments: [],
      code: ncr.reference ?? `NC-${ncr.id.slice(-6).toUpperCase()}`,
      compareWith: "v1.0",
      discipline: "Qualite",
      distributionState: ncr.status === "closed" ? "Archive qualite" : "Blocage a traiter",
      documentType: "quality",
      downloadUrl: `/api/v1/projects/${projectId}/documents/site-ncr--${ncr.id}/file`,
      fileName: `${ncr.reference ?? ncr.id}.pdf`,
      fileSizeMb: 0.24,
      format: "PDF",
      id: `site-ncr--${ncr.id}`,
      isCurrent: ncr.status !== "closed",
      lastDistributedAt: formatIsoDate(ncr.updated_at),
      lot: "Qualite / NCR",
      mimeType: "application/pdf",
      offlineReady: photos.length > 0,
      offlineState: photos.length > 0 ? "Disponible hors connexion" : "Non synchronise",
      parentDocumentId: null,
      phase: "EXE",
      priority: ncr.status === "open" ? "high" : "medium",
      publishedAt: formatIsoDate(ncr.created_at),
      readCount: 0,
      readState: "Lecture non requise",
      recipients: 0,
      relatedPhotos: photos.map((photo) => ({
        href: photo.file_url,
        id: photo.id,
        kind: "Preuve liee",
        label: deriveFileName(photo.file_key),
        meta: `Ajoutee le ${formatDateTimeLabel(photo.uploaded_at)}`,
        status: "Liee",
      })),
      revision: "v1.0",
      sourceModule: "Chantier",
      sourceRecordId: ncr.id,
      status: ncr.status === "closed" ? "Courante" : "Diffusion",
      storage: "quality",
      tone: ncr.status === "closed" ? "success" : ncr.severity === "high" ? "danger" : "warning",
      title: ncr.title,
      uploadedBy:
        membersById.get(String(ncr.created_by))?.full_name ??
        "Equipe qualite",
      versions: [
        {
          downloadUrl: `/api/v1/projects/${projectId}/documents/site-ncr--${ncr.id}/file`,
          fileName: `${ncr.reference ?? ncr.id}.pdf`,
          isCurrent: true,
          mimeType: "application/pdf",
          publishedAt: formatIsoDate(ncr.created_at),
          status: "Courante",
          version: "v1.0",
        },
      ],
      visibilityScope: "Qualite / preuve liee",
      zone: null,
    };
  }

  private mapPhotoAttachment(photo: PhotoRow): HubAttachment {
    const decodedTag = decodePhotoTaskTag(photo.task_tag);
    return {
      href: photo.file_url,
      id: photo.id,
      kind: "Preuve liee",
      label: decodedTag.title ?? derivePhotoTitle(photo.file_key),
      meta: `${decodedTag.lot ?? "Terrain"} · ${photo.location_label ?? "Zone chantier"}`,
      status: "Liee",
    };
  }

  private canViewDocument(role: UserRole, document: DocumentFilePayload) {
    const documentType = document.documentType ?? "plan";

    if (role === UserRole.ADMIN || role === UserRole.CP) {
      return true;
    }

    if (role === UserRole.BE) {
      return documentType !== "finance";
    }

    if (role === UserRole.CT) {
      return documentType !== "finance";
    }

    if (role === UserRole.CO) {
      return documentType === "finance" || documentType === "export" || documentType === "report";
    }

    if (role === UserRole.MO) {
      return (
        documentType === "finance" ||
        documentType === "export" ||
        documentType === "report" ||
        document.recipients > 0
      );
    }

    return true;
  }

  private canViewStoredDocument(
    currentUser: AuthenticatedUser,
    document: DocumentListRow,
    distributions: DistributionRow[],
  ) {
    if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CP) {
      return true;
    }

    const visibilityRoles = parseVisibilityScopeRoles(document.visibility_scope);
    const explicitShare = distributions.some(
      (distribution) =>
        distribution.user_id === currentUser.sub &&
        (!document.current_version_id || distribution.version_id === document.current_version_id),
    );

    if (explicitShare) {
      return true;
    }

    if (visibilityRoles.size > 0) {
      return visibilityRoles.has(currentUser.role);
    }

    return this.canViewDocument(currentUser.role, {
      documentType: mapHubTypeToUiDocumentType(document.hub_type),
    } as DocumentFilePayload);
  }

  private canViewDerivedDocument(role: UserRole, document: DocumentFilePayload) {
    const documentType = document.documentType ?? "plan";

    if (role === UserRole.ADMIN || role === UserRole.CP) {
      return true;
    }

    if (role === UserRole.BE) {
      return documentType === "quality";
    }

    if (role === UserRole.CT) {
      return documentType === "plan" || documentType === "report" || documentType === "photo" || documentType === "quality";
    }

    if (role === UserRole.CO) {
      return documentType === "report" && document.status === "Courante";
    }

    if (role === UserRole.MO) {
      return documentType === "report" && document.status === "Courante";
    }

    return false;
  }

  private assertCanPublish(currentUser: AuthenticatedUser) {
    if (!DOCUMENT_EDIT_ROLES.has(currentUser.role)) {
      throw new ForbiddenException("You cannot publish or edit document metadata.");
    }
  }

  private assertCanDistribute(currentUser: AuthenticatedUser) {
    if (!DOCUMENT_DISTRIBUTION_ROLES.has(currentUser.role)) {
      throw new ForbiddenException("You cannot distribute documents.");
    }
  }

  private assertStoredDocument(document: DocumentListRow | null) {
    if (!document || document.id.startsWith("site-")) {
      throw new BadRequestException("This action is only available on managed library documents.");
    }
  }

  private async getAnyDocument(client: PoolClient, projectId: string, documentId: string) {
    if (
      documentId.startsWith("site-report--") ||
      documentId.startsWith("site-photo--") ||
      documentId.startsWith("site-ncr--")
    ) {
      return { id: documentId };
    }

    return this.getStoredDocument(client, projectId, documentId);
  }

  private async getStoredDocument(client: PoolClient, projectId: string, documentId: string) {
    const result = await client.query<DocumentListRow>(
      `SELECT
         d.id,
         d.project_id,
         d.name,
         d.code,
         d.lot,
         d.discipline,
         d.zone,
         d.phase::text AS phase,
         d.doc_type::text AS doc_type,
         d.source_module,
         d.source_record_id,
         d.parent_document_id,
         d.hub_type,
         d.priority,
         d.visibility_scope,
         d.offline_ready,
         d.last_distributed_at,
         d.storage_mode,
         d.status::text AS status,
         d.created_by,
         d.created_at,
         cv.id AS current_version_id,
         cv.version_label,
         cv.file_url,
         cv.file_key,
         cv.file_name,
         cv.file_size_mb,
         cv.file_type,
         cv.mime_type,
         cv.version_note,
         cv.is_current,
         cv.uploaded_by,
         cv.uploaded_at,
         COUNT(dv.id)::int AS version_count,
         (COUNT(dd.id) FILTER (WHERE dd.read_at IS NOT NULL))::int AS read_count,
         COUNT(dd.id)::int AS recipient_count
       FROM documents d
       LEFT JOIN document_versions cv
         ON cv.document_id = d.id
        AND cv.is_current = true
       LEFT JOIN document_versions dv
         ON dv.document_id = d.id
        LEFT JOIN document_distributions dd
          ON dd.document_id = d.id
         AND dd.version_id = cv.id
       WHERE d.project_id = $1
         AND d.id = $2
       GROUP BY d.id, cv.id
       LIMIT 1`,
      [projectId, documentId],
    );

    return result.rows[0] ?? null;
  }

  private async getCurrentStoredVersion(client: PoolClient, documentId: string) {
    const result = await client.query<DocumentVersionRow>(
      `SELECT
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
         status::text AS status,
         uploaded_by,
         uploaded_at
       FROM document_versions
       WHERE document_id = $1
       ORDER BY
         is_current DESC,
         CASE
           WHEN status = 'active'::tenant_template."DocumentVersionStatus" THEN 0
           ELSE 1
         END,
         uploaded_at DESC
       LIMIT 1`,
      [documentId],
    );

    return result.rows[0] ?? null;
  }

  private async setCurrentStoredVersion(
    client: PoolClient,
    documentId: string,
    currentVersionId: string,
  ) {
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
  }

  private async listStoredDocuments(client: PoolClient, projectId: string) {
    const result = await client.query<DocumentListRow>(
      `SELECT
         d.id,
         d.project_id,
         d.name,
         d.code,
         d.lot,
         d.discipline,
         d.zone,
         d.phase::text AS phase,
         d.doc_type::text AS doc_type,
         d.source_module,
         d.source_record_id,
         d.parent_document_id,
         d.hub_type,
         d.priority,
         d.visibility_scope,
         d.offline_ready,
         d.last_distributed_at,
         d.storage_mode,
         d.status::text AS status,
         d.created_by,
         d.created_at,
         cv.id AS current_version_id,
         cv.version_label,
         cv.file_url,
         cv.file_key,
         cv.file_name,
         cv.file_size_mb,
         cv.file_type,
         cv.mime_type,
         cv.version_note,
         cv.is_current,
         cv.uploaded_by,
         cv.uploaded_at,
         COUNT(DISTINCT dv.id)::int AS version_count,
         (COUNT(DISTINCT dd.id) FILTER (WHERE dd.read_at IS NOT NULL))::int AS read_count,
         COUNT(DISTINCT dd.id)::int AS recipient_count
       FROM documents d
       LEFT JOIN document_versions cv
         ON cv.document_id = d.id
        AND cv.is_current = true
       LEFT JOIN document_versions dv
         ON dv.document_id = d.id
        LEFT JOIN document_distributions dd
          ON dd.document_id = d.id
         AND dd.version_id = cv.id
       WHERE d.project_id = $1
       GROUP BY d.id, cv.id
       ORDER BY COALESCE(d.last_distributed_at, cv.uploaded_at, d.created_at) DESC`,
      [projectId],
    );

    return result.rows;
  }

  private async listDocumentVersions(client: PoolClient, projectId: string) {
    const result = await client.query<DocumentVersionRow>(
      `SELECT
         dv.id,
         dv.document_id,
         dv.version_label,
         dv.file_url,
         dv.file_key,
         dv.file_name,
         dv.file_size_mb,
         dv.file_type,
         dv.mime_type,
         dv.version_note,
         dv.is_current,
         dv.status::text AS status,
         dv.uploaded_by,
         dv.uploaded_at
       FROM document_versions dv
       INNER JOIN documents d
         ON d.id = dv.document_id
       WHERE d.project_id = $1
       ORDER BY dv.uploaded_at ASC`,
      [projectId],
    );

    return result.rows;
  }

  private async listDocumentDistributions(
    client: PoolClient,
    projectId: string,
    tenantId: string,
  ) {
    const result = await client.query<DistributionRow>(
      `SELECT
         dd.id,
         dd.document_id,
         dd.version_id,
         dd.audience,
         dd.sent_at,
         dd.read_at AS acknowledged_at,
         u.id AS user_id,
         u.full_name,
         u.role
       FROM document_distributions dd
       INNER JOIN documents d
         ON d.id = dd.document_id
       INNER JOIN public.users u
         ON u.id = dd.recipient_id
       WHERE d.project_id = $1
         AND u.tenant_id = $2
       ORDER BY dd.sent_at DESC`,
      [projectId, tenantId],
    );

    return result.rows;
  }

  private async listProjectMembers(client: PoolClient, tenantId: string, projectId: string) {
    const result = await client.query<ProjectMemberRow>(
      `SELECT
         u.id,
         u.email,
         u.full_name,
         u.role
       FROM project_members pm
       INNER JOIN public.users u
         ON u.id = pm.user_id
       WHERE pm.project_id = $1
         AND u.tenant_id = $2
         AND u.is_active = true
       ORDER BY u.full_name ASC`,
      [projectId, tenantId],
    );

    return result.rows;
  }

  private async listHistoricalAudienceRecipientIds(
    client: PoolClient,
    projectId: string,
    lot: string | null,
    audience: string,
  ) {
    if (!lot) {
      return [];
    }

    const result = await client.query<{ recipient_id: string }>(
      `SELECT DISTINCT dd.recipient_id
       FROM document_distributions dd
       INNER JOIN documents d
         ON d.id = dd.document_id
       WHERE d.project_id = $1
         AND d.lot = $2
         AND dd.audience = $3`,
      [projectId, lot, audience],
    );

    return result.rows.map((row) => row.recipient_id);
  }

  private async listReports(client: PoolClient, projectId: string) {
    const result = await client.query<ReportRow>(
      `SELECT
         id,
         report_date,
         weather::text AS weather,
         workforce_count,
         progress_by_lot,
         activities,
         notes,
         status::text AS status,
         created_by,
         signed_by,
         signed_at,
         pdf_url,
         created_at
       FROM daily_reports
       WHERE project_id = $1
       ORDER BY report_date DESC`,
      [projectId],
    );

    return result.rows;
  }

  private async listPhotos(client: PoolClient, projectId: string) {
    const result = await client.query<PhotoRow>(
      `SELECT
         id,
         report_id,
         file_url,
         file_key,
         gps_lat,
         gps_lng,
         location_label,
         task_tag,
         uploaded_by,
         taken_at
       FROM photos
       WHERE project_id = $1
         AND is_deleted = false
       ORDER BY taken_at DESC`,
      [projectId],
    );

    return result.rows;
  }

  private async listNcrs(client: PoolClient, projectId: string) {
    const result = await client.query<NcrRow>(
      `SELECT
         id,
         reference,
         title,
         description,
         severity::text AS severity,
         status::text AS status,
         assigned_to,
         deadline,
         evidence_url,
         created_by,
         closed_by,
         closed_at,
         created_at,
         updated_at
       FROM ncr
       WHERE project_id = $1
       ORDER BY updated_at DESC`,
      [projectId],
    );

    return result.rows;
  }

  private async listNcrPhotos(client: PoolClient, projectId: string) {
    const result = await client.query<NcrPhotoRow>(
      `SELECT
         np.id,
         np.ncr_id,
         np.file_url,
         np.file_key,
         np.uploaded_at
       FROM ncr_photos np
       INNER JOIN ncr n
         ON n.id = np.ncr_id
       WHERE n.project_id = $1
       ORDER BY np.uploaded_at DESC`,
      [projectId],
    );

    return result.rows;
  }

  private async buildReportDownload(client: PoolClient, projectId: string, reportId: string) {
    const report = await client.query<ReportRow>(
      `SELECT
         id,
         project_id,
         report_date,
         weather::text AS weather,
         workforce_count,
         workforce_breakdown,
         progress_by_lot,
         activities,
         incidents,
         notes,
         status::text AS status,
         created_by,
         signed_by,
         signed_at,
         pdf_url,
         created_at
       FROM daily_reports
       WHERE project_id = $1
         AND id = $2
       LIMIT 1`,
      [projectId, reportId],
    );

    const item = report.rows[0] as (ReportRow & {
      project_id?: string;
      workforce_breakdown?: unknown;
      incidents?: unknown;
    }) | undefined;
    if (!item) {
      throw new NotFoundException("Report not found.");
    }

    const project = await this.siteScope.getProjectSummary(client, projectId);
    const pdf = await this.pdfService.generateReportPdf({
      activities: String(item.activities ?? ""),
      createdAt: String(item.created_at),
      createdBy: String(item.created_by),
      incidents: parseJsonArray(item.incidents) as Array<{
        action?: string;
        severity?: string;
        type?: string;
      }>,
      notes: String(item.notes ?? ""),
      photoCount: 0,
      progressByLot: parseJsonArray(item.progress_by_lot) as Array<{
        lot?: string;
        progress?: number;
        task?: string;
      }>,
      projectId,
      projectName: project.name,
      reportDate: String(item.report_date),
      reportId: String(item.id),
      signedAt: item.signed_at ?? null,
      signedBy: item.signed_by ?? null,
      status: String(item.status),
      weather: String(item.weather ?? "cloudy"),
      workforceBreakdown: parseJsonArray(item.workforce_breakdown) as Array<{
        count?: number;
        label?: string;
      }>,
      workforceCount: Number(item.workforce_count ?? 0),
    });

    return {
      buffer: pdf.buffer,
      fileName: pdf.fileName,
      mimeType: "application/pdf",
    };
  }

  private async buildPhotoDownload(client: PoolClient, projectId: string, photoId: string) {
    const result = await client.query<PhotoRow>(
      `SELECT id, file_url, file_key
       FROM photos
       WHERE project_id = $1
         AND id = $2
         AND is_deleted = false
       LIMIT 1`,
      [projectId, photoId],
    );

    const photo = result.rows[0];
    if (!photo) {
      throw new NotFoundException("Photo not found.");
    }

    return {
      buffer: decodeDataUrlToBuffer(photo.file_url),
      fileName: deriveFileName(photo.file_key),
      mimeType: inferMimeTypeFromDataUrl(photo.file_url),
    };
  }

  private async buildNcrDownload(client: PoolClient, projectId: string, ncrId: string) {
    const ncrResult = await client.query<NcrRow>(
      `SELECT id, reference, title, description, severity::text AS severity, status::text AS status, deadline, created_at
       FROM ncr
       WHERE project_id = $1 AND id = $2
       LIMIT 1`,
      [projectId, ncrId],
    );
    const photoResult = await client.query<NcrPhotoRow>(
      `SELECT np.id, np.ncr_id, np.file_url, np.file_key, np.uploaded_at
       FROM ncr_photos np
       WHERE np.ncr_id = $1
       ORDER BY np.uploaded_at DESC`,
      [ncrId],
    );

    const ncr = ncrResult.rows[0];
    if (!ncr) {
      throw new NotFoundException("NCR not found.");
    }

    const lines = [
      "BnaaSaaS - Fiche non-conformite",
      `Reference : ${ncr.reference ?? ncr.id}`,
      `Titre : ${ncr.title}`,
      `Statut : ${ncr.status}`,
      `Gravite : ${ncr.severity}`,
      `Delai : ${ncr.deadline ?? "Non defini"}`,
      `Description : ${ncr.description ?? "Aucune description"}`,
      `Pieces jointes : ${photoResult.rowCount}`,
    ];

    return {
      buffer: buildInlinePdfBuffer(lines),
      fileName: `${ncr.reference ?? ncr.id}.pdf`,
      mimeType: "application/pdf",
    };
  }
}

function buildDocumentKpis(documents: DocumentFilePayload[]) {
  const totalSizeMb = documents.reduce((total, document) => total + Number(document.fileSizeMb ?? 0), 0);
  const totalRecipients = documents.reduce(
    (total, document) => total + Math.max(Number(document.recipients ?? 0), 1),
    0,
  );
  const totalReads = documents.reduce((total, document) => total + Number(document.readCount ?? 0), 0);
  const activeVersions = documents.filter((document) => document.isCurrent).length;
  const staleUndistributed = documents.filter(
    (document) => diffInDays(document.lastDistributedAt) > 5 && document.recipients === 0,
  ).length;
  const readRate = Math.round((totalReads / Math.max(totalRecipients, 1)) * 100);

  return [
    {
      helper: `${documents.length} fichiers visibles dans votre espace projet`,
      label: "Volume documentaire",
      tone: "primary",
      value: `${(totalSizeMb / 1024).toFixed(1)} Go`,
    },
    {
      helper: `${totalReads}/${totalRecipients} lectures confirmees`,
      label: "Taux de lecture < 48h",
      tone: readRate >= 90 ? "success" : "warning",
      value: `${readRate}%`,
    },
    {
      helper: "Documents en vigueur dans le hub",
      label: "Versions actives",
      tone: activeVersions > 20 ? "warning" : "primary",
      value: `${activeVersions}`,
    },
    {
      helper: "Documents a relancer ou diffuser",
      label: "Documents non diffuses > 5 jours",
      tone: staleUndistributed > 0 ? "danger" : "success",
      value: `${staleUndistributed}`,
    },
  ];
}

function resolveDistributionRecipients({
  audience,
  documentType,
  historicalRecipientIds,
  members,
  visibilityRoles,
}: {
  audience: string;
  documentType: DocumentFilePayload["documentType"];
  historicalRecipientIds: string[];
  members: ProjectMemberRow[];
  visibilityRoles: Set<UserRole>;
}) {
  const scopedMembers = members.filter(
    (member) =>
      visibilityRoles.size === 0 || visibilityRoles.has(member.role as UserRole),
  );

  if (audience === "Equipe projet complete") {
    return scopedMembers;
  }

  if (audience.startsWith("Lot ")) {
    const historicalMembers = scopedMembers.filter((member) =>
      historicalRecipientIds.includes(member.id),
    );

    if (historicalMembers.length > 0) {
      return historicalMembers;
    }

    const financeLotRoles = new Set<UserRole>([
      UserRole.ADMIN,
      UserRole.CO,
      UserRole.CP,
      UserRole.MO,
    ]);
    const technicalLotRoles = new Set<UserRole>([
      UserRole.ADMIN,
      UserRole.BE,
      UserRole.CP,
      UserRole.CT,
    ]);

    const lotScopedMembers = scopedMembers.filter((member) => {
      if (documentType === "finance") {
        return financeLotRoles.has(member.role as UserRole);
      }

      return technicalLotRoles.has(member.role as UserRole);
    });

    return lotScopedMembers;
  }

  const exactMember = scopedMembers.find(
    (member) => `${member.full_name} - ${mapBackendRoleToLegacyLabel(member.role)}` === audience,
  );

  return exactMember ? [exactMember] : scopedMembers;
}

function resolveDocumentStatus(status: string, recipients: number, readCount: number) {
  if (status === "obsolete") {
    return "Obsolete";
  }
  if (recipients === 0) {
    return "Non diffuse";
  }
  if (readCount < recipients) {
    return "Diffusion";
  }
  return "Courante";
}

function resolveDocumentTone(status: string) {
  switch (status) {
    case "Courante":
      return "success" as const;
    case "Obsolete":
      return "warning" as const;
    case "Non diffuse":
      return "danger" as const;
    default:
      return "primary" as const;
  }
}

function mapVersionStatus(status: string, isCurrent: boolean) {
  if (isCurrent) {
    return "Courante";
  }

  return status === "active" ? "Archive" : "Obsolete";
}

function mapHubTypeToUiDocumentType(hubType: string | null | undefined) {
  switch (hubType) {
    case "finance":
      return "finance";
    case "audit":
      return "audit";
    case "export":
      return "export";
    case "quality":
      return "quality";
    case "photo":
      return "photo";
    case "report":
      return "report";
    default:
      return "plan";
  }
}

function mapSourceModuleLabel(sourceModule: string | null | undefined) {
  switch (normalizeLookupKey(sourceModule)) {
    case "finance":
      return "Finance";
    case "systeme":
    case "system":
      return "Systeme";
    case "audit":
      return "Audit";
    case "chantier":
      return "Chantier";
    default:
      return "Plans";
  }
}

function buildVisibilityScopeLabel(value: unknown) {
  const scopes = parseJsonArray(value)
    .map((scope) => String(scope))
    .filter(Boolean);

  if (scopes.includes("CO")) {
    return "Finance / validation";
  }
  if (scopes.includes("BE")) {
    return "Technique / diffusion";
  }
  if (scopes.includes("MO")) {
    return "Partage / audit";
  }
  return "Projet / chantier";
}

function parseVisibilityScopeRoles(value: unknown) {
  const roles = parseJsonArray(value)
    .map((scope) => String(scope).trim().toUpperCase())
    .filter((scope): scope is keyof typeof UserRole => scope in UserRole);

  return new Set(roles.map((scope) => UserRole[scope]));
}

function normalizePriority(value: string | null | undefined) {
  switch (normalizeLookupKey(value)) {
    case "high":
      return "high" as const;
    case "low":
      return "low" as const;
    default:
      return "medium" as const;
  }
}

function mapBackendRoleToLegacyLabel(role: string) {
  switch (role) {
    case "ADMIN":
      return "Super Admin";
    case "BE":
      return "Bureau d'etudes";
    case "CO":
      return "Comptable";
    case "CP":
      return "Chef de projet";
    case "CT":
      return "Conductrice travaux";
    case "MO":
    default:
      return "Maitre d'ouvrage";
  }
}

function parseJsonArray(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function resolvePrimaryLot(progressByLot: unknown) {
  const lots = parseJsonArray(progressByLot) as Array<{ lot?: string }>;
  return String(lots[0]?.lot ?? "Multi-lots");
}

function derivePrimaryZoneFromPhotos(photos: PhotoRow[]) {
  return photos[0]?.location_label ?? null;
}

function decodePhotoTaskTag(value: string | null) {
  if (!value) {
    return {} as { lot?: string; task?: string; title?: string };
  }

  try {
    return JSON.parse(value) as { lot?: string; task?: string; title?: string };
  } catch {
    return {
      task: value,
    };
  }
}

function derivePhotoTitle(fileKey: string) {
  return deriveFileName(fileKey).replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
}

function deriveFileName(fileKey: string) {
  return fileKey.split("/").filter(Boolean).pop() ?? "document";
}

function decodeDataUrlToBuffer(dataUrl: string) {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
  if (!match?.[2]) {
    throw new BadRequestException("Unsupported file payload.");
  }

  return Buffer.from(match[2], "base64");
}

function inferMimeType(format: string | null | undefined) {
  switch (normalizeLookupKey(format)) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "svg":
      return "image/svg+xml";
    case "dwg":
      return "application/acad";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "txt":
      return "text/plain";
    case "pdf":
    default:
      return "application/pdf";
  }
}

function inferMimeTypeFromDataUrl(dataUrl: string) {
  const match = /^data:([^;]+);base64,/i.exec(dataUrl);
  return match?.[1] ?? "application/octet-stream";
}

function inferFormatFromMimeType(mimeType: string | null | undefined) {
  switch (normalizeLookupKey(mimeType)) {
    case "image/jpeg":
      return "JPG";
    case "image/png":
      return "PNG";
    case "image/svg+xml":
      return "SVG";
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return "XLSX";
    case "text/plain":
      return "TXT";
    case "application/pdf":
    default:
      return "PDF";
  }
}

function roundFileSizeMb(buffer: Buffer) {
  return Number((buffer.byteLength / (1024 * 1024)).toFixed(2));
}

function buildDataUrl(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function sanitizeFileSegment(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}

function formatIsoDate(value: string | Date | number | null | undefined) {
  const date = coerceDate(value);
  if (!date) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(value: string | Date | number | null | undefined) {
  const date = coerceDate(value);
  if (!date) {
    return String(value ?? "");
  }
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTimeLabel(value: string | Date | number | null | undefined) {
  const date = coerceDate(value);
  if (!date) {
    return String(value ?? "");
  }
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function diffInDays(value: string | Date | number | null | undefined) {
  const date = coerceDate(value);
  if (!date) {
    return 0;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - date.getTime()) / 86_400_000);
}

function isToday(value: string | Date | number | null | undefined) {
  return formatIsoDate(value) === formatIsoDate(new Date().toISOString());
}

function coerceDate(value: string | Date | number | null | undefined) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function suggestNextRevision(currentRevision: string) {
  const match = /rev\.?\s*([a-z])$/i.exec(currentRevision.trim());
  if (match?.[1]) {
    const nextLetter = String.fromCharCode(match[1].toUpperCase().charCodeAt(0) + 1);
    return `Rev.${nextLetter}`;
  }

  return "Rev.A";
}

function normalizeLookupKey(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function buildInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part.trim()[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function groupBy<T>(items: T[], keySelector: (item: T) => string) {
  const map = new Map<string, T[]>();

  for (const item of items) {
    const key = keySelector(item);
    const current = map.get(key);
    if (current) {
      current.push(item);
    } else {
      map.set(key, [item]);
    }
  }

  return map;
}

function uniqueValues(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function buildInlinePdfBuffer(lines: string[]) {
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

function isPdfMimeType(mimeType: string | undefined) {
  return normalizeLookupKey(mimeType) === "application/pdf";
}
