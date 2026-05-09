import { Buffer } from "node:buffer";

import { DailyReportStatus, NcrSeverity, NcrStatus, UserRole, WeatherCode } from "@prisma/client";
import type { PoolClient } from "pg";
import { v5 as uuidv5 } from "uuid";

import {
  getPilotSiteModuleSeedByLegacyId,
  type PilotSiteModuleSeed,
} from "@/bootstrap/pilot-site-catalog";
import { pilotProjects, pilotUsers } from "@/bootstrap/pilot-catalog";

const SEED_NAMESPACE = "2e9e80ca-f455-4de2-b2df-47e8c40e83ba";

type TenantUserRecord = {
  email: string;
  id: string;
  role: UserRole;
};

type SeededPhotoRecord = {
  fileKey: string;
  fileUrl: string;
  id: string;
};

const userSeedByName = new Map(
  pilotUsers.map((user) => [normalizeValue(user.fullName), user]),
);
const projectSeedByBackendId = new Map(
  pilotProjects.map((project) => [project.backendId, project]),
);

export async function seedPilotSiteData(
  client: PoolClient,
  projectBackendId: string,
  projectId: string,
  tenantUsers: TenantUserRecord[],
) {
  const projectSeed = projectSeedByBackendId.get(projectBackendId);
  if (!projectSeed) {
    return;
  }

  const siteSeed = getPilotSiteModuleSeedByLegacyId(projectSeed.legacyId);
  if (!siteSeed) {
    return;
  }

  const tenantUserIdByLegacyId = buildTenantUserIdByLegacyId(tenantUsers);
  const defaultSiteUserId =
    resolveProjectRoleUserId(projectSeed.memberLegacyIds, tenantUserIdByLegacyId, tenantUsers, [
      UserRole.CT,
      UserRole.CP,
      UserRole.ADMIN,
    ]) ?? tenantUsers[0]?.id;
  const defaultApprovalUserId =
    resolveProjectRoleUserId(projectSeed.memberLegacyIds, tenantUserIdByLegacyId, tenantUsers, [
      UserRole.CP,
      UserRole.MO,
      UserRole.ADMIN,
    ]) ?? defaultSiteUserId;

  if (!defaultSiteUserId) {
    return;
  }

  const reportIdsByLegacyId = new Map<string, string>();
  for (const report of [...siteSeed.reports].sort((left, right) =>
    left.date.localeCompare(right.date),
  )) {
    const reportId = await ensureSeededReport(
      client,
      projectId,
      projectSeed.memberLegacyIds,
      tenantUsers,
      tenantUserIdByLegacyId,
      defaultSiteUserId,
      defaultApprovalUserId,
      siteSeed,
      report,
    );
    reportIdsByLegacyId.set(report.id, reportId);
  }

  const photosByLegacyId = new Map<string, SeededPhotoRecord>();
  for (const photo of [...siteSeed.photoLibrary].sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp),
  )) {
    const photoRecord = await ensureSeededPhoto(
      client,
      projectId,
      projectSeed.memberLegacyIds,
      tenantUsers,
      tenantUserIdByLegacyId,
      defaultSiteUserId,
      siteSeed,
      photo,
      reportIdsByLegacyId,
    );
    photosByLegacyId.set(photo.id, photoRecord);
  }

  for (const ncr of siteSeed.ncrs) {
    await ensureSeededNcr(
      client,
      projectId,
      projectSeed.memberLegacyIds,
      tenantUsers,
      tenantUserIdByLegacyId,
      defaultSiteUserId,
      siteSeed,
      ncr,
      photosByLegacyId,
    );
  }
}

