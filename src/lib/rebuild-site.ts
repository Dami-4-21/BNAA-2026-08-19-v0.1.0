import type {
  SiteLotProgressRecord,
  SiteModuleData,
  SiteNcrBaseRecord,
  SiteReportDraft,
  SiteReportRecord,
} from "@/lib/backend/types";
import { findPilotUserCompatibilityByBackendId } from "@/lib/server/pilot-seed";
import {
  fetchRebuildProjectMembers,
  getRebuildApiUrl,
  resolveRebuildProjectForLegacyId,
} from "@/lib/rebuild-auth";

type RebuildWeatherCode = "cloudy" | "rain" | "strong_wind" | "sunny";
type RebuildReportStatus = "draft" | "pending_signature" | "signed";

type RebuildReport = {
  id: string;
  reportDate: string;
  weather: RebuildWeatherCode;
  workforceCount: number;
  workforceBreakdown: Array<{ count?: number; label?: string; role?: string }>;
  progressByLot: Array<{ lot?: string; progress?: number; task?: string }>;
  activities: string;
  incidents: Array<{ action?: string; severity?: string; type?: string }>;
  notes: string;
  status: RebuildReportStatus;
  createdBy: string;
  signedBy?: string | null;
  signedAt?: string | null;
  pdfUrl?: string | null;
  photoCount: number;
  createdAt: string;
  updatedAt: string;
};

type RebuildReportsPayload = {
  items: RebuildReport[];
};

type RebuildProjectMember = NonNullable<
  Awaited<ReturnType<typeof fetchRebuildProjectMembers>>
>[number];

type ReportMutationAction =
  | "create-report"
  | "mark-pdf-ready"
  | "sign-report"
  | "update-report";

type ReportFormState = {
  activities: string;
  incidents: string;
  note: string;
  progressByLot: Array<{
    lot: string;
    progress: number;
    task: string;
    tone?: SiteLotProgressRecord["tone"];
  }>;
  reportDate: string;
  weather: string;
  workforceCount: number;
};

const weatherToLegacy: Record<RebuildWeatherCode, string> = {
  sunny: "Ensoleille",
  cloudy: "Nuageux",
  rain: "Pluie",
  strong_wind: "Vent fort",
};

const weatherToRebuild: Record<string, RebuildWeatherCode> = {
  ensoleille: "sunny",
  nuageux: "cloudy",
  pluie: "rain",
  "vent fort": "strong_wind",
  sunny: "sunny",
  cloudy: "cloudy",
  rain: "rain",
  strong_wind: "strong_wind",
};

const severityToLegacy: Record<string, string> = {
  low: "Mineure",
  medium: "Majeure",
  high: "Critique",
};

const statusToLegacy: Record<RebuildReportStatus, { status: string; tone: SiteReportRecord["tone"] }> = {
  draft: { status: "A completer", tone: "warning" },
  pending_signature: { status: "Pret validation", tone: "primary" },
  signed: { status: "Valide", tone: "success" },
};

export function shouldUseRebuildSiteBridge() {
  return process.env.BNAASAAS_REBUILD_SITE_ENABLED === "true";
}

export async function buildRebuildSitePayload(
  accessToken: string,
  legacyProjectId: string,
  legacyPayload: SiteModuleData,
) {
  const resolvedProject = await resolveRebuildProjectForLegacyId(accessToken, legacyProjectId);
  if (!resolvedProject) {
    return null;
  }

  const [rebuildReports, projectMembers] = await Promise.all([
    fetchRebuildReports(accessToken, resolvedProject.id),
    fetchRebuildProjectMembers(accessToken, resolvedProject.id),
  ]);

  if (!rebuildReports) {
    return null;
  }

  const userLookup = buildRebuildUserLookup(projectMembers);
  const rebuildMappedReports = rebuildReports.map((report) =>
    mapRebuildReportToLegacy(report, legacyProjectId, legacyPayload.lotProgress, userLookup),
  );
  const reports = mergeReportsByDate(rebuildMappedReports, legacyPayload.reports);
  const lotProgress = deriveLotProgress(reports, legacyPayload.lotProgress);
  const overviewKpis = deriveOverviewKpis(reports, legacyPayload.ncrs, lotProgress);
  const signatureQueue = deriveSignatureQueue(reports);
  const reportDraft = deriveReportDraft(reports[0], lotProgress, legacyPayload.reportDraft);

  return {
    ...legacyPayload,
    lotProgress,
    overview: {
      ...legacyPayload.overview,
      kpis: overviewKpis,
    },
    reports,
    reportDraft,
    signatureQueue,
  } satisfies SiteModuleData;
}

