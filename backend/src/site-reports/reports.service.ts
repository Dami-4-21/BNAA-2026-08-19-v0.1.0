import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DailyReportStatus, UserRole, WeatherCode } from "@prisma/client";
import type { PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";

import { AuthenticatedUser } from "@/common/types/authenticated-user.interface";
import { NotificationsService } from "@/notifications/notifications.service";
import { PdfService } from "@/pdf/pdf.service";
import { CreateReportDto } from "@/site-reports/dto/create-report.dto";
import { UpdateReportDto } from "@/site-reports/dto/update-report.dto";
import { SiteScopeService } from "@/site-reports/site-scope.service";

const REPORT_EDIT_ROLES = new Set<UserRole>([UserRole.ADMIN, UserRole.CP, UserRole.CT]);
const REPORT_SIGN_ROLES = new Set<UserRole>([UserRole.ADMIN, UserRole.CP, UserRole.MO]);

type ReportRow = Record<string, unknown>;

@Injectable()
export class ReportsService {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pdfService: PdfService,
    private readonly siteScope: SiteScopeService,
  ) {}

  async list(currentUser: AuthenticatedUser, projectId: string) {
    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      const result = await client.query<ReportRow>(
        `SELECT
           dr.id,
           dr.project_id,
           dr.report_date,
           dr.weather,
           dr.workforce_count,
           dr.workforce_breakdown,
           dr.progress_by_lot,
           dr.activities,
           dr.incidents,
           dr.notes,
           dr.status,
           dr.created_by,
           dr.signed_by,
           dr.signed_at,
           dr.pdf_url,
           dr.created_at,
           dr.updated_at,
           COUNT(p.id)::int AS photo_count
         FROM daily_reports dr
         LEFT JOIN photos p
           ON p.report_id = dr.id
          AND p.is_deleted = false
         WHERE dr.project_id = $1
         GROUP BY dr.id
         ORDER BY dr.report_date DESC`,
        [projectId],
      );

      return {
        items: result.rows.map((row) => this.mapReportRow(row)),
      };
    });
  }

  async detail(currentUser: AuthenticatedUser, projectId: string, reportId: string) {
    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      const report = await this.getReport(client, projectId, reportId);

      const photos = await client.query<ReportRow>(
        `SELECT id, file_url, file_key, thumbnail_url, gps_lat, gps_lng, location_label, task_tag, uploaded_by, taken_at
         FROM photos
         WHERE project_id = $1
           AND report_id = $2
           AND is_deleted = false
         ORDER BY taken_at DESC`,
        [projectId, reportId],
      );

      return {
        item: this.mapReportRow(report, photos.rows.length),
        photos: photos.rows.map((row) => this.mapPhotoRow(row)),
      };
    });
  }

  async create(currentUser: AuthenticatedUser, projectId: string, payload: CreateReportDto) {
    this.assertCanEditReport(currentUser);

    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      const existing = await client.query<{ id: string }>(
        `SELECT id
         FROM daily_reports
         WHERE project_id = $1 AND report_date = $2
         LIMIT 1`,
        [projectId, payload.reportDate],
      );

      if (existing.rowCount) {
        throw new ConflictException("A report already exists for this project and date.");
      }

      const reportId = uuidv4();
      await client.query(
        `INSERT INTO daily_reports (
          id,
          project_id,
          report_date,
          weather,
          workforce_count,
          workforce_breakdown,
          progress_by_lot,
          activities,
          incidents,
          notes,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9::jsonb, $10, $11)`,
        [
          reportId,
          projectId,
          payload.reportDate,
          payload.weather ?? null,
          payload.workforceCount,
          JSON.stringify(payload.workforceBreakdown ?? []),
          JSON.stringify(payload.progressByLot ?? []),
          payload.activities?.trim() || null,
          JSON.stringify(payload.incidents ?? []),
          payload.notes?.trim() || null,
          currentUser.sub,
        ],
      );

      const created = await this.getReport(client, projectId, reportId);

      return {
        item: this.mapReportRow(created, 0),
      };
    });
  }

  async update(
    currentUser: AuthenticatedUser,
    projectId: string,
    reportId: string,
    payload: UpdateReportDto,
  ) {
    this.assertCanEditReport(currentUser);

    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      const report = await this.getReport(client, projectId, reportId);
      this.assertMutableReport(report);

      await client.query(
        `UPDATE daily_reports
         SET weather = COALESCE($3, weather),
             workforce_count = COALESCE($4, workforce_count),
             workforce_breakdown = COALESCE($5::jsonb, workforce_breakdown),
             progress_by_lot = COALESCE($6::jsonb, progress_by_lot),
             activities = COALESCE($7, activities),
             incidents = COALESCE($8::jsonb, incidents),
             notes = COALESCE($9, notes),
             updated_at = NOW()
         WHERE id = $1 AND project_id = $2`,
        [
          reportId,
          projectId,
          payload.weather ?? null,
          payload.workforceCount ?? null,
          payload.workforceBreakdown ? JSON.stringify(payload.workforceBreakdown) : null,
          payload.progressByLot ? JSON.stringify(payload.progressByLot) : null,
          payload.activities?.trim() || null,
          payload.incidents ? JSON.stringify(payload.incidents) : null,
          payload.notes?.trim() || null,
        ],
      );

      const updated = await this.getReport(client, projectId, reportId);

      return {
        item: this.mapReportRow(updated),
      };
    });
  }

  async prepare(currentUser: AuthenticatedUser, projectId: string, reportId: string) {
    this.assertCanEditReport(currentUser);

    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      const report = await this.getReport(client, projectId, reportId);
      this.assertMutableReport(report);

      const completeness = this.calculateCompleteness(report);
      if (completeness < 70) {
        throw new BadRequestException(
          "The report is incomplete. Add workforce, activities, incidents, or progress before preparing it.",
        );
      }

      await client.query(
        `UPDATE daily_reports
         SET status = $3,
             updated_at = NOW()
         WHERE id = $1 AND project_id = $2`,
        [reportId, projectId, DailyReportStatus.pending_signature],
      );

      const prepared = await this.getReport(client, projectId, reportId);
      await this.notificationsService.createForProjectRoles(client, {
        projectId,
        roles: [UserRole.CP, UserRole.MO],
        type: "site.report.pending_signature",
        title: "Rapport journalier en attente de signature",
        body: `Le rapport du ${prepared.report_date} est pret pour validation.`,
        link: `/site?reportId=${reportId}`,
        excludeUserIds: [currentUser.sub],
      });

      return {
        item: this.mapReportRow(prepared),
        next: "pending-signature",
      };
    });
  }

  async sign(currentUser: AuthenticatedUser, projectId: string, reportId: string) {
    this.assertCanSignReport(currentUser);

    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      const report = await this.getReport(client, projectId, reportId);

      if (report.status !== DailyReportStatus.pending_signature) {
        throw new BadRequestException("Only reports pending signature can be signed.");
      }

      await client.query(
        `UPDATE daily_reports
         SET status = $3,
             signed_by = $4,
             signed_at = NOW(),
             updated_at = NOW()
         WHERE id = $1 AND project_id = $2`,
        [reportId, projectId, DailyReportStatus.signed, currentUser.sub],
      );

      const signed = await this.getReport(client, projectId, reportId);
      await this.notificationsService.createForUsers(client, {
        userIds: [String(signed.created_by)],
        projectId,
        type: "site.report.signed",
        title: "Rapport journalier signe",
        body: `Le rapport du ${signed.report_date} est signe et archive.`,
        link: `/site?reportId=${reportId}`,
      });

      return {
        item: this.mapReportRow(signed),
        pdfJob: this.pdfService.queueReportPdf(reportId),
      };
    });
  }

  private assertCanEditReport(currentUser: AuthenticatedUser) {
    if (!REPORT_EDIT_ROLES.has(currentUser.role)) {
      throw new ForbiddenException("You cannot create or edit site reports.");
    }
  }

  private assertCanSignReport(currentUser: AuthenticatedUser) {
    if (!REPORT_SIGN_ROLES.has(currentUser.role)) {
      throw new ForbiddenException("You cannot sign site reports.");
    }
  }

  private assertMutableReport(report: ReportRow) {
    if (report.status === DailyReportStatus.signed) {
      throw new BadRequestException("Signed reports are immutable.");
    }
  }

  private calculateCompleteness(report: ReportRow) {
    let score = 0;

    if (Number(report.workforce_count ?? 0) > 0) {
      score += 30;
    }

    if (String(report.activities ?? "").trim().length >= 12) {
      score += 25;
    }

    if (this.parseJsonArray(report.progress_by_lot).length > 0) {
      score += 20;
    }

    if (this.parseJsonArray(report.incidents).length > 0) {
      score += 15;
    }

    if (String(report.notes ?? "").trim().length >= 5) {
      score += 10;
    }

    return score;
  }

  private async getReport(client: PoolClient, projectId: string, reportId: string) {
    const result = await client.query<ReportRow>(
      `SELECT
         dr.id,
         dr.project_id,
         dr.report_date,
         dr.weather,
         dr.workforce_count,
         dr.workforce_breakdown,
         dr.progress_by_lot,
         dr.activities,
         dr.incidents,
         dr.notes,
         dr.status,
         dr.created_by,
         dr.signed_by,
         dr.signed_at,
         dr.pdf_url,
         dr.created_at,
         dr.updated_at,
         COUNT(p.id)::int AS photo_count
       FROM daily_reports dr
       LEFT JOIN photos p
         ON p.report_id = dr.id
        AND p.is_deleted = false
       WHERE dr.project_id = $1
         AND dr.id = $2
       GROUP BY dr.id
       LIMIT 1`,
      [projectId, reportId],
    );

    if (!result.rowCount) {
      throw new NotFoundException("Report not found.");
    }

    return result.rows[0];
  }

  private parseJsonArray(value: unknown) {
    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value === "string" && value.length > 0) {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    return [];
  }

  private mapPhotoRow(row: ReportRow) {
    return {
      id: row.id,
      fileUrl: row.file_url,
      fileKey: row.file_key,
      thumbnailUrl: row.thumbnail_url,
      gpsLat: row.gps_lat,
      gpsLng: row.gps_lng,
      locationLabel: row.location_label,
      taskTag: row.task_tag,
      uploadedBy: row.uploaded_by,
      takenAt: row.taken_at,
    };
  }

  private mapReportRow(row: ReportRow, photoCountOverride?: number) {
    return {
      id: row.id,
      projectId: row.project_id,
      reportDate: row.report_date,
      weather: row.weather ?? WeatherCode.cloudy,
      workforceCount: Number(row.workforce_count ?? 0),
      workforceBreakdown: this.parseJsonArray(row.workforce_breakdown),
      progressByLot: this.parseJsonArray(row.progress_by_lot),
      activities: row.activities ?? "",
      incidents: this.parseJsonArray(row.incidents),
      notes: row.notes ?? "",
      status: row.status,
      createdBy: row.created_by,
      signedBy: row.signed_by,
      signedAt: row.signed_at,
      pdfUrl: row.pdf_url,
      photoCount:
        photoCountOverride ??
        Number(row.photo_count ?? 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