async function ensureSeededReport(
  client: PoolClient,
  projectId: string,
  projectMemberLegacyIds: string[],
  tenantUsers: TenantUserRecord[],
  tenantUserIdByLegacyId: Map<string, string>,
  defaultSiteUserId: string,
  defaultApprovalUserId: string | undefined,
  siteSeed: PilotSiteModuleSeed,
  report: PilotSiteModuleSeed["reports"][number],
) {
  const existing = await client.query<{ id: string }>(
    `SELECT id
     FROM daily_reports
     WHERE project_id = $1 AND report_date = $2
     LIMIT 1`,
    [projectId, report.date],
  );

  if (existing.rowCount) {
    return String(existing.rows[0]?.id);
  }

  const reportId = uuidv5(`pilot-site-report:${projectId}:${report.id}`, SEED_NAMESPACE);
  const createdBy =
    resolveDisplayUserId(
      report.author,
      projectMemberLegacyIds,
      tenantUserIdByLegacyId,
      tenantUsers,
      [UserRole.CT, UserRole.CP, UserRole.ADMIN],
    ) ?? defaultSiteUserId;
  const signedBy = report.signedByMoe ? defaultApprovalUserId ?? defaultSiteUserId : null;
  const createdAt = buildSeedDateTime(report.date, "07:30:00");
  const signedAt = report.signedByMoe ? buildSeedDateTime(report.date, "10:00:00") : null;
  const latestDraftDate = normalizeDraftDate(siteSeed.reportDraft.reportDate);

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
      status,
      created_by,
      signed_by,
      signed_at,
      pdf_url,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16, $17
    )`,
    [
      reportId,
      projectId,
      report.date,
      mapLegacyWeather(report.weather),
      report.workforce,
      JSON.stringify([]),
      JSON.stringify(
        siteSeed.lotProgress.map((item) => ({
          lot: item.lot,
          progress: item.progress,
          task: item.task,
        })),
      ),
      report.summary,
      JSON.stringify(
        report.completeness >= 95
          ? [
              {
                action: report.summary,
                severity: report.tone,
                type:
                  report.date === latestDraftDate
                    ? siteSeed.reportDraft.blockers
                    : siteSeed.incidentTemplates[0] ?? "Suivi chantier",
              },
            ]
          : [],
      ),
      report.date === latestDraftDate ? siteSeed.reportDraft.note : report.summary,
      mapLegacyReportStatus(report.status),
      createdBy,
      signedBy,
      signedAt,
      null,
      createdAt,
      signedAt ?? createdAt,
    ],
  );

  return reportId;
}

async function ensureSeededPhoto(
  client: PoolClient,
  projectId: string,
  projectMemberLegacyIds: string[],
  tenantUsers: TenantUserRecord[],
  tenantUserIdByLegacyId: Map<string, string>,
  defaultSiteUserId: string,
  siteSeed: PilotSiteModuleSeed,
  photo: PilotSiteModuleSeed["photoLibrary"][number],
  reportIdsByLegacyId: Map<string, string>,
): Promise<SeededPhotoRecord> {
  const fileKey = `seed/site/photos/${projectId}/${photo.id}.svg`;
  const existing = await client.query<{ file_url: string; file_key: string; id: string }>(
    `SELECT id, file_url, file_key
     FROM photos
     WHERE project_id = $1 AND file_key = $2
     LIMIT 1`,
    [projectId, fileKey],
  );

  if (existing.rowCount) {
    return {
      fileKey: String(existing.rows[0]?.file_key),
      fileUrl: String(existing.rows[0]?.file_url),
      id: String(existing.rows[0]?.id),
    };
  }

  const photoId = uuidv5(`pilot-site-photo:${projectId}:${photo.id}`, SEED_NAMESPACE);
  const reportId = resolvePhotoReportId(siteSeed, photo, reportIdsByLegacyId);
  const uploadedBy =
    resolveDisplayUserId(
      photo.author,
      projectMemberLegacyIds,
      tenantUserIdByLegacyId,
      tenantUsers,
      [UserRole.CT, UserRole.BE, UserRole.CP, UserRole.ADMIN],
    ) ?? defaultSiteUserId;
  const coordinates = parseGeo(photo.geo);
  const fileUrl = buildSeedPhotoSvgDataUrl(photo.title, photo.zone, photo.lot);
  const taskTag = JSON.stringify({
    accent: photo.accent,
    author: photo.author,
    legacyPhotoId: photo.id,
    lot: photo.lot,
    task: photo.task,
    title: photo.title,
  });

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
      reportId,
      projectId,
      fileUrl,
      fileKey,
      fileUrl,
      coordinates?.lat ?? null,
      coordinates?.lng ?? null,
      photo.zone,
      taskTag,
      uploadedBy,
      normalizeTimestamp(photo.timestamp),
    ],
  );

  return {
    fileKey,
    fileUrl,
    id: photoId,
  };
}

async function ensureSeededNcr(
  client: PoolClient,
  projectId: string,
  projectMemberLegacyIds: string[],
  tenantUsers: TenantUserRecord[],
  tenantUserIdByLegacyId: Map<string, string>,
  defaultSiteUserId: string,
  siteSeed: PilotSiteModuleSeed,
  ncr: PilotSiteModuleSeed["ncrs"][number],
  photosByLegacyId: Map<string, SeededPhotoRecord>,
) {
  const existing = await client.query<{ id: string }>(
    `SELECT id
     FROM ncr
     WHERE project_id = $1 AND reference = $2
     LIMIT 1`,
    [projectId, ncr.ref],
  );

  const attachments = resolveNcrAttachments(siteSeed, ncr, photosByLegacyId);
  const assignedTo = resolveDisplayUserId(
    ncr.owner,
    projectMemberLegacyIds,
    tenantUserIdByLegacyId,
    tenantUsers,
    [UserRole.CT, UserRole.CP, UserRole.ADMIN],
  );
  const createdBy = assignedTo ?? defaultSiteUserId;
  const isClosed = mapLegacyNcrStatus(ncr.status) === NcrStatus.closed;
  const ncrId = existing.rowCount
    ? String(existing.rows[0]?.id)
    : uuidv5(`pilot-site-ncr:${projectId}:${ncr.ref}`, SEED_NAMESPACE);

  if (!existing.rowCount) {
    await client.query(
      `INSERT INTO ncr (
        id,
        project_id,
        reference,
        title,
        description,
        severity,
        status,
        assigned_to,
        deadline,
        evidence_url,
        created_by,
        closed_by,
        closed_at,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      )`,
      [
        ncrId,
        projectId,
        ncr.ref,
        ncr.title,
        ncr.description,
        mapLegacyNcrSeverity(ncr.severity),
        mapLegacyNcrStatus(ncr.status),
        assignedTo ?? null,
        ncr.dueDate,
        attachments[0]?.fileUrl ?? null,
        createdBy,
        isClosed ? defaultSiteUserId : null,
        isClosed ? buildSeedDateTime(ncr.dueDate, "16:00:00") : null,
        buildSeedDateTime(ncr.dueDate, "08:00:00"),
        isClosed ? buildSeedDateTime(ncr.dueDate, "16:00:00") : buildSeedDateTime(ncr.dueDate, "08:00:00"),
      ],
    );
  }

  for (const [index, attachment] of attachments.entries()) {
    const existingPhoto = await client.query<{ id: string }>(
      `SELECT id
       FROM ncr_photos
       WHERE ncr_id = $1 AND file_key = $2
       LIMIT 1`,
      [ncrId, attachment.fileKey],
    );

    if (existingPhoto.rowCount) {
      continue;
    }

    await client.query(
      `INSERT INTO ncr_photos (id, ncr_id, file_url, file_key, uploaded_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        uuidv5(`pilot-site-ncr-photo:${ncrId}:${index}:${attachment.fileKey}`, SEED_NAMESPACE),
        ncrId,
        attachment.fileUrl,
        attachment.fileKey,
        buildSeedDateTime(ncr.dueDate, "08:30:00"),
      ],
    );
  }
}