export async function mutateRebuildSiteReports(
  accessToken: string,
  legacyProjectId: string,
  action: ReportMutationAction,
  payload: Record<string, unknown>,
) {
  const resolvedProject = await resolveRebuildProjectForLegacyId(accessToken, legacyProjectId);
  if (!resolvedProject) {
    return false;
  }

  switch (action) {
    case "create-report": {
      const formState = payload.formState as ReportFormState | undefined;
      if (!formState) {
        return false;
      }
      return await callRebuildJson(`/api/v1/projects/${resolvedProject.id}/reports`, accessToken, {
        method: "POST",
        body: JSON.stringify(mapFormStateToRebuildReportPayload(formState)),
      });
    }
    case "update-report": {
      const compatReportId = String(payload.reportId ?? "");
      const formState = payload.formState as ReportFormState | undefined;
      if (!compatReportId || !formState) {
        return false;
      }
      const backendReportId = await resolveBackendReportId(accessToken, legacyProjectId, compatReportId);
      if (!backendReportId) {
        return false;
      }
      return await callRebuildJson(
        `/api/v1/projects/${resolvedProject.id}/reports/${backendReportId}`,
        accessToken,
        {
          method: "PUT",
          body: JSON.stringify(mapFormStateToRebuildReportPayload(formState)),
        },
      );
    }
    case "mark-pdf-ready": {
      const compatReportId = String(payload.reportId ?? "");
      const backendReportId = await resolveBackendReportId(accessToken, legacyProjectId, compatReportId);
      if (!backendReportId) {
        return false;
      }
      return await callRebuildJson(
        `/api/v1/projects/${resolvedProject.id}/reports/${backendReportId}/prepare`,
        accessToken,
        { method: "POST" },
      );
    }
    case "sign-report": {
      const compatReportId = String(payload.reportId ?? "");
      const backendReportId = await resolveBackendReportId(accessToken, legacyProjectId, compatReportId);
      if (!backendReportId) {
        return false;
      }
      return await callRebuildJson(
        `/api/v1/projects/${resolvedProject.id}/reports/${backendReportId}/sign`,
        accessToken,
        { method: "POST" },
      );
    }
    default:
      return false;
  }
}

export async function downloadRebuildSiteReportPdf(
  accessToken: string,
  legacyProjectId: string,
  compatReportId: string,
) {
  const resolvedProject = await resolveRebuildProjectForLegacyId(accessToken, legacyProjectId);
  if (!resolvedProject) {
    return null;
  }

  const backendReportId = await resolveBackendReportId(accessToken, legacyProjectId, compatReportId);
  if (!backendReportId) {
    return null;
  }

  const response = await fetchRebuildResponse(
    `/api/v1/projects/${resolvedProject.id}/reports/${backendReportId}/pdf`,
    accessToken,
  );

  if (!response?.ok) {
    return null;
  }

  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    fileName: extractFileName(response.headers.get("content-disposition")) ?? `${compatReportId}.pdf`,
  };
}

