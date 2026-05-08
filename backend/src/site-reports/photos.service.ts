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
import { CreatePhotoDto } from "@/site-reports/dto/create-photo.dto";
import { SiteScopeService } from "@/site-reports/site-scope.service";

const PHOTO_EDIT_ROLES = new Set<UserRole>([UserRole.ADMIN, UserRole.CP, UserRole.CT]);
type PhotoRow = Record<string, unknown>;

@Injectable()
export class PhotosService {
  constructor(private readonly siteScope: SiteScopeService) {}

  async list(currentUser: AuthenticatedUser, projectId: string, reportId?: string) {
    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      const result = await client.query<PhotoRow>(
        `SELECT
           p.id,
           p.report_id,
           p.project_id,
           p.file_url,
           p.file_key,
           p.thumbnail_url,
           p.gps_lat,
           p.gps_lng,
           p.location_label,
           p.task_tag,
           p.uploaded_by,
           p.taken_at,
           dr.report_date
         FROM photos p
         LEFT JOIN daily_reports dr ON dr.id = p.report_id
         WHERE p.project_id = $1
           AND p.is_deleted = false
           AND ($2::uuid IS NULL OR p.report_id = $2::uuid)
         ORDER BY p.taken_at DESC`,
        [projectId, reportId ?? null],
      );

      return {
        items: result.rows.map((row) => this.mapPhotoRow(row)),
      };
    });
  }

  async create(currentUser: AuthenticatedUser, projectId: string, payload: CreatePhotoDto) {
    this.assertCanManagePhotos(currentUser);

    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      if (payload.reportId) {
        await this.assertReportExists(client, projectId, payload.reportId);
      }

      const photoId = uuidv4();
      const takenAt = payload.takenAt ? new Date(payload.takenAt) : new Date();
      if (Number.isNaN(takenAt.getTime())) {
        throw new BadRequestException("Invalid photo timestamp.");
      }

      await client.query(
        `INSERT INTO photos (
          id,
          report_id,
          project_id,
          file_url,
          file_key,
          thumbnail_url,
          gps_lat,
          gps_lng,
          location_label,
          task_tag,
          uploaded_by,
          taken_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        )`,
        [
          photoId,
          payload.reportId ?? null,
          projectId,
          payload.fileUrl,
          payload.fileKey,
          payload.thumbnailUrl ?? null,
          payload.gpsLat ?? null,
          payload.gpsLng ?? null,
          payload.locationLabel?.trim() || null,
          payload.taskTag?.trim() || null,
          currentUser.sub,
          takenAt.toISOString(),
        ],
      );

      const created = await client.query<PhotoRow>(
        `SELECT
           p.id,
           p.report_id,
           p.project_id,
           p.file_url,
           p.file_key,
           p.thumbnail_url,
           p.gps_lat,
           p.gps_lng,
           p.location_label,
           p.task_tag,
           p.uploaded_by,
           p.taken_at,
           dr.report_date
         FROM photos p
         LEFT JOIN daily_reports dr ON dr.id = p.report_id
         WHERE p.id = $1
         LIMIT 1`,
        [photoId],
      );

      return {
        item: this.mapPhotoRow(created.rows[0]),
      };
    });
  }

  private assertCanManagePhotos(currentUser: AuthenticatedUser) {
    if (!PHOTO_EDIT_ROLES.has(currentUser.role)) {
      throw new ForbiddenException("You cannot add site photos.");
    }
  }

  private async assertReportExists(client: PoolClient, projectId: string, reportId: string) {
    const result = await client.query<{ id: string }>(
      `SELECT id
       FROM daily_reports
       WHERE id = $1 AND project_id = $2
       LIMIT 1`,
      [reportId, projectId],
    );

    if (!result.rowCount) {
      throw new NotFoundException("Report not found for this project.");
    }
  }

  private mapPhotoRow(row: PhotoRow) {
    return {
      id: row.id,
      reportId: row.report_id,
      projectId: row.project_id,
      fileUrl: row.file_url,
      fileKey: row.file_key,
      thumbnailUrl: row.thumbnail_url,
      gpsLat: row.gps_lat,
      gpsLng: row.gps_lng,
      locationLabel: row.location_label,
      taskTag: row.task_tag,
      uploadedBy: row.uploaded_by,
      takenAt: row.taken_at,
      reportDate: row.report_date ?? null,
    };
  }
}