function buildTenantUserIdByLegacyId(tenantUsers: TenantUserRecord[]) {
  const byEmail = new Map(
    tenantUsers.map((user) => [normalizeValue(user.email), user.id]),
  );
  const byLegacyId = new Map<string, string>();

  for (const seedUser of pilotUsers) {
    const tenantUserId = byEmail.get(normalizeValue(seedUser.email));
    if (tenantUserId) {
      byLegacyId.set(seedUser.legacyId, tenantUserId);
    }
  }

  return byLegacyId;
}

function resolveProjectRoleUserId(
  projectMemberLegacyIds: string[],
  tenantUserIdByLegacyId: Map<string, string>,
  tenantUsers: TenantUserRecord[],
  preferredRoles: UserRole[],
) {
  const tenantUserById = new Map(tenantUsers.map((user) => [user.id, user]));

  for (const role of preferredRoles) {
    for (const legacyId of projectMemberLegacyIds) {
      const userId = tenantUserIdByLegacyId.get(legacyId);
      if (!userId) {
        continue;
      }

      const tenantUser = tenantUserById.get(userId);
      if (tenantUser?.role === role) {
        return userId;
      }
    }
  }

  return null;
}

function resolveDisplayUserId(
  displayName: string,
  projectMemberLegacyIds: string[],
  tenantUserIdByLegacyId: Map<string, string>,
  tenantUsers: TenantUserRecord[],
  preferredRoles: UserRole[],
) {
  const normalizedDisplayName = normalizeValue(displayName);
  const directMatch = userSeedByName.get(normalizedDisplayName);

  if (directMatch) {
    return tenantUserIdByLegacyId.get(directMatch.legacyId) ?? null;
  }

  return resolveProjectRoleUserId(
    projectMemberLegacyIds,
    tenantUserIdByLegacyId,
    tenantUsers,
    preferredRoles,
  );
}

function resolvePhotoReportId(
  siteSeed: PilotSiteModuleSeed,
  photo: PilotSiteModuleSeed["photoLibrary"][number],
  reportIdsByLegacyId: Map<string, string>,
) {
  const reportDate = normalizeTimestamp(photo.timestamp).slice(0, 10);
  const matchingReport = siteSeed.reports.find((report) => report.date === reportDate);
  return matchingReport ? reportIdsByLegacyId.get(matchingReport.id) ?? null : null;
}