function mapRebuildReportToLegacy(
  report: RebuildReport,
  legacyProjectId: string,
  legacyLotProgress: SiteLotProgressRecord[],
  userLookup: Map<string, { email: string; fullName: string }>,
): SiteReportRecord {
  const compatibilityAuthor = findPilotUserCompatibilityByBackendId(String(report.createdBy));
  const compatibilitySigner =
    report.signedBy ? findPilotUserCompatibilityByBackendId(String(report.signedBy)) : null;
  const rebuildAuthor = userLookup.get(String(report.createdBy));
  const rebuildSigner = report.signedBy ? userLookup.get(String(report.signedBy)) : null;
  const completeness = calculateCompleteness(report);
  const progressByLot = normalizeReportProgress(report.progressByLot).map((item) => {
    const matchingLot = legacyLotProgress.find(
      (entry) => entry.lot === String(item.lot ?? "") && entry.task === String(item.task ?? ""),
    );
    const progress = Number(item.progress ?? 0);
    const planned = matchingLot?.planned ?? progress;
    return {
      lot: String(item.lot ?? matchingLot?.lot ?? "Lot"),
      progress,
      task: String(item.task ?? matchingLot?.task ?? "Tache"),
      tone: resolveProgressTone(progress, planned),
    };
  });
  const mappedStatus =
    report.status === "draft" && completeness >= 95
      ? { status: "Soumis", tone: "primary" as const }
      : statusToLegacy[report.status];
  const pdfReady = report.status !== "draft";
  const compatId = buildCompatReportId(report.id);

  return {
    id: compatId,
    date: String(report.reportDate),
    weather: weatherToLegacy[report.weather] ?? String(report.weather),
    workforce: Number(report.workforceCount ?? 0),
    progress: resolveProgressAverage(progressByLot),
    author:
      compatibilityAuthor?.name ??
      rebuildAuthor?.fullName ??
      rebuildAuthor?.email ??
      String(report.createdBy),
    status: mappedStatus.status,
    tone: mappedStatus.tone,
    summary: summarizeActivities(report.activities),
    completeness,
    pdfReady,
    signedByCt: true,
    signedByMoe: report.status === "signed",
    ctSignatureAt: formatDateTimeLabel(report.createdAt),
    ctSignatureBy:
      compatibilityAuthor?.name ??
      rebuildAuthor?.fullName ??
      rebuildAuthor?.email ??
      String(report.createdBy),
    moeSignatureAt: report.signedAt ? formatDateTimeLabel(report.signedAt) : undefined,
    moeSignatureBy:
      compatibilitySigner?.name ??
      rebuildSigner?.fullName ??
      rebuildSigner?.email ??
      (report.signedBy ? String(report.signedBy) : undefined),
    completedLots: progressByLot.map((item) => item.task).filter(Boolean),
    blockers: formatIncidentLines(report.incidents),
    note: report.notes,
    incidents: formatIncidentLines(report.incidents),
    activities: report.activities,
    progressByLot,
    pdfUrl: pdfReady
      ? `/api/projects/${legacyProjectId}/site/reports/${compatId}/pdf`
      : undefined,
  };
}

function deriveLotProgress(
  reports: SiteReportRecord[],
  legacyLotProgress: SiteLotProgressRecord[],
) {
  const latestReport = reports[0];
  if (!latestReport?.progressByLot?.length) {
    return legacyLotProgress;
  }

  return latestReport.progressByLot.map((item) => {
    const matchingLot = legacyLotProgress.find(
      (entry) => entry.lot === item.lot && entry.task === item.task,
    );
    const planned = matchingLot?.planned ?? item.progress;
    return {
      lot: item.lot,
      task: item.task,
      progress: item.progress,
      planned,
      owner: matchingLot?.owner ?? "Equipe terrain",
      tone: resolveProgressTone(item.progress, planned),
    } satisfies SiteLotProgressRecord;
  });
}

function deriveOverviewKpis(
  reports: SiteReportRecord[],
  ncrs: SiteNcrBaseRecord[],
  lotProgress: SiteLotProgressRecord[],
) {
  const totalReports = reports.length;
  const averageCompleteness = totalReports
    ? Math.round(reports.reduce((total, report) => total + report.completeness, 0) / totalReports)
    : 0;
  const openNcrs = ncrs.filter((item) => item.status !== "Levee");
  const avgLiftDelay = openNcrs.length
    ? (
        openNcrs.reduce((total, item) => total + diffInDays(item.dueDate), 0) /
        openNcrs.length
      ).toFixed(1)
    : "0.0";
  const driftDays = Math.round(
    lotProgress.reduce((total, item) => total + (Number(item.progress ?? 0) - Number(item.planned ?? 0)), 0) /
      Math.max(lotProgress.length, 1),
  );

  return [
    {
      label: "Conformite RJC",
      value: `${averageCompleteness}%`,
      helper: `${Math.max(totalReports - Math.round((averageCompleteness / 100) * totalReports), 0)} rapports incomplets sur ${totalReports}`,
      tone: averageCompleteness >= 95 ? "success" : "warning",
    },
    {
      label: "FNC ouvertes",
      value: `${openNcrs.length}`,
      helper: `${openNcrs.filter((item) => item.severity === "Critique").length} critiques en suivi`,
      tone: openNcrs.length > 0 ? "danger" : "success",
    },
    {
      label: "Delai moyen de levee",
      value: `${avgLiftDelay} j`,
      helper: "Mesure sur les fiches en cours",
      tone: Number(avgLiftDelay) > 3 ? "warning" : "success",
    },
    {
      label: "Derive planning",
      value: `${driftDays >= 0 ? "+" : ""}${driftDays} j`,
      helper: "Moyenne du reel vs prevu par lot",
      tone: driftDays > 0 ? "primary" : driftDays < -2 ? "danger" : "success",
    },
  ] satisfies SiteModuleData["overview"]["kpis"];
}

