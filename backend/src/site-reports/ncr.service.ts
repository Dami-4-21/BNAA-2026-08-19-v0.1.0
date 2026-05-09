import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { NcrSeverity, NcrStatus, UserRole } from "@prisma/client";
import type { PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";

import { AuthenticatedUser } from "@/common/types/authenticated-user.interface";
import { MailService } from "@/mail/mail.service";
import { NotificationsService } from "@/notifications/notifications.service";
import { CloseNcrDto } from "@/site-reports/dto/close-ncr.dto";
import { CreateNcrDto } from "@/site-reports/dto/create-ncr.dto";
import { UpdateNcrDto } from "@/site-reports/dto/update-ncr.dto";
import { SiteScopeService } from "@/site-reports/site-scope.service";

const NCR_EDIT_ROLES = new Set<UserRole>([UserRole.ADMIN, UserRole.CP, UserRole.CT]);
type NcrRow = Record<string, unknown>;

@Injectable()
export class NcrService {
  constructor(
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
    private readonly siteScope: SiteScopeService,
  ) {}

  async list(currentUser: AuthenticatedUser, projectId: string) {
    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      const result = await client.query<NcrRow>(
        `SELECT
           n.id,
           n.project_id,
           n.reference,
           n.title,
           n.description,
           n.severity,
           n.status,
           n.assigned_to,
           n.deadline,
           n.evidence_url,
           n.created_by,
           n.closed_by,
           n.closed_at,
           n.created_at,
           n.updated_at,
           COUNT(np.id)::int AS photo_count
         FROM ncr n
         LEFT JOIN ncr_photos np ON np.ncr_id = n.id
         WHERE n.project_id = $1
         GROUP BY n.id
         ORDER BY
           CASE n.status
             WHEN 'open' THEN 0
             WHEN 'in_progress' THEN 1
             ELSE 2
           END,
           n.created_at DESC`,
        [projectId],
      );

      return {
        items: result.rows.map((row) => this.mapNcrRow(row)),
      };
    });
  }

  async detail(currentUser: AuthenticatedUser, projectId: string, ncrId: string) {
    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      const ncr = await this.getNcr(client, projectId, ncrId);
      const photos = await client.query<NcrRow>(
        `SELECT id, file_url, file_key, uploaded_at
         FROM ncr_photos
         WHERE ncr_id = $1
         ORDER BY uploaded_at DESC`,
        [ncrId],
      );

      return {
        item: this.mapNcrRow(ncr, photos.rows.length),
        photos: photos.rows.map((row) => this.mapNcrPhotoRow(row)),
      };
    });
  }

  async create(currentUser: AuthenticatedUser, projectId: string, payload: CreateNcrDto) {
    this.assertCanManageNcr(currentUser);

    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      if (payload.assignedTo) {
        await this.siteScope.assertUserActiveInTenant(currentUser, payload.assignedTo);
      }

      const ncrId = uuidv4();
      const reference = await this.generateReference(client, projectId);
      const deadline = payload.deadline ? new Date(payload.deadline) : null;
      if (deadline && Number.isNaN(deadline.getTime())) {
        throw new BadRequestException("Invalid NCR deadline.");
      }

      await client.query(
        `INSERT INTO ncr (
          id,
          project_id,
          reference,
          title,
          description,
          severity,
          assigned_to,
          deadline,
          evidence_url,
          created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        )`,
        [
          ncrId,
          projectId,
          reference,
          payload.title.trim(),
          payload.description?.trim() || null,
          payload.severity ?? NcrSeverity.medium,
          payload.assignedTo ?? null,
          deadline ? this.toDateOnly(deadline) : null,
          payload.evidenceUrl?.trim() || null,
          currentUser.sub,
        ],
      );

      await this.insertNcrPhotos(client, ncrId, payload.photos ?? []);

      const created = await this.getNcr(client, projectId, ncrId);
      const project = await this.siteScope.getProjectSummary(client, projectId);

      if (payload.assignedTo && payload.assignedTo !== currentUser.sub) {
        await this.notificationsService.createForUsers(client, {
          userIds: [payload.assignedTo],
          projectId,
          type: "site.ncr.assigned",
          title: `Non-conformite ${reference} assignee`,
          body: payload.title.trim(),
          link: `/site?ncrId=${ncrId}`,
        });
        await this.sendNcrAssignedEmails(
          client,
          currentUser,
          project.name,
          created,
          payload.assignedTo,
          ncrId,
        );
      }

      return {
        item: this.mapNcrRow(created, payload.photos?.length ?? 0),
      };
    });
  }

  async update(
    currentUser: AuthenticatedUser,
    projectId: string,
    ncrId: string,
    payload: UpdateNcrDto,
  ) {
    this.assertCanManageNcr(currentUser);

    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      const existing = await this.getNcr(client, projectId, ncrId);
      if (existing.status === NcrStatus.closed) {
        throw new BadRequestException("Closed non-conformities cannot be edited.");
      }

      if (payload.assignedTo) {
        await this.siteScope.assertUserActiveInTenant(currentUser, payload.assignedTo);
      }

      const deadline = payload.deadline ? new Date(payload.deadline) : undefined;
      if (deadline && Number.isNaN(deadline.getTime())) {
        throw new BadRequestException("Invalid NCR deadline.");
      }

      await client.query(
        `UPDATE ncr
         SET title = COALESCE($3, title),
             description = COALESCE($4, description),
             severity = COALESCE($5, severity),
             status = COALESCE($6, status),
             assigned_to = COALESCE($7, assigned_to),
             deadline = COALESCE($8, deadline),
             evidence_url = COALESCE($9, evidence_url),
             updated_at = NOW()
         WHERE id = $1 AND project_id = $2`,
        [
          ncrId,
          projectId,
          payload.title?.trim() || null,
          payload.description?.trim() || null,
          payload.severity ?? null,
          payload.status ?? null,
          payload.assignedTo ?? null,
          deadline ? this.toDateOnly(deadline) : null,
          payload.evidenceUrl?.trim() || null,
        ],
      );

      const updated = await this.getNcr(client, projectId, ncrId);
      const project = await this.siteScope.getProjectSummary(client, projectId);

      if (
        payload.assignedTo &&
        payload.assignedTo !== currentUser.sub &&
        payload.assignedTo !== String(existing.assigned_to ?? "")
      ) {
        await this.notificationsService.createForUsers(client, {
          userIds: [payload.assignedTo],
          projectId,
          type: "site.ncr.assigned",
          title: `Non-conformite ${String(updated.reference ?? "")} assignee`,
          body: String(updated.title ?? ""),
          link: `/site?ncrId=${ncrId}`,
        });
        await this.sendNcrAssignedEmails(
          client,
          currentUser,
          project.name,
          updated,
          payload.assignedTo,
          ncrId,
        );
      }

      return {
        item: this.mapNcrRow(updated),
      };
    });
  }

  async close(
    currentUser: AuthenticatedUser,
    projectId: string,
    ncrId: string,
    payload: CloseNcrDto,
  ) {
    this.assertCanManageNcr(currentUser);

    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      const existing = await this.getNcr(client, projectId, ncrId);
      if (existing.status === NcrStatus.closed) {
        return {
          item: this.mapNcrRow(existing),
        };
      }

      await this.insertNcrPhotos(client, ncrId, payload.photos ?? []);
      const currentEvidenceUrl =
        payload.evidenceUrl?.trim() ||
        String(existing.evidence_url ?? "") ||
        String(payload.photos?.[0]?.fileUrl ?? "");

      const photoCount = await this.countNcrPhotos(client, ncrId);
      if (!currentEvidenceUrl && photoCount === 0) {
        throw new BadRequestException(
          "An NCR must include evidence before it can be closed.",
        );
      }

      await client.query(
        `UPDATE ncr
         SET status = $3,
             evidence_url = $4,
             closed_by = $5,
             closed_at = NOW(),
             updated_at = NOW()
         WHERE id = $1 AND project_id = $2`,
        [ncrId, projectId, NcrStatus.closed, currentEvidenceUrl || null, currentUser.sub],
      );

      const closed = await this.getNcr(client, projectId, ncrId);
      const project = await this.siteScope.getProjectSummary(client, projectId);
      if (String(closed.created_by) !== currentUser.sub) {
        await this.notificationsService.createForUsers(client, {
          userIds: [String(closed.created_by)],
          projectId,
          type: "site.ncr.closed",
          title: `Non-conformite ${String(closed.reference ?? "")} cloturee`,
          body: String(closed.title ?? ""),
          link: `/site?ncrId=${ncrId}`,
        });
        await this.sendNcrClosedEmails(client, currentUser, project.name, closed, ncrId);
      }

      return {
        item: this.mapNcrRow(closed, photoCount),
      };
    });
  }

  private assertCanManageNcr(currentUser: AuthenticatedUser) {
    if (!NCR_EDIT_ROLES.has(currentUser.role)) {
      throw new ForbiddenException("You cannot manage non-conformities.");
    }
  }

  private async getNcr(client: PoolClient, projectId: string, ncrId: string) {
    const result = await client.query<NcrRow>(
      `SELECT
         n.id,
         n.project_id,
         n.reference,
         n.title,
         n.description,
         n.severity,
         n.status,
         n.assigned_to,
         n.deadline,
         n.evidence_url,
         n.created_by,
         n.closed_by,
         n.closed_at,
         n.created_at,
         n.updated_at,
         COUNT(np.id)::int AS photo_count
       FROM ncr n
       LEFT JOIN ncr_photos np ON np.ncr_id = n.id
       WHERE n.project_id = $1
         AND n.id = $2
       GROUP BY n.id
       LIMIT 1`,
      [projectId, ncrId],
    );

    if (!result.rowCount) {
      throw new NotFoundException("Non-conformity not found.");
    }

    return result.rows[0];
  }

  private async generateReference(client: PoolClient, projectId: string) {
    const year = new Date().getUTCFullYear();
    const prefix = `NC-${year}`;
    const result = await client.query<{ total: string }>(
      `SELECT COUNT(*)::int AS total
       FROM ncr
       WHERE project_id = $1
         AND reference LIKE $2`,
      [projectId, `${prefix}%`],
    );

    const sequence = Number(result.rows[0]?.total ?? 0) + 1;
    return `${prefix}-${String(sequence).padStart(3, "0")}`;
  }

  private async insertNcrPhotos(
    client: PoolClient,
    ncrId: string,
    photos: Array<{ fileKey: string; fileUrl: string }>,
  ) {
    for (const photo of photos) {
      if (!photo.fileKey?.trim() || !photo.fileUrl?.trim()) {
        throw new BadRequestException("Each NCR photo requires a file key and file URL.");
      }

      await client.query(
        `INSERT INTO ncr_photos (id, ncr_id, file_url, file_key)
         VALUES ($1, $2, $3, $4)`,
        [uuidv4(), ncrId, photo.fileUrl.trim(), photo.fileKey.trim()],
      );
    }
  }

  private async countNcrPhotos(client: PoolClient, ncrId: string) {
    const result = await client.query<{ total: string }>(
      `SELECT COUNT(*)::int AS total
       FROM ncr_photos
       WHERE ncr_id = $1`,
      [ncrId],
    );

    return Number(result.rows[0]?.total ?? 0);
  }

  private async sendNcrAssignedEmails(
    client: PoolClient,
    currentUser: AuthenticatedUser,
    projectName: string,
    ncr: NcrRow,
    assignedTo: string,
    ncrId: string,
  ) {
    const recipients = await this.siteScope.listActiveUsersByIds(
      client,
      currentUser.tenantId,
      [assignedTo],
    );

    for (const recipient of recipients) {
      await this.mailService.sendNcrAssignedEmail({
        deadline: ncr.deadline ? String(ncr.deadline) : null,
        ncrLink: `/site?ncrId=${ncrId}`,
        projectName,
        recipientEmail: recipient.email,
        recipientName: recipient.fullName,
        reference: String(ncr.reference ?? ""),
        title: String(ncr.title ?? ""),
      });
    }
  }

  private async sendNcrClosedEmails(
    client: PoolClient,
    currentUser: AuthenticatedUser,
    projectName: string,
    ncr: NcrRow,
    ncrId: string,
  ) {
    const recipients = await this.siteScope.listActiveUsersByIds(
      client,
      currentUser.tenantId,
      [String(ncr.created_by)],
    );

    for (const recipient of recipients) {
      await this.mailService.sendNcrClosedEmail({
        ncrLink: `/site?ncrId=${ncrId}`,
        projectName,
        recipientEmail: recipient.email,
        recipientName: recipient.fullName,
        reference: String(ncr.reference ?? ""),
        title: String(ncr.title ?? ""),
      });
    }
  }

  private toDateOnly(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private mapNcrPhotoRow(row: NcrRow) {
    return {
      id: row.id,
      fileUrl: row.file_url,
      fileKey: row.file_key,
      uploadedAt: row.uploaded_at,
    };
  }

  private mapNcrRow(row: NcrRow, photoCountOverride?: number) {
    return {
      id: row.id,
      projectId: row.project_id,
      reference: row.reference,
      title: row.title,
      description: row.description ?? "",
      severity: row.severity ?? NcrSeverity.medium,
      status: row.status ?? NcrStatus.open,
      assignedTo: row.assigned_to,
      deadline: row.deadline,
      evidenceUrl: row.evidence_url,
      createdBy: row.created_by,
      closedBy: row.closed_by,
      closedAt: row.closed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      photoCount:
        photoCountOverride ??
        Number(row.photo_count ?? 0),
    };
  }
}