function resolveNcrAttachments(
  siteSeed: PilotSiteModuleSeed,
  ncr: PilotSiteModuleSeed["ncrs"][number],
  photosByLegacyId: Map<string, SeededPhotoRecord>,
) {
  if (!ncr.photoAttached) {
    return [] as SeededPhotoRecord[];
  }

  const matchingPhoto =
    findBestMatchingPhoto(siteSeed, ncr, photosByLegacyId) ??
    siteSeed.photoLibrary
      .map((photo) => photosByLegacyId.get(photo.id) ?? null)
      .find((photo): photo is SeededPhotoRecord => photo !== null);

  return matchingPhoto ? [matchingPhoto] : [];
}

function findBestMatchingPhoto(
  siteSeed: PilotSiteModuleSeed,
  ncr: PilotSiteModuleSeed["ncrs"][number],
  photosByLegacyId: Map<string, SeededPhotoRecord>,
) {
  const haystack = normalizeValue(`${ncr.title} ${ncr.description} ${ncr.owner}`);
  const scored = siteSeed.photoLibrary
    .map((photo) => {
      const photoRecord = photosByLegacyId.get(photo.id);
      if (!photoRecord) {
        return null;
      }

      let score = 0;
      for (const token of tokenize(`${photo.title} ${photo.lot} ${photo.task} ${photo.zone}`)) {
        if (haystack.includes(token)) {
          score += token.length > 5 ? 2 : 1;
        }
      }

      return { photo: photoRecord, score };
    })
    .filter((item): item is { photo: SeededPhotoRecord; score: number } => item !== null)
    .sort((left, right) => right.score - left.score);

  return scored.find((item) => item.score > 0)?.photo ?? null;
}

function tokenize(value: string) {
  return normalizeValue(value)
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 3);
}

function mapLegacyWeather(value: string) {
  switch (normalizeValue(value)) {
    case "ensoleille":
      return WeatherCode.sunny;
    case "pluie":
      return WeatherCode.rain;
    case "vent fort":
      return WeatherCode.strong_wind;
    case "nuageux":
    default:
      return WeatherCode.cloudy;
  }
}

function mapLegacyReportStatus(value: string) {
  switch (normalizeValue(value)) {
    case "signe":
      return DailyReportStatus.signed;
    case "soumis":
      return DailyReportStatus.pending_signature;
    case "a completer":
    default:
      return DailyReportStatus.draft;
  }
}

function mapLegacyNcrSeverity(value: string) {
  switch (normalizeValue(value)) {
    case "critique":
      return NcrSeverity.high;
    case "mineure":
      return NcrSeverity.low;
    case "majeure":
    default:
      return NcrSeverity.medium;
  }
}

function mapLegacyNcrStatus(value: string) {
  switch (normalizeValue(value)) {
    case "levee":
      return NcrStatus.closed;
    case "validation":
      return NcrStatus.in_progress;
    case "planifiee":
    case "en cours":
    default:
      return NcrStatus.open;
  }
}

function normalizeDraftDate(value: string) {
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [day, month, year] = value.split("/");
    return `${year}-${month}-${day}`;
  }

  return value.slice(0, 10);
}

function normalizeTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function buildSeedDateTime(date: string, time: string) {
  return `${date}T${time}.000Z`;
}

function parseGeo(value: string) {
  const [latRaw, lngRaw] = value.split(",").map((part) => part.trim());
  const lat = Number(latRaw);
  const lng = Number(lngRaw);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

function buildSeedPhotoSvgDataUrl(title: string, zone: string, lot: string) {
  const safeTitle = escapeSvgText(title);
  const safeZone = escapeSvgText(zone);
  const safeLot = escapeSvgText(lot);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
      <rect width="1200" height="800" fill="#111827" />
      <rect x="36" y="36" width="1128" height="728" rx="28" fill="#1f2937" stroke="#374151" stroke-width="4" />
      <text x="72" y="132" fill="#f9fafb" font-size="44" font-family="Arial, sans-serif">${safeTitle}</text>
      <text x="72" y="194" fill="#d1d5db" font-size="26" font-family="Arial, sans-serif">Zone: ${safeZone}</text>
      <text x="72" y="238" fill="#d1d5db" font-size="26" font-family="Arial, sans-serif">Lot: ${safeLot}</text>
      <rect x="72" y="294" width="1056" height="398" rx="20" fill="#0f172a" stroke="#475569" stroke-width="3" stroke-dasharray="10 12" />
      <text x="600" y="515" fill="#94a3b8" font-size="32" text-anchor="middle" font-family="Arial, sans-serif">Photo chantier pilote BNAA</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