function deriveSignatureQueue(reports: SiteReportRecord[]) {
  const latestReport = reports[0];
  if (!latestReport) {
    return [
      {
        role: "Conducteur de travaux",
        state: "En attente",
        note: "Aucun rapport disponible",
        tone: "warning",
      },
      {
        role: "Maitre d'oeuvre",
        state: "En attente",
        note: "Aucun rapport disponible",
        tone: "warning",
      },
      {
        role: "Archivage PDF",
        state: "En attente",
        note: "Aucun PDF a produire",
        tone: "warning",
      },
    ] satisfies SiteModuleData["signatureQueue"];
  }

  return [
    {
      role: "Conducteur de travaux",
      state: latestReport.signedByCt ? "Signe" : "En attente",
      note: latestReport.signedByCt
        ? `${latestReport.id} signe par ${latestReport.ctSignatureBy ?? latestReport.author}${latestReport.ctSignatureAt ? ` le ${latestReport.ctSignatureAt}` : ""}`
        : `Dernier RJC ${latestReport.id} - signature attendue`,
      tone: latestReport.signedByCt ? "success" : "warning",
    },
    {
      role: "Maitre d'oeuvre",
      state: latestReport.signedByMoe ? "Signe" : "En attente",
      note: latestReport.signedByMoe
        ? `${latestReport.id} valide par ${latestReport.moeSignatureBy ?? "l'approbateur"}${latestReport.moeSignatureAt ? ` le ${latestReport.moeSignatureAt}` : ""}`
        : `Rapport ${latestReport.id} a valider cote projet`,
      tone: latestReport.signedByMoe ? "success" : "warning",
    },
    {
      role: "Archivage PDF",
      state: latestReport.pdfReady ? "Pret" : "En attente",
      note: latestReport.pdfReady
        ? `Generation prete pour ${latestReport.id}${latestReport.signedByMoe ? " et archivee apres validation" : ""}`
        : `Generation en attente pour ${latestReport.id}`,
      tone: latestReport.pdfReady ? "primary" : "warning",
    },
  ] satisfies SiteModuleData["signatureQueue"];
}

function deriveReportDraft(
  latestReport: SiteReportRecord | undefined,
  lotProgress: SiteLotProgressRecord[],
  fallbackDraft: SiteReportDraft,
) {
  if (!latestReport) {
    return {
      ...fallbackDraft,
      reportDate: normalizeReportDateForInput(fallbackDraft.reportDate),
    };
  }

  return {
    reportDate: normalizeReportDateForInput(latestReport.date),
    weather: latestReport.weather,
    workforce: latestReport.workforce,
    completedLots:
      latestReport.completedLots && latestReport.completedLots.length > 0
        ? latestReport.completedLots
        : lotProgress.map((item) => item.task),
    blockers: latestReport.blockers ?? "",
    note: latestReport.note ?? "",
  } satisfies SiteReportDraft;
}

async function fetchRebuildReports(accessToken: string, rebuildProjectId: string) {
  const payload = await callRebuildJson<RebuildReportsPayload>(
    `/api/v1/projects/${rebuildProjectId}/reports`,
    accessToken,
  );

  return payload?.items ?? null;
}

async function resolveBackendReportId(
  accessToken: string,
  legacyProjectId: string,
  compatReportId: string,
) {
  const resolvedProject = await resolveRebuildProjectForLegacyId(accessToken, legacyProjectId);
  if (!resolvedProject) {
    return null;
  }

  const reports = await fetchRebuildReports(accessToken, resolvedProject.id);
  const report = reports?.find((item) => buildCompatReportId(item.id) === compatReportId);
  return report?.id ?? null;
}

function mapFormStateToRebuildReportPayload(formState: ReportFormState) {
  return {
    reportDate: normalizeReportDateForInput(formState.reportDate),
    weather: mapWeatherToRebuild(formState.weather),
    workforceCount: Number(formState.workforceCount ?? 0),
    workforceBreakdown: [],
    progressByLot: formState.progressByLot.map((item) => ({
      lot: item.lot,
      progress: Number(item.progress ?? 0),
      task: item.task,
    })),
    activities: formState.activities.trim(),
    incidents: parseIncidentInput(formState.incidents),
    notes: formState.note.trim(),
  };
}

function calculateCompleteness(report: RebuildReport) {
  let score = 40;

  if (Number(report.workforceCount ?? 0) > 0) {
    score += 20;
  }

  if (String(report.activities ?? "").trim().length > 20) {
    score += 25;
  }

  if (formatIncidentLines(report.incidents).trim().length > 5) {
    score += 15;
  }

  return Math.min(score, 100);
}

function resolveProgressAverage(progressByLot: Array<{ progress: number }>) {
  if (!progressByLot.length) {
    return 0;
  }

  return Math.round(
    progressByLot.reduce((total, item) => total + Number(item.progress ?? 0), 0) /
      progressByLot.length,
  );
}

function resolveProgressTone(progress: number, planned: number) {
  const delta = Number(progress ?? 0) - Number(planned ?? progress);
  if (delta >= 0) {
    return "success" as const;
  }
  if (Math.abs(delta) >= 5) {
    return "danger" as const;
  }
  return "warning" as const;
}

function summarizeActivities(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean) ?? "Rapport terrain soumis";
}

function buildRebuildUserLookup(projectMembers: RebuildProjectMember[] | null) {
  const lookup = new Map<string, { email: string; fullName: string }>();

  for (const member of projectMembers ?? []) {
    lookup.set(String(member.userId), {
      email: member.email,
      fullName: member.fullName,
    });
  }

  return lookup;
}

function mergeReportsByDate(rebuildReports: SiteReportRecord[], legacyReports: SiteReportRecord[]) {
  const reportsByDate = new Map<string, SiteReportRecord>();

  for (const report of legacyReports) {
    reportsByDate.set(report.date, report);
  }

  for (const report of rebuildReports) {
    reportsByDate.set(report.date, report);
  }

  return Array.from(reportsByDate.values()).sort((left, right) =>
    right.date.localeCompare(left.date),
  );
}

function normalizeReportProgress(
  value: RebuildReport["progressByLot"] | unknown,
): RebuildReport["progressByLot"] {
  return Array.isArray(value) ? value : [];
}

function parseIncidentInput(value: string) {
  return value
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
    .map((type) => ({ type }));
}

function formatIncidentLines(incidents: Array<{ action?: string; severity?: string; type?: string }> | unknown) {
  return (Array.isArray(incidents) ? incidents : [])
    .map((incident) =>
      [incident.type, incident.severity ? `(${severityToLegacy[incident.severity] ?? incident.severity})` : "", incident.action]
        .filter(Boolean)
        .join(" "),
    )
    .join("\n");
}

function buildCompatReportId(backendId: string) {
  const compact = backendId.replace(/-/g, "").toUpperCase();
  return `RJC-${compact.slice(-8)}`;
}

function normalizeReportDateForInput(value: string) {
  return value.includes("/") ? value.split("/").reverse().join("-") : value;
}

function mapWeatherToRebuild(value: string): RebuildWeatherCode {
  const normalized = value.trim().toLowerCase();
  return weatherToRebuild[normalized] ?? "cloudy";
}

function formatDateTimeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function diffInDays(targetDate: string) {
  const target = new Date(targetDate);
  if (Number.isNaN(target.getTime())) {
    return 0;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - target.getTime()) / 86_400_000);
}

async function callRebuildJson<T = { item?: unknown }>(
  path: string,
  accessToken: string,
  options?: RequestInit,
) {
  const response = await fetchRebuildResponse(path, accessToken, options);
  if (!response?.ok) {
    return null;
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

async function fetchRebuildResponse(
  path: string,
  accessToken: string,
  options?: RequestInit,
) {
  const apiUrl = getRebuildApiUrl();

  if (!apiUrl || !accessToken) {
    return null;
  }

  try {
    return await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

function extractFileName(contentDisposition: string | null) {
  if (!contentDisposition) {
    return null;
  }

  const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
  return match?.[1] ?? null;
}
