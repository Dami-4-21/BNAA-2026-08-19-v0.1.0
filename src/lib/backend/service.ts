import { randomUUID } from "node:crypto";

import {
  appUsers,
  canAccessProject,
  getHomePathForRole,
  getPermissionsForRole,
  hasPermission,
  sanitizeUser,
  type AppPermission,
  type AppUser,
  type SafeUser,
  type UserRole,
} from "@/lib/auth";
import { saveUploadedFile } from "@/lib/backend/files";
import { dispatchNotificationEmail as sendNotificationEmail } from "@/lib/backend/mail";
import { buildDailyReportPdf, buildInvoicePdf } from "@/lib/backend/pdf";
import { resolveProjectWeather } from "@/lib/backend/weather";
import { financeVatRegimes } from "@/lib/mock-data";
import { createSessionExpiry, createSessionToken } from "@/lib/backend/session";
import { readDatabase, updateDatabase } from "@/lib/backend/store";
import type {
  AdminPageData,
  DashboardAlert,
  DashboardPageData,
  DatabaseState,
  DocumentFileRecord,
  DocumentRecipientRecord,
  DocumentVersionRecord,
  DocumentsModuleData,
  FinanceModuleData,
  GlobalSearchPayload,
  GlobalSearchResult,
  NotificationRecord,
  NotificationType,
  NotificationsPageData,
  ProjectsPageData,
  ProjectRecord,
  ProjectWorkflowOwnerKey,
  ProjectWorkflowOwnersRecord,
  SessionRecord,
  SitePhotoRecord,
  SiteModuleData,
  UserNotification,
  WorkspacePayload,
} from "@/lib/backend/types";

const todayIso = "2026-04-30";
const nowTimestamp = "2026-04-30T18:00:00.000Z";
const defaultProjectRoles = Array.from(new Set(appUsers.map((user) => user.role))) as AppUser["role"][];
const workflowOwnerRoleMap: Record<ProjectWorkflowOwnerKey, UserRole> = {
  clientApproverId: "Maitre d'ouvrage",
  designLeadId: "Bureau d'etudes",
  financeLeadId: "Comptable",
  projectManagerId: "Chef de projet",
  siteLeadId: "Conductrice travaux",
};
const workflowOwnerLabelMap: Record<ProjectWorkflowOwnerKey, string> = {
  clientApproverId: "Validation client",
  designLeadId: "Referent documents",
  financeLeadId: "Referent finance",
  projectManagerId: "Chef de projet",
  siteLeadId: "Conducteur terrain",
};

class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function assert(condition: unknown, status: number, message: string): asserts condition {
  if (!condition) {
    throw new ApiError(status, message);
  }
}

function diffInDays(from: string, to: string) {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  return Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
}

function toDayMonth(date: string) {
  const [year, month, day] = date.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function toDateTimeLabel(timestamp: string) {
  const [date, time] = timestamp.split("T");
  return `${toDayMonth(date)} ${time.slice(0, 5)}`;
}

function formatRelativeTime(timestamp: string) {
  const deltaMs = new Date(nowTimestamp).getTime() - new Date(timestamp).getTime();
  const deltaMinutes = Math.max(0, Math.round(deltaMs / (1000 * 60)));

  if (deltaMinutes < 1) {
    return "Maintenant";
  }

  if (deltaMinutes < 60) {
    return `Il y a ${deltaMinutes} min`;
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `Il y a ${deltaHours} h`;
  }

  const deltaDays = Math.round(deltaHours / 24);
  if (deltaDays === 1) {
    return "Hier";
  }

  if (deltaDays < 7) {
    return `Il y a ${deltaDays} j`;
  }

  return toDayMonth(timestamp);
}

function notificationToneRank(tone: NotificationRecord["tone"]) {
  switch (tone) {
    case "danger":
      return 0;
    case "warning":
      return 1;
    case "primary":
      return 2;
    case "success":
      return 3;
    default:
      return 4;
  }
}

function channelSupportsEmail(channel: NotificationRecord["channel"]) {
  return channel === "Email" || channel === "In-app + email";
}

function toProjectHealth(progress: number, overdueInvoices: number, unreadDocs: number) {
  if (overdueInvoices > 0) {
    return { health: "Encaissement critique", tone: "danger" as const };
  }

  if (unreadDocs > 0 || progress < 50) {
    return { health: "Attention docs", tone: "warning" as const };
  }

  return { health: "Sous controle", tone: "success" as const };
}

function getSitePhotoUrl(projectId: string, photoId: string) {
  return `/api/projects/${projectId}/site/photos/${photoId}/file`;
}

function getDocumentDownloadUrl(projectId: string, documentId: string) {
  return `/api/projects/${projectId}/documents/${documentId}/file`;
}

function getDocumentVersionDownloadUrl(
  projectId: string,
  documentId: string,
  version: string,
) {
  return `/api/projects/${projectId}/documents/${documentId}/versions/${encodeURIComponent(version)}/file`;
}

function getSiteReportPdfUrl(projectId: string, reportId: string) {
  return `/api/projects/${projectId}/site/reports/${reportId}/pdf`;
}

function getInvoicePdfUrl(projectId: string, invoiceId: string) {
  return `/api/projects/${projectId}/finance/invoices/${invoiceId}/pdf`;
}

function normalizePeriodMonthInput(value: string) {
  const trimmed = value.trim();
  const monthYearMatch = trimmed.match(/^(\d{2})\/(\d{4})$/);
  if (monthYearMatch) {
    const [, month, year] = monthYearMatch;
    return `${year}-${month}-01`;
  }

  const monthInputMatch = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (monthInputMatch) {
    return `${trimmed}-01`;
  }

  return trimmed;
}

function getPhotoAccent(index: number) {
  const accents = [
    "from-sky-500/55 to-violet-300/18",
    "from-amber-400/55 to-orange-300/20",
    "from-emerald-400/55 to-teal-300/20",
    "from-fuchsia-500/45 to-rose-300/20",
  ];

  return accents[index % accents.length] ?? accents[0];
}

function normalizeProjectCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, "-")
    .replace(/--+/g, "-");
}

function parseSetupList(value: string, fallback: string) {
  const entries = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return entries.length > 0 ? entries : [fallback];
}

function normalizeSetupEntries(values: string[], fallback: string) {
  const entries = values
    .map((item) => item.trim())
    .filter(Boolean);

  return entries.length > 0 ? Array.from(new Set(entries)) : [fallback];
}

function applyProjectSetup(
  database: DatabaseState,
  project: ProjectRecord,
  setup: {
    lots: string[];
    memberIds?: string[];
    phases: string[];
    workflowOwners?: Partial<ProjectWorkflowOwnersRecord>;
    zones: string[];
  },
) {
  const memberIds = Array.from(new Set(setup.memberIds ?? project.setup?.memberIds ?? []));
  project.setup = {
    lots: normalizeSetupEntries(setup.lots, "General"),
    memberIds,
    phases: normalizeSetupEntries(setup.phases, "EXE"),
    workflowOwners: normalizeWorkflowOwners(
      database,
      project.summary.id,
      memberIds,
      setup.workflowOwners ?? project.setup?.workflowOwners,
    ),
    zones: normalizeSetupEntries(setup.zones, "Zone principale"),
  };

  project.site.lotProgress = project.setup.lots.map((lot, index) => {
    const existing =
      project.site.lotProgress.find((item) => item.lot === lot) ??
      project.site.lotProgress[index];

    return {
      lot,
      task: existing?.task ?? `Preparation ${lot.toLowerCase()}`,
      progress: existing?.progress ?? 0,
      planned: existing?.planned ?? 0,
      owner: existing?.owner ?? "A affecter",
      tone: existing?.tone ?? (index === 0 ? "primary" : "neutral"),
    };
  });

  project.site.draftPhoto = {
    ...project.site.draftPhoto,
    zone: project.setup.zones[0] ?? "Zone principale",
    lot: project.setup.lots[0] ?? "General",
  };

  project.site.draftNcr = {
    ...project.site.draftNcr,
    owner: resolveWorkflowOwnerName(database, project, "siteLeadId"),
  };

  project.documents.tree = [
    {
      title: project.summary.name,
      nodes: project.setup.lots.map((lot) => ({
        label: lot,
        phases: project.setup.phases,
      })),
    },
  ] as DocumentsModuleData["tree"];

  project.documents.draftVersion = {
    ...project.documents.draftVersion,
    audience: project.setup.lots[0] ?? "Equipe projet",
  };
}

function createEmptySiteModule(setup: {
  lots: string[];
  projectName: string;
  zones: string[];
}): SiteModuleData {
  return {
    overview: {
      weather: {
        label: "A configurer",
        temperature: "--",
        wind: "--",
        rainRisk: "--",
        source: "API meteo Tunisie - en attente de configuration",
      },
      kpis: [
        {
          label: "Conformite RJC",
          value: "0%",
          helper: "Aucun rapport journalier soumis pour le moment",
          tone: "neutral",
        },
        {
          label: "FNC ouvertes",
          value: "0",
          helper: "Le registre qualite demarrera avec les premieres saisies terrain",
          tone: "success",
        },
        {
          label: "Delai moyen de levee",
          value: "0 j",
          helper: "Aucune non-conformite en suivi",
          tone: "neutral",
        },
        {
          label: "Derive planning",
          value: "0 j",
          helper: "Planning initial a parametrer par lot",
          tone: "primary",
        },
      ],
    },
    lotProgress: setup.lots.map((lot, index) => ({
      lot,
      task: `Preparation ${lot.toLowerCase()}`,
      progress: 0,
      planned: 0,
      owner: "A affecter",
      tone: (index === 0 ? "primary" : "neutral") as "primary" | "success" | "warning" | "danger",
    })),
    signatureQueue: [
      {
        role: "Conducteur de travaux",
        state: "En attente",
        note: "Aucun rapport terrain n'a encore ete soumis",
        tone: "warning",
      },
      {
        role: "Maitre d'oeuvre",
        state: "En attente",
        note: "La boucle de validation sera activee au premier RJC",
        tone: "warning",
      },
      {
        role: "Archivage PDF",
        state: "En attente",
        note: "Generation automatique disponible des la premiere saisie",
        tone: "neutral",
      },
    ],
    incidentTemplates: [
      "Retard livraison materiaux",
      "Panne equipement",
      "Validation plan en attente",
      "Acces zone chantier",
    ],
    photoLibrary: [],
    ncrs: [],
    reports: [],
    reportDraft: {
      reportDate: toDayMonth(todayIso),
      weather: "Ensoleille",
      workforce: 0,
      completedLots: [],
      blockers: "",
      note: `Initialisation chantier ${setup.projectName}`,
    },
    draftPhoto: {
      title: `Etat initial ${setup.projectName}`,
      zone: setup.zones[0] ?? "Zone principale",
      lot: setup.lots[0] ?? "General",
      task: "Etat initial",
      geo: "",
    },
    draftNcr: {
      title: "",
      owner: setup.lots[0] ?? "General",
      dueDate: todayIso,
      severity: "Mineure",
      description: "",
      photoAttached: false,
    },
  } as unknown as SiteModuleData;
}

function createEmptyDocumentsModule(setup: {
  formats?: string[];
  lots: string[];
  phases: string[];
  projectName: string;
}): DocumentsModuleData {
  return {
    overview: {
      kpis: [
        {
          label: "Volume documentaire",
          value: "0.0 Go",
          helper: "Aucun fichier publie dans la bibliotheque",
          tone: "neutral",
        },
        {
          label: "Lecture < 48h",
          value: "0%",
          helper: "Les diffusions demarreront avec les premieres revisions",
          tone: "neutral",
        },
        {
          label: "Versions actives",
          value: "0",
          helper: "Bibliotheque en cours de parametrage",
          tone: "neutral",
        },
        {
          label: "Docs non diffuses > 5j",
          value: "0",
          helper: "Aucune diffusion en attente",
          tone: "success",
        },
      ],
      offline: {
        syncedAt: toDateTimeLabel(nowTimestamp),
        cachedFiles: 0,
        coverage: "Cache mobile en attente des premieres revisions",
      },
    },
    tree: [
      {
        title: setup.projectName,
        nodes: setup.lots.map((lot) => ({
          label: lot,
          phases: setup.phases,
        })),
      },
    ],
    files: [],
    recipients: [],
    draftVersion: {
      revision: "Rev.A",
      format: "PDF",
      audience: setup.lots[0] ?? "Equipe projet",
    },
  } as unknown as DocumentsModuleData;
}

function createEmptyFinanceModule(): FinanceModuleData {
  return {
    overview: {
      kpis: [
        {
          label: "DSO",
          value: "0 j",
          helper: "Aucun encaissement client enregistre",
          tone: "neutral",
        },
        {
          label: "Facturation dans les delais",
          value: "0%",
          helper: "Le cycle de facturation commencera apres le premier decompte",
          tone: "neutral",
        },
        {
          label: "Ecart budget / reel",
          value: "0%",
          helper: "Le budget initial sera compare aux couts reels saisis",
          tone: "neutral",
        },
        {
          label: "TVA collectee / declaree",
          value: "0%",
          helper: "Aucune declaration generee pour le moment",
          tone: "neutral",
        },
      ],
      treasuryAlert: "Tresorerie previsionnelle en attente de la premiere facturation.",
    },
    invoices: [],
    payments: [],
    cashflow: [
      { label: "Jan", plannedReceipts: 0, actualReceipts: 0, actualCosts: 0 },
      { label: "Fev", plannedReceipts: 0, actualReceipts: 0, actualCosts: 0 },
      { label: "Mar", plannedReceipts: 0, actualReceipts: 0, actualCosts: 0 },
      { label: "Avr", plannedReceipts: 0, actualReceipts: 0, actualCosts: 0 },
      { label: "Mai", plannedReceipts: 0, actualReceipts: 0, actualCosts: 0 },
    ],
    declaration: {
      month: "Avril 2026",
      collectedTva: 0,
      declaredTva: 0,
      variance: 0,
      status: "En attente",
    },
    defaultVatRegimeId: "standard",
    dmDraft: {
      periodMonth: "2026-04-01",
      progressPct: 0,
      baseAmountHt: 0,
      retentionPct: 5,
      advanceDeduction: 0,
    },
    paymentDraft: {
      amount: "",
      method: "Virement",
      reference: "",
    },
  } as unknown as FinanceModuleData;
}

function buildAdminPayload(database: DatabaseState): AdminPageData {
  return {
    teamMembers: clone(database.teamMembers),
    roleMatrix: clone(database.roleMatrix),
    auditTrail: clone(database.auditTrail),
    users: clone(database.users.map((entry) => sanitizeUser(entry))),
    availableProjects: Object.values(database.projects).map((project) => clone(project.summary)),
    projects: Object.values(database.projects).map((project) => {
      const members = database.users
        .filter((user) => canAccessProject(user, project.summary.id))
        .map((user) => ({
          id: user.id,
          initials: user.initials,
          name: user.name,
          role: user.role,
        }))
        .sort((left, right) => left.name.localeCompare(right.name, "fr"));

      return {
        summary: clone(project.summary),
        setup: clone(project.setup),
        memberCount: members.length,
        members,
      };
    }),
    tenant: clone(database.tenant),
  };
}

function buildSearchText(parts: Array<string | number | undefined | null>) {
  return parts
    .filter((part) => part !== undefined && part !== null)
    .join(" ")
    .toLowerCase();
}

function searchIncludes(haystack: string, needle: string) {
  return haystack.includes(needle);
}

function buildModuleHref(
  path: "/site" | "/documents" | "/finance",
  query: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

function toInvoiceTone(status: string) {
  switch (status) {
    case "Payee":
      return "success" as const;
    case "Litigieuse":
      return "danger" as const;
    case "Brouillon":
      return "warning" as const;
    default:
      return "primary" as const;
  }
}

function getUserAccessibleProjects(database: DatabaseState, user: AppUser | SafeUser) {
  return Object.values(database.projects)
    .map((project) => project.summary)
    .filter((project) => canAccessProject(user, project.id));
}

function buildInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part.trim()[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function createEmptyWorkflowOwners(): ProjectWorkflowOwnersRecord {
  return {
    clientApproverId: "",
    designLeadId: "",
    financeLeadId: "",
    projectManagerId: "",
    siteLeadId: "",
  };
}

function getEligibleWorkflowOwners(
  database: DatabaseState,
  projectId: string,
  memberIds: string[],
  workflowOwnerKey: ProjectWorkflowOwnerKey,
) {
  const expectedRole = workflowOwnerRoleMap[workflowOwnerKey];
  const eligibleIds = new Set(memberIds);

  return database.users.filter((user) => {
    const hasAccess = user.projectIds.includes("*") || eligibleIds.has(user.id);
    if (!hasAccess) {
      return false;
    }

    return user.role === expectedRole || user.role === "Super Admin";
  });
}

function normalizeWorkflowOwners(
  database: DatabaseState,
  projectId: string,
  memberIds: string[],
  draft?: Partial<ProjectWorkflowOwnersRecord>,
) {
  const nextOwners = createEmptyWorkflowOwners();

  (Object.keys(nextOwners) as ProjectWorkflowOwnerKey[]).forEach((key) => {
    const requestedId = draft?.[key] ?? "";
    const eligibleUsers = getEligibleWorkflowOwners(database, projectId, memberIds, key);
    const resolvedUser = eligibleUsers.find((user) => user.id === requestedId) ?? null;
    nextOwners[key] = resolvedUser?.id ?? "";
  });

  return nextOwners;
}

function resolveWorkflowOwner(
  database: DatabaseState,
  project: ProjectRecord,
  workflowOwnerKey: ProjectWorkflowOwnerKey,
) {
  const ownerId = project.setup.workflowOwners?.[workflowOwnerKey];
  if (!ownerId) {
    return null;
  }

  const owner = database.users.find((user) => user.id === ownerId);
  if (!owner) {
    return null;
  }

  return {
    id: owner.id,
    initials: owner.initials,
    label: workflowOwnerLabelMap[workflowOwnerKey],
    name: owner.name,
    role: owner.role,
  };
}

function resolveWorkflowOwnerName(
  database: DatabaseState,
  project: ProjectRecord,
  workflowOwnerKey: ProjectWorkflowOwnerKey,
) {
  return (
    resolveWorkflowOwner(database, project, workflowOwnerKey)?.name ??
    workflowOwnerLabelMap[workflowOwnerKey]
  );
}

function syncTenantStats(database: DatabaseState) {
  database.tenant.users = database.users.length;
  database.tenant.activeProjects = Object.keys(database.projects).length;
}

function syncProjectSetupMembers(database: DatabaseState) {
  Object.values(database.projects).forEach((project) => {
    const memberIds = database.users
      .filter((user) => canAccessProject(user, project.summary.id))
      .map((user) => user.id);
    project.setup.memberIds = memberIds;
    project.setup.workflowOwners = normalizeWorkflowOwners(
      database,
      project.summary.id,
      memberIds,
      project.setup.workflowOwners,
    );
  });
}

function ensureProjectSetupState(database: DatabaseState) {
  Object.values(database.projects).forEach((project) => {
    const lots = Array.from(
      new Set(project.site.lotProgress.map((item) => item.lot).filter(Boolean)),
    );
    const phases = Array.from(
      new Set(
        project.documents.tree.flatMap((branch) =>
          branch.nodes.flatMap((node) => node.phases),
        ),
      ),
    );
    const zones = Array.from(
      new Set(
        [
          ...project.site.photoLibrary.map((photo) => photo.zone),
          project.site.draftPhoto.zone,
        ].filter(Boolean),
      ),
    );

      project.setup = {
        lots: project.setup?.lots?.length ? project.setup.lots : lots.length ? lots : ["General"],
        memberIds:
          project.setup?.memberIds?.length
            ? project.setup.memberIds
          : database.users
              .filter((user) => canAccessProject(user, project.summary.id))
              .map((user) => user.id),
        phases:
          project.setup?.phases?.length ? project.setup.phases : phases.length ? phases : ["EXE"],
        workflowOwners: normalizeWorkflowOwners(
          database,
          project.summary.id,
          project.setup?.memberIds?.length
            ? project.setup.memberIds
            : database.users
                .filter((user) => canAccessProject(user, project.summary.id))
                .map((user) => user.id),
          project.setup?.workflowOwners,
        ),
        zones:
          project.setup?.zones?.length ? project.setup.zones : zones.length ? zones : ["Zone principale"],
      };
    });

  syncProjectSetupMembers(database);
}

function ensureAuditTrailState(database: DatabaseState) {
  database.auditTrail = database.auditTrail.map((entry, index) => ({
    ...entry,
    createdAt: entry.createdAt ?? nowTimestamp,
    id: entry.id ?? `AUD-${String(index + 1).padStart(4, "0")}`,
    projectCode:
      entry.projectCode ??
      Object.keys(database.projects).find((code) => entry.context.includes(code)),
  }));
}

function ensureNotificationsState(database: DatabaseState) {
  const defaultRecipients = database.users
    .filter((user) => hasPermission(user, "notifications.view"))
    .map((user) => user.id);

  database.notifications = database.notifications.map((entry, index) => {
    if ("id" in entry && "createdAt" in entry && "readBy" in entry && "recipients" in entry) {
      const currentEntry = entry as NotificationRecord;
      return {
        ...currentEntry,
        actor: currentEntry.actor ?? "BnaaSaaS",
        channel: currentEntry.channel ?? "In-app",
        emailDeliveredAt: currentEntry.emailDeliveredAt,
        emailError: currentEntry.emailError,
        emailStatus:
          currentEntry.emailStatus ??
          (channelSupportsEmail(currentEntry.channel ?? "In-app")
            ? "captured"
            : "not_applicable"),
        href: currentEntry.href ?? "/notifications",
        readBy: currentEntry.readBy ?? [],
        recipients: currentEntry.recipients?.length ? currentEntry.recipients : defaultRecipients,
        requiresAction: currentEntry.requiresAction ?? false,
        tone: currentEntry.tone ?? "primary",
        type: currentEntry.type ?? "project",
      };
    }

    const legacy = entry as {
      channel?: string;
      detail: string;
      title: string;
      when?: string;
    };

    return {
      id: `NTF-${String(index + 1).padStart(4, "0")}`,
      title: legacy.title,
      detail: legacy.detail,
      channel:
        legacy.channel === "Email"
          ? "Email"
          : legacy.channel === "In-app + email"
            ? "In-app + email"
            : "In-app",
      createdAt: nowTimestamp,
      href:
        legacy.detail.toLowerCase().includes("facture")
          ? "/finance"
          : legacy.detail.toLowerCase().includes("plan")
            ? "/documents"
            : "/site",
      tone: legacy.detail.toLowerCase().includes("echeance") ? "warning" : "primary",
      type:
        legacy.detail.toLowerCase().includes("facture")
          ? "invoice"
          : legacy.detail.toLowerCase().includes("plan")
            ? "document"
            : "report",
      actor: "BnaaSaaS",
      projectCode:
        Object.keys(database.projects).find((code) => legacy.detail.includes(code)) ?? "BN-042",
      projectId:
        Object.keys(database.projects).find((code) => legacy.detail.includes(code)) ?? "BN-042",
      recipients: defaultRecipients,
      readBy: [],
      emailDeliveredAt: undefined,
      emailError: channelSupportsEmail(
        legacy.channel === "Email"
          ? "Email"
          : legacy.channel === "In-app + email"
            ? "In-app + email"
            : "In-app",
      )
        ? "Notification creee avant l'activation du canal email."
        : undefined,
      emailStatus: channelSupportsEmail(
        legacy.channel === "Email"
          ? "Email"
          : legacy.channel === "In-app + email"
            ? "In-app + email"
            : "In-app",
      )
        ? "captured"
        : "not_applicable",
      requiresAction: legacy.detail.toLowerCase().includes("validation"),
    } satisfies NotificationRecord;
  });
}

function ensureSystemUsers(database: DatabaseState) {
  for (const seededUser of appUsers) {
    const existingUser = database.users.find(
      (user) => user.email.toLowerCase() === seededUser.email.toLowerCase(),
    );

    if (!existingUser) {
      database.users.unshift(clone(seededUser));
      continue;
    }

    if (seededUser.email.toLowerCase() === "admin@bnaa.com") {
      existingUser.name = seededUser.name;
      existingUser.password = seededUser.password;
      existingUser.role = "Super Admin";
      existingUser.initials = seededUser.initials;
      existingUser.projectIds = ["*"];
    }
  }

  ensureAuditTrailState(database);
  ensureNotificationsState(database);
  ensureProjectSetupState(database);
  syncTenantStats(database);
}

function getProjectRecord(database: DatabaseState, projectId: string) {
  const project = database.projects[projectId];
  assert(project, 404, "Projet introuvable.");
  return project;
}

function ensureProjectAccess(user: AppUser | SafeUser, projectId: string) {
  assert(canAccessProject(user, projectId), 403, "Acces projet refuse.");
}

function ensurePermission(user: AppUser | SafeUser, permission: AppPermission) {
  assert(hasPermission(user, permission), 403, "Action non autorisee pour ce role.");
}

function ensureAssignedWorkflowOwner(
  user: AppUser | SafeUser,
  project: ProjectRecord,
  workflowOwnerKey: ProjectWorkflowOwnerKey,
) {
  if (user.role === "Super Admin") {
    return;
  }

  const assignedOwnerId = project.setup.workflowOwners?.[workflowOwnerKey];
  if (assignedOwnerId) {
    assert(
      user.id === assignedOwnerId,
      403,
      `${workflowOwnerLabelMap[workflowOwnerKey]} assigne requis pour cette validation.`,
    );
    return;
  }

  assert(
    user.role === workflowOwnerRoleMap[workflowOwnerKey],
    403,
    `${workflowOwnerLabelMap[workflowOwnerKey]} requis pour cette validation.`,
  );
}

function isAssignedWorkflowOwner(
  user: AppUser | SafeUser,
  project: ProjectRecord,
  workflowOwnerKey: ProjectWorkflowOwnerKey,
) {
  if (user.role === "Super Admin") {
    return true;
  }

  const assignedOwnerId = project.setup.workflowOwners?.[workflowOwnerKey];
  if (assignedOwnerId) {
    return user.id === assignedOwnerId;
  }

  return user.role === workflowOwnerRoleMap[workflowOwnerKey];
}

function appendAudit(
  database: DatabaseState,
  actor: string,
  action: string,
  context: string,
) {
  database.auditTrail.unshift({
    actor,
    action,
    context,
    createdAt: nowTimestamp,
    id: `AUD-${randomUUID().slice(0, 8)}`,
    projectCode: Object.keys(database.projects).find((code) => context.includes(code)),
    at: toDateTimeLabel(nowTimestamp),
  });
}

function resolveNotificationRecipients(
  database: DatabaseState,
  options: {
    actorId?: string;
    permission?: AppPermission;
    projectId?: string;
    roles?: AppUser["role"][];
    userIds?: string[];
  },
) {
  const explicitRecipients = options.userIds?.length
    ? new Set(options.userIds)
    : null;

  return database.users
    .filter((candidate) => {
      if (explicitRecipients) {
        return explicitRecipients.has(candidate.id);
      }

      if (options.projectId && !canAccessProject(candidate, options.projectId)) {
        return false;
      }

      if (options.permission && !hasPermission(candidate, options.permission)) {
        return false;
      }

      if (options.roles?.length && !options.roles.includes(candidate.role)) {
        return false;
      }

      return hasPermission(candidate, "notifications.view");
    })
    .filter((candidate) => candidate.id !== options.actorId)
    .map((candidate) => candidate.id);
}

function appendNotification(
  database: DatabaseState,
  options: {
    actor: string;
    actorId?: string;
    channel?: NotificationRecord["channel"];
    detail: string;
    href: string;
    permission?: AppPermission;
    projectCode?: string;
    projectId?: string;
    requiresAction?: boolean;
    roles?: AppUser["role"][];
    title: string;
    tone?: NotificationRecord["tone"];
    type: NotificationType;
    userIds?: string[];
  },
) {
  const recipients = resolveNotificationRecipients(database, {
    actorId: options.actorId,
    permission: options.permission,
    projectId: options.projectId,
    roles: options.roles,
    userIds: options.userIds,
  });

  if (recipients.length === 0) {
    return;
  }

  const notification: NotificationRecord = {
    id: `NTF-${randomUUID().slice(0, 8)}`,
    title: options.title,
    detail: options.detail,
    channel: options.channel ?? "In-app",
    createdAt: nowTimestamp,
    href: options.href,
    tone: options.tone ?? "primary",
    type: options.type,
    actor: options.actor,
    projectId: options.projectId,
    projectCode: options.projectCode,
    recipients,
    readBy: [],
    requiresAction: options.requiresAction ?? false,
    emailDeliveredAt: undefined,
    emailError: undefined,
    emailStatus: channelSupportsEmail(options.channel ?? "In-app")
      ? "queued"
      : "not_applicable",
  };

  database.notifications.unshift(notification);

  if (channelSupportsEmail(notification.channel)) {
    void processNotificationEmail(notification.id);
  }
}

async function processNotificationEmail(notificationId: string) {
  try {
    await updateDatabase(async (database) => {
      ensureSystemUsers(database);
      const notification = database.notifications.find((entry) => entry.id === notificationId);
      if (!notification || !channelSupportsEmail(notification.channel)) {
        return;
      }

      if (notification.emailStatus === "sent") {
        return;
      }

      const recipients = database.users.filter((user) =>
        notification.recipients.includes(user.id),
      );
      const projectName = notification.projectId
        ? database.projects[notification.projectId]?.summary.name
        : undefined;
      const result = await sendNotificationEmail({
        notification,
        projectName,
        recipients,
      });

      notification.emailStatus = result.status;
      notification.emailError =
        result.status === "failed" || result.status === "captured"
          ? result.detail
          : undefined;
      notification.emailDeliveredAt = result.deliveredAt;
    });
  } catch (error) {
    await updateDatabase((database) => {
      ensureSystemUsers(database);
      const notification = database.notifications.find((entry) => entry.id === notificationId);
      if (!notification) {
        return;
      }

      notification.emailStatus = "failed";
      notification.emailError =
        error instanceof Error ? error.message : "Erreur email inconnue.";
    });
  }
}

function getUserNotifications(
  database: DatabaseState,
  user: AppUser | SafeUser,
) {
  return database.notifications
    .filter((notification) => notification.recipients.includes(user.id))
    .filter((notification) =>
      notification.projectId ? canAccessProject(user, notification.projectId) : true,
    )
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
}

function toUserNotification(
  notification: NotificationRecord,
  userId: string,
): UserNotification {
  return {
    ...clone(notification),
    isRead: notification.readBy.includes(userId),
    when: formatRelativeTime(notification.createdAt),
  };
}

function buildAlertsFromNotifications(
  notifications: UserNotification[],
  projectId?: string,
): DashboardAlert[] {
  return notifications
    .filter((notification) => !notification.isRead)
    .filter((notification) => (projectId ? notification.projectId === projectId : true))
    .sort((left, right) => {
      const toneGap = notificationToneRank(left.tone) - notificationToneRank(right.tone);
      if (toneGap !== 0) {
        return toneGap;
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    })
    .slice(0, 4)
    .map((notification) => ({
      title: notification.title,
      detail: notification.detail,
      time: notification.when,
      tone: notification.tone,
    }));
}

function buildUserActivityFeed(
  database: DatabaseState,
  user: AppUser | SafeUser,
) {
  const accessibleCodes = new Set(
    getUserAccessibleProjects(database, user).map((project) => project.code),
  );

  return clone(database.auditTrail)
    .filter((entry) =>
      entry.projectCode
        ? accessibleCodes.has(entry.projectCode)
        : hasPermission(user, "admin.view"),
    )
    .sort((left, right) => {
      const rightTime = new Date(right.createdAt ?? nowTimestamp).getTime();
      const leftTime = new Date(left.createdAt ?? nowTimestamp).getTime();
      return rightTime - leftTime;
    })
    .slice(0, 10);
}

function recomputeProjectSummary(project: ProjectRecord) {
  const latestReport = project.site.reports[0];
  const spentTnd = Math.round(
    project.finance.cashflow.reduce(
      (total, item) => total + item.actualCosts,
      0,
    ) * 1000,
  );
  const invoicesDue = project.finance.invoices.filter(
    (invoice) => invoice.status !== "Payee",
  ).length;
  const unreadDocs = project.documents.files.filter(
    (file) => file.readCount < file.recipients,
  ).length;
  const health =
    project.summary.status === "Cloture"
      ? { health: "Projet cloture", tone: "success" as const }
      : toProjectHealth(project.summary.progress, invoicesDue, unreadDocs);

  project.summary.progress = latestReport?.progress ?? project.summary.progress;
  project.summary.spentTnd = spentTnd;
  project.summary.invoicesDue = invoicesDue;
  if (!["Cloture", "Configuration"].includes(project.summary.status)) {
    project.summary.status =
      project.summary.progress >= 75 ? "Phase encaissement" : "En execution";
  }
  project.summary.nextMilestone =
    project.summary.nextMilestone || latestReport?.summary || "A planifier";

  const portfolioEntry = {
    name: project.summary.name,
    code: project.summary.code,
    location: project.summary.location.split(",")[0] ?? project.summary.location,
    progress: project.summary.progress,
    budget: project.summary.budgetTnd,
    health: health.health,
    tone: health.tone,
    nextMilestone: project.summary.nextMilestone,
  };

  return { health, portfolioEntry };
}

function deriveProjectMemberOptions(database: DatabaseState, project: ProjectRecord) {
  return project.setup.memberIds
    .map((memberId) => database.users.find((entry) => entry.id === memberId))
    .filter((member): member is AppUser => Boolean(member))
    .map((member) => ({
      id: member.id,
      initials: member.initials,
      name: member.name,
        role: member.role,
      }));
}

function resolveDistributionRecipients(
  projectMembers: ReturnType<typeof deriveProjectMemberOptions>,
  audience: string,
) {
  if (audience === "Equipe projet complete" || audience.startsWith("Lot ")) {
    return projectMembers;
  }

  const exactMember = projectMembers.find(
    (member) => `${member.name} - ${member.role}` === audience,
  );

  return exactMember ? [exactMember] : projectMembers;
}

function deriveProjectWorkflowOwners(database: DatabaseState, project: ProjectRecord) {
  return (Object.keys(workflowOwnerLabelMap) as ProjectWorkflowOwnerKey[])
    .map((key) => resolveWorkflowOwner(database, project, key))
    .filter(
      (
        owner,
      ): owner is {
        id: string;
        initials: string;
        label: string;
        name: string;
        role: UserRole;
      } => Boolean(owner),
    );
}

async function deriveSiteData(
  database: DatabaseState,
  project: ProjectRecord,
): Promise<SiteModuleData> {
  const site = clone(project.site);
  site.reports = site.reports.map((report) => ({
    ...report,
    pdfUrl: getSiteReportPdfUrl(project.summary.id, report.id),
  })) as SiteModuleData["reports"];
  site.photoLibrary = site.photoLibrary.map((photo) => {
    const asset = photo as SitePhotoRecord;
    return asset.filePath
      ? ({
          ...asset,
          fileUrl: getSitePhotoUrl(project.summary.id, asset.id),
        } as unknown as SiteModuleData["photoLibrary"][number])
      : photo;
  });
  const totalReports = site.reports.length;
  const averageCompleteness = totalReports
    ? Math.round(
        site.reports.reduce((total, report) => total + report.completeness, 0) /
          totalReports,
      )
    : 0;
  const openNcrs = site.ncrs.filter((item) => item.status !== "Levee");
  const avgLiftDelay = openNcrs.length
    ? (
        openNcrs.reduce(
          (total, item) => total + diffInDays(todayIso, item.dueDate),
          0,
        ) / openNcrs.length
      ).toFixed(1)
    : "0.0";
  const driftDays = Math.round(
    site.lotProgress.reduce((total, item) => {
      const progress = Number(item.progress ?? 0);
      const planned = Number(item.planned ?? progress);
      return total + (progress - planned);
    }, 0) / Math.max(site.lotProgress.length, 1),
  );
  const latestReport = site.reports[0];

  site.overview.kpis = [
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
  ];

  site.signatureQueue = [
    {
      role: "Conducteur de travaux",
      state: latestReport?.signedByCt ? "Signe" : "En attente",
      note: latestReport
        ? latestReport.signedByCt
          ? `${latestReport.id} signe par ${(latestReport as { ctSignatureBy?: string }).ctSignatureBy ?? latestReport.author}${(latestReport as { ctSignatureAt?: string }).ctSignatureAt ? ` le ${(latestReport as { ctSignatureAt?: string }).ctSignatureAt}` : ""}`
          : `Dernier RJC ${latestReport.id} - signature attendue de ${resolveWorkflowOwnerName(database, project, "siteLeadId")}`
        : "Aucun rapport disponible",
      tone: latestReport?.signedByCt ? "success" : "warning",
    },
    {
      role: "Maitre d'oeuvre",
      state: latestReport?.signedByMoe ? "Signe" : "En attente",
      note: latestReport
        ? latestReport.signedByMoe
          ? `${latestReport.id} valide par ${(latestReport as { moeSignatureBy?: string }).moeSignatureBy ?? "l'approbateur"}${(latestReport as { moeSignatureAt?: string }).moeSignatureAt ? ` le ${(latestReport as { moeSignatureAt?: string }).moeSignatureAt}` : ""}`
          : `Rapport ${latestReport.id} a valider par ${resolveWorkflowOwnerName(database, project, "projectManagerId")}`
        : "Aucun rapport disponible",
      tone: latestReport?.signedByMoe ? "success" : "warning",
    },
    {
      role: "Archivage PDF",
      state: latestReport?.pdfReady ? "Pret" : "En attente",
      note: latestReport
        ? `Generation ${latestReport.pdfReady ? "prete" : "en attente"} pour ${latestReport.id}${latestReport.signedByMoe ? " et archivee apres validation" : ""}`
        : "Aucun PDF a produire",
      tone: latestReport?.pdfReady ? "primary" : "warning",
    },
  ];

  site.overview.weather = await resolveProjectWeather({
    fallback: clone(site.overview.weather),
    location: project.summary.location,
    projectId: project.summary.id,
  });

  return {
    ...site,
    projectMembers: deriveProjectMemberOptions(database, project),
    projectSetup: clone(project.setup),
  };
}

function enrichDocumentVersions(
  projectId: string,
  document: DocumentFileRecord,
): DocumentVersionRecord[] {
  return (document.versions ?? []).map((version) => {
    const isCurrentVersion = version.version === document.revision;
    const filePath = version.filePath ?? (isCurrentVersion ? document.filePath : undefined);
    const fileName = version.fileName ?? (isCurrentVersion ? document.fileName : undefined);
    const mimeType = version.mimeType ?? (isCurrentVersion ? document.mimeType : undefined);

    return {
      ...version,
      downloadUrl: filePath
        ? isCurrentVersion
          ? getDocumentDownloadUrl(projectId, document.id)
          : getDocumentVersionDownloadUrl(projectId, document.id, version.version)
        : undefined,
      fileName,
      filePath,
      isCurrent: isCurrentVersion,
      mimeType,
    };
  });
}

function deriveDocumentsData(database: DatabaseState, project: ProjectRecord): DocumentsModuleData {
  const documents = clone(project.documents);
  documents.files = documents.files.map((file) => {
    const asset = file as DocumentFileRecord;
    return asset.filePath
      ? ({
          ...asset,
          downloadUrl: getDocumentDownloadUrl(project.summary.id, asset.id),
          versions: enrichDocumentVersions(project.summary.id, asset),
        } as unknown as DocumentsModuleData["files"][number])
      : ({
          ...asset,
          versions: enrichDocumentVersions(project.summary.id, asset),
        } as unknown as DocumentsModuleData["files"][number]);
  });
  const totalSizeMb = documents.files.reduce(
    (total, file) => total + file.fileSizeMb,
    0,
  );
  const totalRecipients = documents.files.reduce(
    (total, file) => total + Math.max(file.recipients, 1),
    0,
  );
  const totalReads = documents.files.reduce((total, file) => total + file.readCount, 0);
  const activeVersions = documents.files.filter((file) => file.isCurrent).length;
  const staleUndistributed = documents.files.filter(
    (file) => diffInDays(file.lastDistributedAt, todayIso) > 5,
  ).length;
  const cachedFiles = documents.files.filter((file) => file.offlineReady).length;
  const readRate = Math.round((totalReads / Math.max(totalRecipients, 1)) * 100);

  documents.overview.kpis = [
    {
      label: "Volume documentaire",
      value: `${(totalSizeMb / 1024).toFixed(1)} Go`,
      helper: `${documents.files.length} fichiers actifs dans le projet`,
      tone: "primary",
    },
    {
      label: "Lecture < 48h",
      value: `${readRate}%`,
      helper: `${totalReads}/${totalRecipients} lectures confirmees`,
      tone: readRate >= 90 ? "success" : "warning",
    },
    {
      label: "Versions actives",
      value: `${activeVersions}`,
      helper: "Documents actuellement en vigueur",
      tone: activeVersions > 20 ? "warning" : "primary",
    },
    {
      label: "Docs non diffuses > 5j",
      value: `${staleUndistributed}`,
      helper: "Documents a recontacter ou republier",
      tone: staleUndistributed > 0 ? "danger" : "success",
    },
  ];

  documents.overview.offline = {
    ...documents.overview.offline,
    syncedAt: toDateTimeLabel(nowTimestamp),
    cachedFiles,
  };

  const projectMembers = deriveProjectMemberOptions(database, project);

  return {
    ...documents,
    distributionOptions: [
      "Equipe projet complete",
      ...project.setup.lots.map((lot) => `Lot ${lot}`),
      ...projectMembers.map((member) => `${member.name} - ${member.role}`),
    ],
    projectMembers,
    projectSetup: clone(project.setup),
  };
}

function deriveFinanceData(database: DatabaseState, project: ProjectRecord): FinanceModuleData {
  const finance = clone(project.finance);
  finance.invoices = finance.invoices.map((invoice) => ({
    ...invoice,
    pdfUrl: getInvoicePdfUrl(project.summary.id, invoice.id),
  })) as FinanceModuleData["invoices"];
  if (finance.dmDraft.progressPct === 0 && project.summary.progress > 0) {
    finance.dmDraft.progressPct = project.summary.progress;
  }
  const paidInvoices = finance.invoices.filter((invoice) => invoice.paidAt);
  const overdueInvoices = finance.invoices.filter(
    (invoice) => !invoice.paidAt && invoice.dueDate < todayIso,
  );
  const averageDelay = paidInvoices.length
    ? Math.round(
        paidInvoices.reduce(
          (total, invoice) => total + diffInDays(invoice.periodMonth, invoice.paidAt),
          0,
        ) / paidInvoices.length,
      )
    : 0;
  const onTimeRate = Math.round(
    (finance.invoices.filter((invoice) => invoice.dueDate >= todayIso || invoice.paidAt).length /
      Math.max(finance.invoices.length, 1)) *
      100,
  );
  const budgetGap = Number(
    (((project.summary.budgetTnd - project.summary.spentTnd) /
      Math.max(project.summary.budgetTnd, 1)) *
      100).toFixed(1),
  );
  const vatCompliance = finance.declaration.collectedTva === 0
    ? 100
    : Math.max(
        0,
        Math.round(
          (Math.min(finance.declaration.collectedTva, finance.declaration.declaredTva) /
            finance.declaration.collectedTva) *
            100,
        ),
      );

  finance.overview.kpis = [
    {
      label: "DSO",
      value: `${averageDelay} j`,
      helper: "Moyenne des encaissements deja enregistres",
      tone: averageDelay > 30 ? "danger" : averageDelay > 20 ? "warning" : "success",
    },
    {
      label: "Facturation dans les delais",
      value: `${onTimeRate}%`,
      helper: `${finance.invoices.length} factures suivies`,
      tone: onTimeRate >= 90 ? "success" : "warning",
    },
    {
      label: "Ecart budget / reel",
      value: `${budgetGap >= 0 ? "-" : "+"}${Math.abs(budgetGap)}%`,
      helper: `Budget ${project.summary.budgetTnd.toLocaleString("fr-FR")} TND vs depense ${project.summary.spentTnd.toLocaleString("fr-FR")} TND`,
      tone: budgetGap < 0 ? "danger" : budgetGap < 5 ? "warning" : "primary",
    },
    {
      label: "TVA collectee / declaree",
      value: `${vatCompliance}%`,
      helper: finance.declaration.status,
      tone: vatCompliance >= 99 ? "success" : "warning",
    },
  ];

  finance.overview.treasuryAlert =
    overdueInvoices.length > 0
      ? `${overdueInvoices.length} facture(s) en retard doivent etre traitees pour detendre la tresorerie du projet.`
      : "Tresorerie sous controle sur le cycle courant.";

  return {
    ...finance,
    projectMembers: deriveProjectMemberOptions(database, project),
    projectSetup: clone(project.setup),
  };
}

function deriveProjectTeamMembers(database: DatabaseState, projectId: string) {
  const recentActivityByActor = new Map<string, string>();

  clone(database.auditTrail)
    .sort((left, right) => {
      const rightTime = new Date(right.createdAt ?? nowTimestamp).getTime();
      const leftTime = new Date(left.createdAt ?? nowTimestamp).getTime();
      return rightTime - leftTime;
    })
    .forEach((entry) => {
      if (!recentActivityByActor.has(entry.actor)) {
        recentActivityByActor.set(entry.actor, `${entry.action} - ${entry.context}`);
      }
    });

  return database.users
    .filter((member) => canAccessProject(member, projectId))
    .map((member) => ({
      initials: member.initials,
      name: member.name,
      role: member.role,
      state: recentActivityByActor.get(member.name) ?? `Acces ${member.role.toLowerCase()} actif`,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "fr"));
}

function deriveNextCheckpoint(project: ProjectRecord) {
  const candidates: Array<{
    date: string;
    detail: string;
    tone: DashboardAlert["tone"];
  }> = [];

  project.finance.invoices
    .filter((invoice) => invoice.status !== "Payee")
    .forEach((invoice) => {
      candidates.push({
        date: invoice.dueDate,
        detail: `${invoice.invoiceNumber} - ${invoice.status}`,
        tone: invoice.dueDate < todayIso ? "danger" : "warning",
      });
    });

  project.site.ncrs
    .filter((ncr) => ncr.status !== "Levee")
    .forEach((ncr) => {
      candidates.push({
        date: ncr.dueDate,
        detail: `${ncr.ref} - ${ncr.title}`,
        tone: ncr.dueDate < todayIso ? "danger" : "warning",
      });
    });

  const pendingSignature = project.site.reports.find((report) => !report.signedByMoe);
  if (pendingSignature) {
    candidates.push({
      date: pendingSignature.date,
      detail: `Validation ${pendingSignature.id}`,
      tone: pendingSignature.date < todayIso ? "warning" : "primary",
    });
  }

  if (candidates.length === 0) {
    return {
      date: "A planifier",
      detail: project.summary.nextMilestone || "Aucun jalon immediat detecte",
      tone: "neutral" as const,
    };
  }

  const nextCandidate = candidates.sort((left, right) =>
    left.date.localeCompare(right.date),
  )[0];

  return {
    date: toDayMonth(nextCandidate.date),
    detail: nextCandidate.detail,
    tone: nextCandidate.tone,
  };
}

function deriveProjectFocusSummary(
  project: ProjectRecord,
  site: SiteModuleData,
  documents: DocumentsModuleData,
  finance: FinanceModuleData,
) {
  const overdueInvoices = finance.invoices.filter(
    (invoice) => invoice.status !== "Payee" && invoice.dueDate < todayIso,
  );
  const openNcrs = site.ncrs.filter((item) => item.status !== "Levee");
  const unreadDocumentCount = documents.files.filter(
    (file) => file.readCount < file.recipients,
  ).length;

  if (overdueInvoices.length > 0) {
    const overdueAmount = overdueInvoices.reduce(
      (total, invoice) => total + invoice.amountTtc,
      0,
    );

    return {
      label: "Encaissement a securiser",
      detail: `${overdueInvoices.length} facture(s) en retard pour ${overdueAmount.toLocaleString("fr-FR")} TND TTC.`,
      tone: "danger" as const,
    };
  }

  if (openNcrs.length > 0) {
    return {
      label: "Levees qualite en cours",
      detail: `${openNcrs.length} non-conformite(s) ouvertes dont ${openNcrs.filter((item) => item.severity === "Critique").length} critique(s).`,
      tone: openNcrs.some((item) => item.severity === "Critique") ? ("danger" as const) : ("warning" as const),
    };
  }

  if (unreadDocumentCount > 0) {
    return {
      label: "Diffusions a confirmer",
      detail: `${unreadDocumentCount} document(s) en attente d'accuse de lecture sur ${project.summary.code}.`,
      tone: "warning" as const,
    };
  }

  return {
    label: "Execution sous controle",
    detail: "Terrain, documents et finance restent alignes sur le cycle courant.",
    tone: "success" as const,
  };
}

function buildDashboardMetrics(project: ProjectRecord) {
  const currentPlans = project.documents.files.filter((file) => file.isCurrent).length;
  const openInvoices = project.finance.invoices.filter(
    (invoice) => invoice.status !== "Payee",
  );
  const openNcrs = project.site.ncrs.filter((ncr) => ncr.status !== "Levee").length;

  return [
    {
      label: "Avancement physique",
      value: `${project.summary.progress}%`,
      delta: `${project.site.reports[0]?.summary ?? "Dernier rapport disponible"}`,
      helper: "Synchronise avec le suivi chantier",
      tone: "primary" as const,
    },
    {
      label: "Plans en vigueur",
      value: `${currentPlans}`,
      delta: `${project.documents.files.filter((file) => file.status === "Diffusion").length} diffusions en cours`,
      helper: "Documents techniques courants",
      tone: "success" as const,
    },
    {
      label: "Factures ouvertes",
      value: `${openInvoices.length}`,
      delta: `${openInvoices.reduce((total, invoice) => total + invoice.amountTtc, 0).toLocaleString("fr-FR")} TND en suivi`,
      helper: "Cycle de validation et paiement",
      tone: openInvoices.length > 0 ? ("warning" as const) : ("success" as const),
    },
    {
      label: "Non-conformites",
      value: `${openNcrs}`,
      delta: `${project.site.ncrs.filter((ncr) => ncr.severity === "Critique" && ncr.status !== "Levee").length} critiques`,
      helper: "Suivi qualite et levees",
      tone: openNcrs > 0 ? ("danger" as const) : ("success" as const),
    },
  ];
}

async function buildDashboardData(
  database: DatabaseState,
  user: AppUser | SafeUser,
  projectId: string,
): Promise<DashboardPageData> {
  ensureProjectAccess(user, projectId);
  const project = getProjectRecord(database, projectId);
  const site = await deriveSiteData(database, project);
  const documents = deriveDocumentsData(database, project);
  const finance = deriveFinanceData(database, project);
  const userNotifications = getUserNotifications(database, user).map((notification) =>
    toUserNotification(notification, user.id),
  );
  const projectTeam = deriveProjectTeamMembers(database, projectId);
  const projectAlerts = buildAlertsFromNotifications(userNotifications, projectId);
  const nextCheckpoint = deriveNextCheckpoint(project);
  const focusSummary = deriveProjectFocusSummary(project, site, documents, finance);

  return {
    dashboardMetrics: buildDashboardMetrics(project),
    teamMembers: projectTeam,
    alerts: projectAlerts,
    hero: {
      projectStatus: project.summary.status,
      invoicesDue: project.summary.invoicesDue,
      budgetTnd: project.summary.budgetTnd,
      spentTnd: project.summary.spentTnd,
      nextMilestone: project.summary.nextMilestone,
      nextCheckpointDate: nextCheckpoint.date,
      nextCheckpointTone: nextCheckpoint.tone,
      nextCheckpointDetail: nextCheckpoint.detail,
      focusLabel: focusSummary.label,
      focusDetail: focusSummary.detail,
      focusTone: focusSummary.tone,
      teamSize: projectTeam.length,
      actionRequiredCount: projectAlerts.length,
      cadenceTitle: site.reports[0]
        ? `${site.reports[0].author} - rapport ${site.reports[0].status.toLowerCase()}`
        : "Aucun rapport terrain disponible",
      cadenceSteps: [
        {
          step: "Rapport journalier",
          detail: site.reports[0]?.summary ?? "Aucun rapport soumis aujourd'hui.",
          tone: site.reports[0]?.tone ?? "warning",
        },
        {
          step: "Diffusion documentaire",
          detail:
            documents.files[0]
              ? `${documents.files[0].code} ${documents.files[0].revision} - ${documents.files[0].readCount}/${documents.files[0].recipients} lectures`
              : "Aucune diffusion recente",
          tone: "primary",
        },
        {
          step: "Cycle facture",
          detail:
            finance.invoices[0]
              ? `${finance.invoices[0].invoiceNumber} - ${finance.invoices[0].status}`
              : "Aucune facture disponible",
          tone: finance.invoices[0]?.tone ?? "warning",
        },
      ],
    },
    siteReports: site.reports.slice(0, 3),
    documentVersions: documents.files.slice(0, 3).map((file) => ({
      name: file.code,
      discipline: file.discipline,
      revision: file.revision,
      publishedBy: file.uploadedBy,
      publishedAt: file.publishedAt,
      status: file.status,
      tone: file.tone,
      acknowledged: `${file.readCount}/${file.recipients} lus`,
    })),
    distributionQueue: documents.files.slice(0, 3).map((file) => ({
      audience:
        documents.recipients
          .filter((recipient) => recipient.documentId === file.id)
          .map((recipient) => recipient.name)
          .slice(0, 2)
          .join(" + ") || "Diffusion a confirmer",
      dueDate: file.lastDistributedAt,
      acknowledgedRate: Math.round((file.readCount / Math.max(file.recipients, 1)) * 100),
      file: `${file.code} ${file.revision}`,
    })),
    invoiceMetrics: [
      {
        label: "Facture ce mois",
        value: finance.invoices
          .filter((invoice) => invoice.periodMonth === finance.dmDraft.periodMonth)
          .reduce((total, invoice) => total + invoice.amountHt, 0),
        helper: "Montant HT lie au mois actif",
        tone: "primary" as const,
      },
      {
        label: "Paiements encaisses",
        value: finance.payments.reduce((total, payment) => total + payment.amount, 0),
        helper: `${finance.payments.length} paiement(s) enregistre(s)`,
        tone: "success" as const,
      },
      {
        label: "Encours client",
        value: finance.invoices
          .filter((invoice) => invoice.status !== "Payee")
          .reduce((total, invoice) => total + invoice.amountTtc, 0),
        helper: "Montant encore a encaisser",
        tone: "warning" as const,
      },
      {
        label: "Retard critique",
        value: finance.invoices
          .filter((invoice) => !invoice.paidAt && invoice.dueDate < todayIso)
          .reduce((total, invoice) => total + invoice.amountTtc, 0),
        helper: "Factures depassees",
        tone: "danger" as const,
      },
    ],
    invoices: finance.invoices.slice(0, 3).map((invoice) => ({
      number: invoice.invoiceNumber,
      project: invoice.project,
      amount: invoice.amountTtc,
      dueDate: invoice.dueDate,
      status: invoice.status,
      tone: invoice.tone,
    })),
  };
}

function getSessionRecord(database: DatabaseState, token: string) {
  const session = database.sessions.find((item) => item.token === token) ?? null;
  if (!session) {
    return null;
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    database.sessions = database.sessions.filter((item) => item.token !== token);
    return null;
  }

  return session;
}

function getUserForSession(database: DatabaseState, token: string) {
  const session = getSessionRecord(database, token);
  if (!session) {
    return null;
  }

  return database.users.find((user) => user.id === session.userId) ?? null;
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export async function authenticateUser(email: string, password: string) {
  return updateDatabase(async (database) => {
    ensureSystemUsers(database);
    const user =
      database.users.find(
        (item) =>
          item.email.toLowerCase() === email.trim().toLowerCase() &&
          item.password === password,
      ) ?? null;

    assert(user, 401, "Identifiants invalides. Verifiez votre email et votre mot de passe.");

    const session: SessionRecord = {
      token: createSessionToken(),
      userId: user.id,
      createdAt: nowTimestamp,
      expiresAt: createSessionExpiry(),
    };

    database.sessions = [
      session,
      ...database.sessions.filter((item) => item.userId !== user.id),
    ];

    return {
      sessionToken: session.token,
      user: sanitizeUser(user),
      homePath: getHomePathForRole(user.role),
      permissions: getPermissionsForRole(user.role),
    };
  });
}

export async function getAuthenticatedSession(token: string | null) {
  if (!token) {
    return null;
  }

  return updateDatabase(async (database) => {
    ensureSystemUsers(database);
    const user = getUserForSession(database, token);
    if (!user) {
      return null;
    }

    return {
      user: sanitizeUser(user),
      homePath: getHomePathForRole(user.role),
      permissions: getPermissionsForRole(user.role),
    };
  });
}

export async function clearAuthenticatedSession(token: string | null) {
  if (!token) {
    return;
  }

  await updateDatabase(async (database) => {
    database.sessions = database.sessions.filter((session) => session.token !== token);
  });
}

export async function getWorkspacePayload(token: string): Promise<WorkspacePayload> {
  const database = await readDatabase();
  ensureSystemUsers(database);
  const user = getUserForSession(database, token);
  assert(user, 401, "Session invalide ou expiree.");

  return {
    tenant: clone(database.tenant),
    currentUser: sanitizeUser(user),
    availableProjects: getUserAccessibleProjects(database, user),
  };
}

export async function getDashboardPayload(token: string, projectId: string) {
  const database = await readDatabase();
  ensureSystemUsers(database);
  const user = getUserForSession(database, token);
  assert(user, 401, "Session invalide ou expiree.");
  return await buildDashboardData(database, user, projectId);
}

export async function getProjectsPayload(token: string): Promise<ProjectsPageData> {
  const database = await readDatabase();
  ensureSystemUsers(database);
  const user = getUserForSession(database, token);
  assert(user, 401, "Session invalide ou expiree.");
  ensurePermission(user, "projects.view");

  const accessibleCodes = new Set(
    getUserAccessibleProjects(database, user).map((project) => project.code),
  );

  return {
    projects: Object.values(database.projects)
      .filter((project) => accessibleCodes.has(project.summary.code))
      .map((project) => ({
        summary: clone(project.summary),
        memberCount: project.setup.memberIds.length,
        workflowOwners: deriveProjectWorkflowOwners(database, project).map((owner) => ({
          id: owner.id,
          label: owner.label,
          name: owner.name,
          role: owner.role,
        })),
      })),
  };
}

export async function getGlobalSearchPayload(
  token: string,
  query: string,
): Promise<GlobalSearchPayload> {
  const database = await readDatabase();
  ensureSystemUsers(database);
  const user = getUserForSession(database, token);
  assert(user, 401, "Session invalide ou expiree.");

  const needle = query.trim().toLowerCase();
  if (needle.length < 2) {
    return {
      query: query.trim(),
      results: [],
    };
  }

  const results: GlobalSearchResult[] = [];
  const accessibleProjects = getUserAccessibleProjects(database, user);

  if (hasPermission(user, "projects.view")) {
    accessibleProjects.forEach((project) => {
      const haystack = buildSearchText([
        project.name,
        project.code,
        project.client,
        project.location,
        project.nextMilestone,
      ]);

      if (searchIncludes(haystack, needle)) {
        results.push({
          id: `project-${project.id}`,
          label: project.name,
          meta: `${project.code} · ${project.client} · ${project.location}`,
          href: "/",
          projectId: project.id,
          projectCode: project.code,
          section: "project",
        });
      }
    });
  }

  accessibleProjects.forEach((summary) => {
    const project = getProjectRecord(database, summary.id);

    if (hasPermission(user, "site.view")) {
      project.site.reports.forEach((report) => {
        const haystack = buildSearchText([
          report.id,
          report.summary,
          report.author,
          report.status,
          report.date,
          report.weather,
        ]);

        if (searchIncludes(haystack, needle)) {
          results.push({
            id: `report-${project.summary.id}-${report.id}`,
            label: `${report.id} · ${report.summary}`,
            meta: `${project.summary.code} · ${toDayMonth(report.date)} · ${report.status}`,
            href: buildModuleHref("/site", {
              report: report.id,
              tab: "overview",
            }),
            projectId: project.summary.id,
            projectCode: project.summary.code,
            section: "report",
          });
        }
      });
    }

    if (hasPermission(user, "documents.view")) {
      project.documents.files.forEach((document) => {
        const haystack = buildSearchText([
          document.code,
          document.title,
          document.discipline,
          document.phase,
          document.revision,
          document.lot,
        ]);

        if (searchIncludes(haystack, needle)) {
          results.push({
            id: `document-${project.summary.id}-${document.id}`,
            label: `${document.code} · ${document.title}`,
            meta: `${project.summary.code} · ${document.discipline} · ${document.revision}`,
            href: buildModuleHref("/documents", {
              document: document.id,
              tab: "versions",
            }),
            projectId: project.summary.id,
            projectCode: project.summary.code,
            section: "document",
          });
        }
      });
    }

    if (hasPermission(user, "finance.view")) {
      project.finance.invoices.forEach((invoice) => {
        const haystack = buildSearchText([
          invoice.invoiceNumber,
          invoice.project,
          invoice.status,
          invoice.periodMonth,
          invoice.amountTtc,
        ]);

        if (searchIncludes(haystack, needle)) {
          results.push({
            id: `invoice-${project.summary.id}-${invoice.id}`,
            label: `${invoice.invoiceNumber} · ${invoice.status}`,
            meta: `${project.summary.code} · ${invoice.amountTtc.toLocaleString("fr-FR")} TND · echeance ${toDayMonth(invoice.dueDate)}`,
            href: buildModuleHref("/finance", {
              invoice: invoice.id,
              tab: "invoices",
            }),
            projectId: project.summary.id,
            projectCode: project.summary.code,
            section: "invoice",
          });
        }
      });
    }
  });

  if (hasPermission(user, "admin.view")) {
    database.users.forEach((entry) => {
      const haystack = buildSearchText([entry.name, entry.email, entry.role, entry.projectIds.join(" ")]);
      if (searchIncludes(haystack, needle)) {
        results.push({
          id: `user-${entry.id}`,
          label: entry.name,
          meta: `${entry.role} · ${entry.email}`,
          href: "/admin",
          section: "user",
        });
      }
    });
  }

  const sectionOrder: Record<GlobalSearchResult["section"], number> = {
    project: 0,
    report: 1,
    document: 2,
    invoice: 3,
    user: 4,
  };

  return {
    query: query.trim(),
    results: results
      .sort((left, right) => {
        const sectionGap = sectionOrder[left.section] - sectionOrder[right.section];
        if (sectionGap !== 0) {
          return sectionGap;
        }

        return left.label.localeCompare(right.label, "fr");
      })
      .slice(0, 12),
  };
}

export async function getNotificationsPayload(token: string): Promise<NotificationsPageData> {
  const database = await readDatabase();
  ensureSystemUsers(database);
  const user = getUserForSession(database, token);
  assert(user, 401, "Session invalide ou expiree.");
  ensurePermission(user, "notifications.view");
  const notifications = getUserNotifications(database, user).map((notification) =>
    toUserNotification(notification, user.id),
  );

  return {
    alerts: buildAlertsFromNotifications(notifications),
    notifications,
    activity: buildUserActivityFeed(database, user),
    summary: {
      actionRequiredCount: notifications.filter(
        (notification) => notification.requiresAction && !notification.isRead,
      ).length,
      readCount: notifications.filter((notification) => notification.isRead).length,
      totalCount: notifications.length,
      unreadCount: notifications.filter((notification) => !notification.isRead).length,
    },
  };
}

export async function mutateNotificationsPayload(
  token: string,
  action: "mark-all-read" | "mark-read" | "mark-unread",
  payload: {
    notificationId?: string;
  },
) {
  return updateDatabase(async (database) => {
    ensureSystemUsers(database);
    const user = getUserForSession(database, token);
    assert(user, 401, "Session invalide ou expiree.");
    ensurePermission(user, "notifications.view");

    switch (action) {
      case "mark-all-read":
        database.notifications = database.notifications.map((notification) =>
          notification.recipients.includes(user.id) && !notification.readBy.includes(user.id)
            ? { ...notification, readBy: [...notification.readBy, user.id] }
            : notification,
        );
        break;
      case "mark-read": {
        const notificationId = String(payload.notificationId ?? "");
        assert(notificationId, 400, "Notification introuvable.");
        database.notifications = database.notifications.map((notification) =>
          notification.id === notificationId &&
          notification.recipients.includes(user.id) &&
          !notification.readBy.includes(user.id)
            ? { ...notification, readBy: [...notification.readBy, user.id] }
            : notification,
        );
        break;
      }
      case "mark-unread": {
        const notificationId = String(payload.notificationId ?? "");
        assert(notificationId, 400, "Notification introuvable.");
        database.notifications = database.notifications.map((notification) =>
          notification.id === notificationId && notification.recipients.includes(user.id)
            ? {
                ...notification,
                readBy: notification.readBy.filter((entry) => entry !== user.id),
              }
            : notification,
        );
        break;
      }
      default:
        throw new ApiError(400, "Action notification inconnue.");
    }

    const notifications = getUserNotifications(database, user).map((notification) =>
      toUserNotification(notification, user.id),
    );

    return {
      alerts: buildAlertsFromNotifications(notifications),
      notifications,
      activity: buildUserActivityFeed(database, user),
      summary: {
        actionRequiredCount: notifications.filter(
          (notification) => notification.requiresAction && !notification.isRead,
        ).length,
        readCount: notifications.filter((notification) => notification.isRead).length,
        totalCount: notifications.length,
        unreadCount: notifications.filter((notification) => !notification.isRead).length,
      },
    } satisfies NotificationsPageData;
  });
}

export async function getAdminPayload(token: string): Promise<AdminPageData> {
  const database = await readDatabase();
  ensureSystemUsers(database);
  const user = getUserForSession(database, token);
  assert(user, 401, "Session invalide ou expiree.");
  ensurePermission(user, "admin.view");
  return buildAdminPayload(database);
}

export async function createAdminUser(
  token: string,
  payload: {
    name: string;
    email: string;
    password: string;
    role: AppUser["role"];
    projectIds: string[];
  },
) {
  return updateDatabase(async (database) => {
    ensureSystemUsers(database);
    const actor = getUserForSession(database, token);
    assert(actor, 401, "Session invalide ou expiree.");
    ensurePermission(actor, "admin.manage");

    const name = payload.name.trim();
    const email = payload.email.trim().toLowerCase();
    const password = payload.password.trim();
    const role = payload.role;
    const projectIds =
      role === "Super Admin" ? ["*"] : payload.projectIds.filter(Boolean);

    assert(name.length >= 3, 400, "Nom utilisateur trop court.");
    assert(email.includes("@"), 400, "Email invalide.");
    assert(password.length >= 6, 400, "Mot de passe trop court.");
    assert(!database.users.some((user) => user.email.toLowerCase() === email), 409, "Cet email existe deja.");
    assert(role, 400, "Role requis.");
    assert(projectIds.length > 0, 400, "Choisissez au moins un projet pour cet utilisateur.");

    const nextUser: AppUser = {
      id: `USR-${randomUUID().slice(0, 8)}`,
      name,
      email,
      password,
      role,
      initials: buildInitials(name),
      projectIds,
    };

    database.users.push(nextUser);
    syncProjectSetupMembers(database);
    syncTenantStats(database);
    appendAudit(
      database,
      actor.name,
      "a cree un nouvel utilisateur",
      `${nextUser.name} - ${nextUser.role} - ${projectIds.includes("*") ? "Tous projets" : projectIds.join(", ")}`,
    );
    appendNotification(database, {
      actor: actor.name,
      actorId: actor.id,
      detail: `${nextUser.name} dispose maintenant d'un acces ${nextUser.role.toLowerCase()} a la plateforme.`,
      href: "/admin",
      roles: ["Super Admin"],
      title: "Nouvel utilisateur ajoute",
      tone: "primary",
      type: "admin",
      userIds: [nextUser.id, ...database.users.filter((user) => user.role === "Super Admin").map((user) => user.id)],
    });
    return buildAdminPayload(database);
  });
}

export async function updateAdminUser(
  token: string,
  payload: {
    projectIds: string[];
    role: AppUser["role"];
    userId: string;
  },
) {
  return updateDatabase(async (database) => {
    ensureSystemUsers(database);
    const actor = getUserForSession(database, token);
    assert(actor, 401, "Session invalide ou expiree.");
    ensurePermission(actor, "admin.manage");

    const user = database.users.find((entry) => entry.id === payload.userId);
    assert(user, 404, "Utilisateur introuvable.");

    const nextRole = payload.role;
    const nextProjectIds =
      nextRole === "Super Admin" ? ["*"] : payload.projectIds.filter(Boolean);

    assert(nextRole, 400, "Role requis.");
    assert(nextProjectIds.length > 0, 400, "Choisissez au moins un projet pour cet utilisateur.");

    user.role = nextRole;
    user.projectIds = nextProjectIds;
    syncProjectSetupMembers(database);

    appendAudit(
      database,
      actor.name,
      "a mis a jour un utilisateur",
      `${user.name} - ${user.role} - ${nextProjectIds.includes("*") ? "Tous projets" : nextProjectIds.join(", ")}`,
    );
    appendNotification(database, {
      actor: actor.name,
      actorId: actor.id,
      detail: `${user.name} a maintenant le role ${user.role} sur ${nextProjectIds.includes("*") ? "tous les projets" : `${nextProjectIds.length} projet(s)`}.`,
      href: "/admin",
      roles: ["Super Admin"],
      title: "Acces utilisateur mis a jour",
      tone: "warning",
      type: "admin",
      userIds: [user.id, ...database.users.filter((entry) => entry.role === "Super Admin").map((entry) => entry.id)],
    });

    return buildAdminPayload(database);
  });
}

export async function createAdminProject(
  token: string,
  payload: {
    budgetTnd: number;
    client: string;
    code: string;
    location: string;
    lots: string;
    name: string;
    nextMilestone: string;
    phases: string;
    status: string;
    zones: string;
  },
) {
  return updateDatabase(async (database) => {
    ensureSystemUsers(database);
    const actor = getUserForSession(database, token);
    assert(actor, 401, "Session invalide ou expiree.");
    ensurePermission(actor, "admin.manage");

    const name = payload.name.trim();
    const code = normalizeProjectCode(payload.code);
    const client = payload.client.trim();
    const location = payload.location.trim();
    const status = payload.status.trim() || "Configuration";
    const nextMilestone = payload.nextMilestone.trim() || "Parametrage initial";
    const budgetTnd = Number(payload.budgetTnd);
    const lots = parseSetupList(payload.lots, "General");
    const phases = parseSetupList(payload.phases, "EXE");
    const zones = parseSetupList(payload.zones, "Zone principale");

    assert(name.length >= 3, 400, "Nom projet trop court.");
    assert(code.length >= 3, 400, "Code projet invalide.");
    assert(client.length >= 2, 400, "Client requis.");
    assert(location.length >= 2, 400, "Localisation requise.");
    assert(Number.isFinite(budgetTnd) && budgetTnd >= 0, 400, "Budget projet invalide.");
    assert(!database.projects[code], 409, "Ce code projet existe deja.");

    const summary: ProjectRecord["summary"] = {
      id: code,
      name,
      code,
      client,
      location,
      status,
      progress: 0,
      budgetTnd,
      spentTnd: 0,
      invoicesDue: 0,
      nextMilestone,
      allowedRoles: defaultProjectRoles,
    };

    database.projects[code] = {
      summary,
      setup: {
        lots,
        memberIds: database.users
          .filter((entry) => canAccessProject(entry, code))
          .map((entry) => entry.id),
        phases,
        workflowOwners: createEmptyWorkflowOwners(),
        zones,
      },
      site: createEmptySiteModule({ lots, projectName: name, zones }),
      documents: createEmptyDocumentsModule({ lots, phases, projectName: name }),
      finance: createEmptyFinanceModule(),
    };
    applyProjectSetup(database, database.projects[code], {
      lots,
      phases,
      zones,
    });

    database.portfolio.unshift({
      name,
      code,
      location: location.split(",")[0] ?? location,
      progress: 0,
      budget: budgetTnd,
      health: "Configuration",
      tone: "warning",
      nextMilestone,
    });
    syncTenantStats(database);

    appendAudit(
      database,
      actor.name,
      "a cree un projet",
      `${name} - ${code} - ${lots.length} lot(s) / ${zones.length} zone(s)`,
    );
    appendNotification(database, {
      actor: actor.name,
      actorId: actor.id,
      detail: `${name} (${code}) est pret pour l'affectation des equipes et le demarrage des modules projet.`,
      href: "/projects",
      roles: ["Super Admin"],
      title: "Nouveau projet cree",
      tone: "primary",
      type: "project",
    });

    return buildAdminPayload(database);
  });
}

export async function archiveAdminProject(
  token: string,
  payload: {
    projectId: string;
  },
) {
  return updateDatabase(async (database) => {
    ensureSystemUsers(database);
    const actor = getUserForSession(database, token);
    assert(actor, 401, "Session invalide ou expiree.");
    ensurePermission(actor, "admin.manage");

    const project = getProjectRecord(database, payload.projectId);
    project.summary.status = "Cloture";
    project.summary.nextMilestone = "Projet cloture";
    const { portfolioEntry } = recomputeProjectSummary(project);
    database.portfolio = database.portfolio.map((entry) =>
      entry.code === portfolioEntry.code ? portfolioEntry : entry,
    );

    appendAudit(
      database,
      actor.name,
      "a cloture un projet",
      `${project.summary.name} - ${project.summary.code}`,
    );
    appendNotification(database, {
      actor: actor.name,
      actorId: actor.id,
      detail: `${project.summary.name} a ete cloture. Les equipes conservent l'historique pour suivi et audit.`,
      href: "/projects",
      projectCode: project.summary.code,
      projectId: project.summary.id,
      title: "Projet cloture",
      tone: "success",
      type: "project",
    });

    return buildAdminPayload(database);
  });
}

export async function updateAdminProjectSetup(
  token: string,
  payload: {
    budgetTnd: number;
    client: string;
    location: string;
    lots: string[];
    name: string;
    nextMilestone: string;
    phases: string[];
    projectId: string;
    status: string;
    workflowOwners: Partial<ProjectWorkflowOwnersRecord>;
    zones: string[];
  },
) {
  return updateDatabase(async (database) => {
    ensureSystemUsers(database);
    const actor = getUserForSession(database, token);
    assert(actor, 401, "Session invalide ou expiree.");
    ensurePermission(actor, "admin.manage");

    const project = getProjectRecord(database, payload.projectId);
    const name = payload.name.trim();
    const client = payload.client.trim();
    const location = payload.location.trim();
    const status = payload.status.trim() || project.summary.status;
    const nextMilestone = payload.nextMilestone.trim() || project.summary.nextMilestone;
    const budgetTnd = Number(payload.budgetTnd);
    const lots = normalizeSetupEntries(payload.lots, "General");
    const phases = normalizeSetupEntries(payload.phases, "EXE");
    const zones = normalizeSetupEntries(payload.zones, "Zone principale");

    assert(name.length >= 3, 400, "Nom projet trop court.");
    assert(client.length >= 2, 400, "Client requis.");
    assert(location.length >= 2, 400, "Localisation requise.");
    assert(Number.isFinite(budgetTnd) && budgetTnd >= 0, 400, "Budget projet invalide.");

    project.summary.name = name;
    project.summary.client = client;
    project.summary.location = location;
    project.summary.status = status;
    project.summary.budgetTnd = budgetTnd;
    project.summary.nextMilestone = nextMilestone;
      applyProjectSetup(database, project, {
        lots,
        memberIds: project.setup.memberIds,
        phases,
        workflowOwners: payload.workflowOwners,
        zones,
      });

    const { portfolioEntry } = recomputeProjectSummary(project);
    database.portfolio = database.portfolio.map((entry) =>
      entry.code === portfolioEntry.code ? portfolioEntry : entry,
    );

    appendAudit(
      database,
      actor.name,
      "a mis a jour le parametrage projet",
      `${project.summary.name} - ${project.summary.code} - ${lots.length} lot(s), ${zones.length} zone(s), ${phases.length} phase(s)`,
    );
    appendNotification(database, {
      actor: actor.name,
      actorId: actor.id,
        detail: `${project.summary.code} a un parametrage projet mis a jour avec ${lots.length} lot(s), ${zones.length} zone(s) et ${phases.length} phase(s).`,
        href: "/admin",
      projectCode: project.summary.code,
      projectId: project.summary.id,
      title: "Parametrage projet actualise",
      tone: "primary",
      type: "project",
      roles: ["Super Admin", "Chef de projet"],
    });

    return buildAdminPayload(database);
  });
}

export async function updateAdminProjectMembers(
  token: string,
  payload: {
    memberIds: string[];
    projectId: string;
  },
) {
  return updateDatabase(async (database) => {
    ensureSystemUsers(database);
    const actor = getUserForSession(database, token);
    assert(actor, 401, "Session invalide ou expiree.");
    ensurePermission(actor, "admin.manage");

    const project = getProjectRecord(database, payload.projectId);
    const memberIds = Array.from(new Set(payload.memberIds));
    const allowedRoles = new Set(project.summary.allowedRoles);

    database.users.forEach((user) => {
      const shouldHaveAccess =
        user.projectIds.includes("*") ||
        (memberIds.includes(user.id) && allowedRoles.has(user.role));

      if (user.projectIds.includes("*")) {
        return;
      }

      if (shouldHaveAccess && !user.projectIds.includes(project.summary.id)) {
        user.projectIds.push(project.summary.id);
      }

      if (!shouldHaveAccess && user.projectIds.includes(project.summary.id)) {
        user.projectIds = user.projectIds.filter((entry) => entry !== project.summary.id);
      }
    });

    syncProjectSetupMembers(database);

    const assignedMembers = database.users
      .filter((user) => canAccessProject(user, project.summary.id))
      .map((user) => user.name)
      .join(", ");

    appendAudit(
      database,
      actor.name,
      "a mis a jour l'affectation equipe",
      `${project.summary.code} - ${assignedMembers || "aucun membre"} `,
    );
    appendNotification(database, {
      actor: actor.name,
      actorId: actor.id,
      detail: `${project.summary.code} compte maintenant ${project.setup.memberIds.length} membre(s) affecte(s) avec acces SaaS.`,
      href: "/admin",
      projectCode: project.summary.code,
      projectId: project.summary.id,
      title: "Equipe projet reaffectee",
      tone: "warning",
      type: "project",
      roles: ["Super Admin", "Chef de projet"],
    });

    return buildAdminPayload(database);
  });
}

export async function getSitePayload(token: string, projectId: string) {
  const database = await readDatabase();
  ensureSystemUsers(database);
  const user = getUserForSession(database, token);
  assert(user, 401, "Session invalide ou expiree.");
  ensurePermission(user, "site.view");
  ensureProjectAccess(user, projectId);
  return await deriveSiteData(database, getProjectRecord(database, projectId));
}

export async function downloadSiteReportPdf(token: string, projectId: string, reportId: string) {
  const database = await readDatabase();
  ensureSystemUsers(database);
  const user = getUserForSession(database, token);
  assert(user, 401, "Session invalide ou expiree.");
  ensurePermission(user, "site.view");
  ensureProjectAccess(user, projectId);
  const project = getProjectRecord(database, projectId);
  const report = project.site.reports.find((item) => item.id === reportId) as
    | ((typeof project.site.reports)[number] & {
        activities?: string;
        incidents?: string;
        note?: string;
        progressByLot?: SiteModuleData["lotProgress"];
      })
    | undefined;
  assert(report, 404, "Rapport chantier introuvable.");

  const bytes = await buildDailyReportPdf({
    generatedAt: nowTimestamp,
    generatedBy: user.name,
    project: {
      client: project.summary.client,
      code: project.summary.code,
      location: project.summary.location,
      name: project.summary.name,
    },
    report: {
      activities: report.activities,
      author: report.author,
      completeness: report.completeness,
      date: report.date,
      id: report.id,
      incidents: report.incidents,
      note: report.note,
      pdfReady: report.pdfReady,
      progress: report.progress,
      progressByLot: report.progressByLot,
      signedByCt: report.signedByCt,
      signedByMoe: report.signedByMoe,
      status: report.status,
      summary: report.summary,
      weather: report.weather,
      workforce: report.workforce,
    },
  });

  return {
    bytes,
    fileName: `${project.summary.code}-${report.id}.pdf`,
  };
}

export async function getSitePhotoFile(token: string, projectId: string, photoId: string) {
  const database = await readDatabase();
  ensureSystemUsers(database);
  const user = getUserForSession(database, token);
  assert(user, 401, "Session invalide ou expiree.");
  ensurePermission(user, "site.view");
  ensureProjectAccess(user, projectId);
  const project = getProjectRecord(database, projectId);
  const photo = project.site.photoLibrary.find((item) => item.id === photoId) as
    | SitePhotoRecord
    | undefined;

  assert(photo, 404, "Photo introuvable.");
  assert(photo.filePath, 404, "Aucun fichier disponible pour cette photo.");

  return {
    fileName: photo.fileName ?? `${photo.title}.jpg`,
    filePath: photo.filePath,
    mimeType: photo.mimeType ?? "image/jpeg",
  };
}

export async function uploadSitePhoto(
  token: string,
  projectId: string,
  payload: {
    file: File;
    geo: string;
    lot: string;
    task: string;
    title: string;
    zone: string;
  },
) {
  return updateDatabase(async (database) => {
    ensureSystemUsers(database);
    const user = getUserForSession(database, token);
    assert(user, 401, "Session invalide ou expiree.");
    ensurePermission(user, "site.photo.create");
    ensureProjectAccess(user, projectId);
    const project = getProjectRecord(database, projectId);
    const title = payload.title.trim();
    const zone = payload.zone.trim();
    const lot = payload.lot.trim();
    const task = payload.task.trim();
    const geo = payload.geo.trim();

    assert(title.length >= 3, 400, "Titre photo requis.");
    assert(zone.length >= 2, 400, "Zone requise.");
    assert(lot.length >= 2, 400, "Lot requis.");
    assert(task.length >= 2, 400, "Tache requise.");
    assert(geo.length >= 3, 400, "Coordonnees geo requises.");
    assert(payload.file.size > 0, 400, "Fichier photo requis.");

    const photoId = `PH-${randomUUID().slice(0, 8)}`;
    const storedFile = await saveUploadedFile({
      bytes: new Uint8Array(await payload.file.arrayBuffer()),
      mimeType: payload.file.type,
      originalName: payload.file.name,
      projectId,
      segments: ["site", "photos"],
      storedName: `${photoId}-${title}`,
    });

    project.site.photoLibrary.unshift({
      id: photoId,
      title,
      zone,
      lot,
      task,
      time: "18:00",
      timestamp: nowTimestamp,
      geo,
      author: user.name,
      accent: getPhotoAccent(project.site.photoLibrary.length),
      fileName: storedFile.fileName,
      filePath: storedFile.relativePath,
      mimeType: storedFile.mimeType,
    } as SiteModuleData["photoLibrary"][number]);

    project.site.draftPhoto = {
      title,
      zone,
      lot,
      task,
      geo,
    };

    appendAudit(
      database,
      user.name,
      "a ajoute une photo chantier",
      `${project.summary.code} - ${title}`,
    );

    const { portfolioEntry } = recomputeProjectSummary(project);
    database.portfolio = database.portfolio.map((entry) =>
      entry.code === portfolioEntry.code ? portfolioEntry : entry,
    );

    return await deriveSiteData(database, project);
  });
}

export async function mutateSitePayload(
  token: string,
  projectId: string,
  action: string,
  payload: Record<string, unknown>,
) {
  return updateDatabase(async (database) => {
    ensureSystemUsers(database);
    const user = getUserForSession(database, token);
    assert(user, 401, "Session invalide ou expiree.");
    ensurePermission(user, "site.view");
    ensureProjectAccess(user, projectId);
    const project = getProjectRecord(database, projectId);

    switch (action) {
      case "create-report": {
        ensurePermission(user, "site.report.create");
        const formState = payload.formState as SiteModuleData["reportDraft"] & {
          workforceCount: number;
          activities: string;
          incidents: string;
          progressByLot: SiteModuleData["lotProgress"];
          note: string;
          reportDate: string;
          weather: string;
        };
        const progress = Math.round(
          formState.progressByLot.reduce((total, item) => total + item.progress, 0) /
            Math.max(formState.progressByLot.length, 1),
        );
        const completeness = Math.min(
          100,
          40 +
            (formState.workforceCount > 0 ? 20 : 0) +
            (formState.activities.trim().length > 20 ? 25 : 0) +
            (formState.incidents.trim().length > 5 ? 15 : 0),
        );
        const reportId = `RJC-${randomUUID().slice(0, 8)}`;

        project.site.reports.unshift({
          id: reportId,
          date: formState.reportDate,
          weather: formState.weather,
          workforce: formState.workforceCount,
          progress,
          author: user.name,
          status: completeness >= 95 ? "Soumis" : "A completer",
          tone: completeness >= 95 ? "primary" : "warning",
          summary: formState.activities.split("\n")[0] || "Rapport terrain soumis",
          completeness,
          pdfReady: false,
          signedByCt: true,
          signedByMoe: false,
          ctSignatureBy: user.name,
          ctSignatureAt: toDateTimeLabel(nowTimestamp),
          moeSignatureBy: "",
          moeSignatureAt: "",
          activities: formState.activities,
          incidents: formState.incidents,
          note: formState.note,
          progressByLot: formState.progressByLot,
        } as unknown as (typeof project.site.reports)[number]);

        project.site.lotProgress = formState.progressByLot;
        project.site.reportDraft = {
          reportDate: toDayMonth(todayIso),
          weather: formState.weather,
          workforce: formState.workforceCount,
          completedLots: formState.activities
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
          blockers: formState.incidents,
          note: formState.note,
        };

        appendAudit(
          database,
          user.name,
          "a soumis un rapport chantier",
          `${project.summary.code} - ${reportId}`,
        );
        appendNotification(database, {
          actor: user.name,
          actorId: user.id,
          detail: `${project.summary.code} - ${reportId} ${completeness >= 95 ? "est pret pour validation" : "reste a completer avant validation"}.`,
          href: buildModuleHref("/site", { report: reportId, tab: "overview" }),
          permission: "site.view",
          projectCode: project.summary.code,
          projectId: project.summary.id,
          requiresAction: completeness >= 95,
          title: "Rapport chantier soumis",
          tone: completeness >= 95 ? "primary" : "warning",
          type: "report",
        });
        break;
      }
      case "update-report": {
        ensurePermission(user, "site.report.create");
        const reportId = String(payload.reportId ?? "");
        const formState = payload.formState as SiteModuleData["reportDraft"] & {
          workforceCount: number;
          activities: string;
          incidents: string;
          progressByLot: SiteModuleData["lotProgress"];
          note: string;
          reportDate: string;
          weather: string;
        };
        const report = project.site.reports.find((item) => item.id === reportId) as
          | ((typeof project.site.reports)[number] & {
              activities?: string;
              ctSignatureAt?: string;
              ctSignatureBy?: string;
              incidents?: string;
              moeSignatureAt?: string;
              moeSignatureBy?: string;
              note?: string;
              progressByLot?: SiteModuleData["lotProgress"];
            })
          | undefined;
        assert(report, 404, "Rapport chantier introuvable.");
        const progress = Math.round(
          formState.progressByLot.reduce((total, item) => total + item.progress, 0) /
            Math.max(formState.progressByLot.length, 1),
        );
        const completeness = Math.min(
          100,
          40 +
            (formState.workforceCount > 0 ? 20 : 0) +
            (formState.activities.trim().length > 20 ? 25 : 0) +
            (formState.incidents.trim().length > 5 ? 15 : 0),
        );

        report.date = formState.reportDate;
        report.weather = formState.weather;
        report.workforce = formState.workforceCount;
        report.progress = progress;
        report.summary = formState.activities.split("\n")[0] || report.summary;
        report.completeness = completeness;
        report.status = completeness >= 95 ? "Soumis" : "A completer";
        report.tone = completeness >= 95 ? "primary" : "warning";
        report.pdfReady = false;
        report.signedByCt = true;
        report.signedByMoe = false;
        report.ctSignatureBy = user.name;
        report.ctSignatureAt = toDateTimeLabel(nowTimestamp);
        report.moeSignatureBy = "";
        report.moeSignatureAt = "";
        report.activities = formState.activities;
        report.incidents = formState.incidents;
        report.note = formState.note;
        report.progressByLot = formState.progressByLot;
        project.site.reports = [
          report as unknown as (typeof project.site.reports)[number],
          ...project.site.reports.filter((item) => item.id !== reportId),
        ];
        project.site.lotProgress = formState.progressByLot;
        project.site.reportDraft = {
          reportDate: toDayMonth(formState.reportDate),
          weather: formState.weather,
          workforce: formState.workforceCount,
          completedLots: formState.activities
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
          blockers: formState.incidents,
          note: formState.note,
        };
        appendAudit(
          database,
          user.name,
          "a mis a jour un rapport chantier",
          `${project.summary.code} - ${reportId}`,
        );
        appendNotification(database, {
          actor: user.name,
          actorId: user.id,
          detail: `${project.summary.code} - ${reportId} a ete mis a jour avec les dernieres avancees du terrain.`,
          href: buildModuleHref("/site", { report: reportId, tab: "overview" }),
          permission: "site.view",
          projectCode: project.summary.code,
          projectId: project.summary.id,
          title: "Rapport chantier mis a jour",
          tone: "primary",
          type: "report",
        });
        break;
      }
      case "mark-pdf-ready": {
        ensurePermission(user, "site.report.create");
        const reportId = String(payload.reportId ?? "");
        const report = project.site.reports.find((item) => item.id === reportId) as
          | ((typeof project.site.reports)[number] & {
              ctSignatureAt?: string;
              ctSignatureBy?: string;
            })
          | undefined;
        assert(report, 404, "Rapport chantier introuvable.");
        assert(report.signedByCt, 400, "Le rapport doit etre signe cote conducteur avant generation PDF.");
        assert(report.completeness >= 95, 400, "Le rapport doit etre complet avant preparation du PDF.");
        report.pdfReady = true;
        report.status = "Pret validation";
        report.tone = "primary";
        appendAudit(database, user.name, "a prepare le PDF du RJC", reportId);
        appendNotification(database, {
          actor: user.name,
          actorId: user.id,
          channel: "In-app + email",
          detail: `${project.summary.code} - ${reportId} est pret pour signature et archivage.`,
          href: buildModuleHref("/site", { report: reportId, tab: "overview" }),
          roles: ["Chef de projet", "Bureau d'etudes", "Super Admin"],
          projectCode: project.summary.code,
          projectId: project.summary.id,
          requiresAction: true,
          title: "RJC pret pour signature",
          tone: "primary",
          type: "report",
        });
        break;
      }
      case "sign-report": {
        ensurePermission(user, "site.report.validate");
        const reportId = String(payload.reportId ?? "");
        const report = project.site.reports.find((item) => item.id === reportId) as
          | ((typeof project.site.reports)[number] & {
              moeSignatureAt?: string;
              moeSignatureBy?: string;
            })
          | undefined;
        assert(report, 404, "Rapport chantier introuvable.");
        assert(report.completeness >= 95, 400, "Le rapport doit etre complet avant validation.");
        ensureAssignedWorkflowOwner(user, project, "projectManagerId");
        report.signedByMoe = true;
        report.pdfReady = true;
        report.status = "Valide";
        report.tone = "success";
        report.moeSignatureBy = user.name;
        report.moeSignatureAt = toDateTimeLabel(nowTimestamp);
        appendAudit(database, user.name, "a valide un RJC", reportId);
        appendNotification(database, {
          actor: user.name,
          actorId: user.id,
          detail: `${project.summary.code} - ${reportId} a ete signe et archive dans le projet.`,
          href: buildModuleHref("/site", { report: reportId, tab: "overview" }),
          permission: "site.view",
          projectCode: project.summary.code,
          projectId: project.summary.id,
          title: "RJC valide",
          tone: "success",
          type: "report",
        });
        break;
      }
      case "add-photo": {
        ensurePermission(user, "site.photo.create");
        const draftPhoto = payload.draftPhoto as SiteModuleData["draftPhoto"];
        project.site.photoLibrary.unshift({
          id: `PH-${randomUUID().slice(0, 8)}`,
          title: draftPhoto.title,
          zone: draftPhoto.zone,
          lot: draftPhoto.lot,
          task: draftPhoto.task,
          time: "18:00",
          timestamp: nowTimestamp,
          geo: draftPhoto.geo,
          author: user.name,
          accent: "from-sky-500/55 to-violet-300/18",
        });
        project.site.draftPhoto = clone(draftPhoto);
        appendAudit(
          database,
          user.name,
          "a ajoute une photo chantier",
          `${project.summary.code} - ${draftPhoto.title}`,
        );
        break;
      }
      case "create-ncr": {
        ensurePermission(user, "site.ncr.create");
        const draftNcr = payload.draftNcr as SiteModuleData["draftNcr"];
        const ncrRef = `NC-${String(project.site.ncrs.length + 1).padStart(3, "0")}`;
        project.site.ncrs.unshift({
          ref: ncrRef,
          title: draftNcr.title,
          owner: draftNcr.owner,
          dueDate: draftNcr.dueDate,
          severity: draftNcr.severity,
          status: "En cours",
          tone:
            draftNcr.severity === "Critique"
              ? "danger"
              : draftNcr.severity === "Majeure"
                ? "warning"
                : "primary",
          photoAttached: draftNcr.photoAttached,
          description: draftNcr.description,
        });
        project.site.draftNcr = clone(draftNcr);
        appendAudit(
          database,
          user.name,
          "a cree une non-conformite",
          `${project.summary.code} - ${draftNcr.title}`,
        );
        appendNotification(database, {
          actor: user.name,
          actorId: user.id,
          detail: `${draftNcr.title} est assignee a ${draftNcr.owner} avec echeance au ${toDayMonth(draftNcr.dueDate)}.`,
          href: buildModuleHref("/site", { ncr: ncrRef, tab: "ncr" }),
          permission: "site.view",
          projectCode: project.summary.code,
          projectId: project.summary.id,
          requiresAction: true,
          title: "Nouvelle non-conformite ouverte",
          tone:
            draftNcr.severity === "Critique"
              ? "danger"
              : draftNcr.severity === "Majeure"
                ? "warning"
                : "primary",
          type: "ncr",
        });
        break;
      }
      case "close-ncr": {
        ensurePermission(user, "site.ncr.close");
        const ref = String(payload.ref ?? "");
        project.site.ncrs = project.site.ncrs.map((item) =>
          item.ref === ref
            ? ({
                ...item,
                status: "Levee",
                tone: "success",
              } as unknown as (typeof project.site.ncrs)[number])
            : item,
        );
        appendAudit(database, user.name, "a cloture une non-conformite", ref);
        appendNotification(database, {
          actor: user.name,
          actorId: user.id,
          detail: `${ref} a ete levee et sortie du suivi prioritaire.`,
          href: buildModuleHref("/site", { ncr: ref, tab: "ncr" }),
          permission: "site.view",
          projectCode: project.summary.code,
          projectId: project.summary.id,
          title: "Non-conformite cloturee",
          tone: "success",
          type: "ncr",
        });
        break;
      }
      default:
        throw new ApiError(400, "Action chantier inconnue.");
    }

    const { portfolioEntry } = recomputeProjectSummary(project);
    database.portfolio = database.portfolio.map((entry) =>
      entry.code === portfolioEntry.code ? portfolioEntry : entry,
    );

    return await deriveSiteData(database, project);
  });
}

export async function getDocumentsPayload(token: string, projectId: string) {
  const database = await readDatabase();
  ensureSystemUsers(database);
  const user = getUserForSession(database, token);
  assert(user, 401, "Session invalide ou expiree.");
  ensurePermission(user, "documents.view");
  ensureProjectAccess(user, projectId);
  return deriveDocumentsData(database, getProjectRecord(database, projectId));
}

export async function getDocumentFile(token: string, projectId: string, documentId: string) {
  const database = await readDatabase();
  ensureSystemUsers(database);
  const user = getUserForSession(database, token);
  assert(user, 401, "Session invalide ou expiree.");
  ensurePermission(user, "documents.view");
  ensureProjectAccess(user, projectId);
  const project = getProjectRecord(database, projectId);
  const document = project.documents.files.find((item) => item.id === documentId) as
    | DocumentFileRecord
    | undefined;

  assert(document, 404, "Document introuvable.");
  assert(document.filePath, 404, "Aucun fichier disponible pour ce document.");

  return {
    fileName: document.fileName ?? `${document.code}-${document.revision}.${document.format.toLowerCase()}`,
    filePath: document.filePath,
    mimeType: document.mimeType ?? "application/octet-stream",
  };
}

export async function getDocumentVersionFile(
  token: string,
  projectId: string,
  documentId: string,
  versionId: string,
) {
  const database = await readDatabase();
  ensureSystemUsers(database);
  const user = getUserForSession(database, token);
  assert(user, 401, "Session invalide ou expiree.");
  ensurePermission(user, "documents.view");
  ensureProjectAccess(user, projectId);
  const project = getProjectRecord(database, projectId);
  const document = project.documents.files.find((item) => item.id === documentId) as
    | DocumentFileRecord
    | undefined;

  assert(document, 404, "Document introuvable.");

  if (document.revision === versionId && document.filePath) {
    return {
      fileName:
        document.fileName ?? `${document.code}-${document.revision}.${document.format.toLowerCase()}`,
      filePath: document.filePath,
      mimeType: document.mimeType ?? "application/octet-stream",
    };
  }

  const version = (document.versions ?? []).find((item) => item.version === versionId);
  assert(version, 404, "Revision documentaire introuvable.");
  assert(version.filePath, 404, "Aucun fichier disponible pour cette revision.");

  return {
    fileName: version.fileName ?? `${document.code}-${version.version}.${document.format.toLowerCase()}`,
    filePath: version.filePath,
    mimeType: version.mimeType ?? "application/octet-stream",
  };
}

function archiveCurrentDocumentVersion(document: DocumentFileRecord) {
  const archivedVersions = (document.versions ?? []).map((version) => {
    if (version.version !== document.revision) {
      return version;
    }

    return {
      ...version,
      fileName: version.fileName ?? document.fileName,
      filePath: version.filePath ?? document.filePath,
      mimeType: version.mimeType ?? document.mimeType,
      publishedAt: version.publishedAt ?? document.publishedAt,
      status: version.status === "Courante" ? "Archive" : version.status,
    };
  });

  const hasCurrentVersion = archivedVersions.some((version) => version.version === document.revision);
  if (!hasCurrentVersion && document.revision) {
    archivedVersions.push({
      version: document.revision,
      publishedAt: document.publishedAt,
      status: "Archive",
      fileName: document.fileName,
      filePath: document.filePath,
      mimeType: document.mimeType,
    });
  }

  document.versions = archivedVersions as DocumentVersionRecord[];
}

export async function uploadDocumentVersion(
  token: string,
  projectId: string,
  payload: {
    documentId: string;
    file: File;
    format: string;
    revision: string;
  },
) {
  return updateDatabase(async (database) => {
    ensureSystemUsers(database);
    const user = getUserForSession(database, token);
    assert(user, 401, "Session invalide ou expiree.");
    ensurePermission(user, "documents.version.publish");
    ensureProjectAccess(user, projectId);
    const project = getProjectRecord(database, projectId);
    const document = project.documents.files.find((item) => item.id === payload.documentId) as
      | DocumentFileRecord
      | undefined;

    assert(document, 404, "Document introuvable.");
    const revision = payload.revision.trim();
    const format = payload.format.trim() || document.format;
    assert(revision, 400, "Revision requise.");
    assert(payload.file.size > 0, 400, "Fichier document requis.");

    const storedFile = await saveUploadedFile({
      bytes: new Uint8Array(await payload.file.arrayBuffer()),
      mimeType: payload.file.type,
      originalName: payload.file.name,
      projectId,
      segments: ["documents", document.id],
      storedName: `${document.code}-${revision}`,
    });

    archiveCurrentDocumentVersion(document);
    document.versions.push({
      version: revision,
      publishedAt: todayIso,
      status: "Courante",
      fileName: storedFile.fileName,
      filePath: storedFile.relativePath,
      mimeType: storedFile.mimeType,
    } as DocumentVersionRecord);
    document.revision = revision;
    document.format = format;
    document.publishedAt = todayIso;
    document.status = "Diffusion";
    document.tone = "primary";
    document.isCurrent = true;
    document.offlineReady = true;
    document.compareWith = document.versions.at(-2)?.version ?? revision;
    document.fileSizeMb = storedFile.fileSizeMb;
    document.fileName = storedFile.fileName;
    document.filePath = storedFile.relativePath;
    document.mimeType = storedFile.mimeType;
    document.storage = storedFile.relativePath;

    appendAudit(
      database,
      user.name,
      "a publie une nouvelle revision",
      `${document.code} ${revision}`,
    );
    appendNotification(database, {
      actor: user.name,
      actorId: user.id,
      channel: "In-app + email",
      detail: `${document.code} ${revision} est disponible et doit etre consulte par les equipes terrain et bureau.`,
      href: buildModuleHref("/documents", { document: document.id, tab: "versions" }),
      permission: "documents.view",
      projectCode: project.summary.code,
      projectId: project.summary.id,
      requiresAction: true,
      title: "Nouvelle revision publiee",
      tone: "primary",
      type: "document",
    });

    const { portfolioEntry } = recomputeProjectSummary(project);
    database.portfolio = database.portfolio.map((entry) =>
      entry.code === portfolioEntry.code ? portfolioEntry : entry,
    );

      return deriveDocumentsData(database, project);
    });
  }

export async function mutateDocumentsPayload(
  token: string,
  projectId: string,
  action: string,
  payload: Record<string, unknown>,
) {
  return updateDatabase(async (database) => {
    ensureSystemUsers(database);
    const user = getUserForSession(database, token);
    assert(user, 401, "Session invalide ou expiree.");
    ensurePermission(user, "documents.view");
    ensureProjectAccess(user, projectId);
    const project = getProjectRecord(database, projectId);
    const documentId = String(payload.documentId ?? "");
    const document = project.documents.files.find((item) => item.id === documentId);
    assert(document, 404, "Document introuvable.");

    switch (action) {
      case "publish-version": {
        ensurePermission(user, "documents.version.publish");
        const revision = String(payload.revision ?? "").trim();
        const format = String(payload.format ?? document.format).trim();
        assert(revision, 400, "Revision requise.");
        archiveCurrentDocumentVersion(document as DocumentFileRecord);
        document.versions.push({
          version: revision,
          publishedAt: todayIso,
          status: "Courante",
        } as DocumentVersionRecord);
        document.revision = revision;
        document.format = format;
        document.publishedAt = todayIso;
        document.status = "Diffusion";
        document.tone = "primary";
        document.isCurrent = true;
        document.offlineReady = true;
        document.compareWith = document.versions.at(-2)?.version ?? revision;
        appendAudit(
          database,
          user.name,
          "a publie une nouvelle revision",
          `${document.code} ${revision}`,
        );
        appendNotification(database, {
          actor: user.name,
          actorId: user.id,
          channel: "In-app + email",
          detail: `${document.code} ${revision} remplace la revision precedente et attend diffusion controlee.`,
          href: buildModuleHref("/documents", { document: document.id, tab: "versions" }),
          permission: "documents.view",
          projectCode: project.summary.code,
          projectId: project.summary.id,
          requiresAction: true,
          title: "Revision documentaire mise a jour",
          tone: "primary",
          type: "document",
        });
        break;
      }
      case "mark-obsolete": {
        ensurePermission(user, "documents.obsolete.mark");
        document.status = "Obsolete";
        document.tone = "warning";
        document.isCurrent = false;
        appendAudit(database, user.name, "a marque un plan obsolete", document.code);
        appendNotification(database, {
          actor: user.name,
          actorId: user.id,
          detail: `${document.code} n'est plus en vigueur. Les equipes doivent basculer sur la derniere revision active.`,
          href: buildModuleHref("/documents", { document: document.id, tab: "distribution" }),
          permission: "documents.view",
          projectCode: project.summary.code,
          projectId: project.summary.id,
          requiresAction: true,
          title: "Plan marque obsolete",
          tone: "warning",
          type: "document",
        });
        break;
      }
      case "update-metadata": {
        ensurePermission(user, "documents.version.publish");
        const title = String(payload.title ?? "").trim();
        const discipline = String(payload.discipline ?? "").trim();
        const lot = String(payload.lot ?? "").trim();
        const phase = String(payload.phase ?? "").trim();
        assert(title.length >= 3, 400, "Titre document requis.");
        assert(discipline.length >= 2, 400, "Discipline requise.");
        assert(lot.length >= 2, 400, "Lot requis.");
        assert(phase.length >= 2, 400, "Phase requise.");
        document.title = title;
        document.discipline = discipline;
        document.lot = lot;
        document.phase = phase;
        appendAudit(
          database,
          user.name,
          "a mis a jour les metadonnees d'un document",
          `${document.code} - ${title}`,
        );
        break;
      }
      case "distribute": {
        ensurePermission(user, "documents.distribute");
        const audience = String(payload.audience ?? "").trim();
        assert(audience, 400, "Audience de diffusion requise.");
        const projectMembers = deriveProjectMemberOptions(database, project);
        const distributionRecipients = resolveDistributionRecipients(projectMembers, audience);
        assert(distributionRecipients.length > 0, 400, "Aucun destinataire n'est associe a cette diffusion.");
        document.status = "Diffusion";
        document.tone = "primary";
        document.lastDistributedAt = todayIso;
        document.readCount = 0;
        document.recipients = distributionRecipients.length;
        project.documents.recipients = project.documents.recipients.filter(
          (item) => item.documentId !== documentId,
        );
        project.documents.recipients.push(
          ...distributionRecipients.map(
            (recipient): DocumentRecipientRecord => ({
              acknowledgedAt: "",
              audience,
              distributedAt: toDateTimeLabel(nowTimestamp),
              documentId,
              id: `REC-${randomUUID().slice(0, 8)}`,
              name: recipient.name,
              role: recipient.role,
              status: "Non lu",
              userId: recipient.id,
            }),
          ),
        );
        appendAudit(
          database,
          user.name,
          "a diffuse un document",
          `${document.code} vers ${audience}`,
        );
        appendNotification(database, {
          actor: user.name,
          actorId: user.id,
          channel: "In-app + email",
          detail: `${document.code} a ete diffuse a ${audience}. Un accuse de lecture est attendu.`,
          href: buildModuleHref("/documents", { document: document.id, tab: "distribution" }),
          permission: "documents.view",
          projectCode: project.summary.code,
          projectId: project.summary.id,
          requiresAction: true,
          title: "Diffusion de plan en cours",
          tone: "warning",
          type: "document",
        });
        break;
      }
      case "acknowledge": {
        const recipientId = String(payload.recipientId ?? "");
        const recipient = project.documents.recipients.find((item) => item.id === recipientId) as
          | DocumentRecipientRecord
          | undefined;
        assert(recipient, 404, "Destinataire introuvable.");
        if (recipient.userId) {
          assert(
            user.role === "Super Admin" || user.id === recipient.userId,
            403,
            "Seul le destinataire assigne peut accuser reception de ce document.",
          );
        } else {
          recipient.userId = user.id;
          recipient.name = user.name;
          recipient.role = user.role;
        }
        if (recipient.status === "Lu") {
          break;
        }
        recipient.status = "Lu";
        recipient.acknowledgedAt = toDateTimeLabel(nowTimestamp);
        document.readCount = Math.min(document.readCount + 1, document.recipients);
        appendAudit(database, user.name, "a accuse reception d'un plan", document.code);
        break;
      }
      case "toggle-offline": {
        document.offlineReady = !document.offlineReady;
        appendAudit(
          database,
          user.name,
          document.offlineReady ? "a ajoute un plan au cache offline" : "a retire un plan du cache offline",
          document.code,
        );
        break;
      }
      default:
        throw new ApiError(400, "Action documentaire inconnue.");
    }

    const { portfolioEntry } = recomputeProjectSummary(project);
    database.portfolio = database.portfolio.map((entry) =>
      entry.code === portfolioEntry.code ? portfolioEntry : entry,
    );

    return deriveDocumentsData(database, project);
  });
}

export async function getFinancePayload(token: string, projectId: string) {
  const database = await readDatabase();
  ensureSystemUsers(database);
  const user = getUserForSession(database, token);
  assert(user, 401, "Session invalide ou expiree.");
  ensurePermission(user, "finance.view");
  ensureProjectAccess(user, projectId);
  return deriveFinanceData(database, getProjectRecord(database, projectId));
}

export async function downloadInvoicePdf(token: string, projectId: string, invoiceId: string) {
  const database = await readDatabase();
  ensureSystemUsers(database);
  const user = getUserForSession(database, token);
  assert(user, 401, "Session invalide ou expiree.");
  ensurePermission(user, "finance.view");
  ensureProjectAccess(user, projectId);
  const project = getProjectRecord(database, projectId);
  const invoice = project.finance.invoices.find((item) => item.id === invoiceId);
  assert(invoice, 404, "Facture introuvable.");

  const bytes = await buildInvoicePdf({
    declarationStatus: project.finance.declaration.status,
    generatedAt: nowTimestamp,
    generatedBy: user.name,
    invoice: {
      advanceDeduction: invoice.advanceDeduction,
      amountHt: invoice.amountHt,
      amountTtc: invoice.amountTtc,
      dueDate: invoice.dueDate,
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      paidAt: invoice.paidAt,
      periodMonth: invoice.periodMonth,
      project: invoice.project,
      retentionAmount: invoice.retentionAmount,
      sourceProgress: invoice.sourceProgress,
      status: invoice.status,
      tvaAmount: invoice.tvaAmount,
      tvaRate: invoice.tvaRate,
      validatedByMo: invoice.validatedByMo,
      validatedByMoe: invoice.validatedByMoe,
    },
    payments: project.finance.payments
      .filter((payment) => payment.invoiceId === invoiceId)
      .map((payment) => ({
        amount: payment.amount,
        method: payment.method,
        paidAt: payment.paidAt,
        reference: payment.reference,
      })),
    project: {
      client: project.summary.client,
      code: project.summary.code,
      location: project.summary.location,
      name: project.summary.name,
    },
  });

  return {
    bytes,
    fileName: `${invoice.invoiceNumber}.pdf`,
  };
}

export async function mutateFinancePayload(
  token: string,
  projectId: string,
  action: string,
  payload: Record<string, unknown>,
) {
  return updateDatabase(async (database) => {
    ensureSystemUsers(database);
    const user = getUserForSession(database, token);
    assert(user, 401, "Session invalide ou expiree.");
    ensurePermission(user, "finance.view");
    ensureProjectAccess(user, projectId);
    const project = getProjectRecord(database, projectId);

    switch (action) {
      case "create-invoice": {
        ensurePermission(user, "finance.invoice.create");
        const dmDraft = payload.dmDraft as FinanceModuleData["dmDraft"];
        const periodMonth = normalizePeriodMonthInput(String(dmDraft.periodMonth ?? ""));
        const vatRegimeId = String(payload.vatRegimeId ?? project.finance.defaultVatRegimeId);
        const vatRegime =
          financeVatRegimes.find((item) => item.id === vatRegimeId) ?? financeVatRegimes[0];
        const retentionAmount = Math.round((dmDraft.baseAmountHt * dmDraft.retentionPct) / 100);
        const amountHt =
          dmDraft.baseAmountHt - retentionAmount - dmDraft.advanceDeduction;
        const tvaAmount = Math.round((amountHt * vatRegime.rate) / 100);
        const maxSuffix = project.finance.invoices.reduce((current, invoice) => {
          const numeric = Number(invoice.invoiceNumber.split("-").pop());
          return Number.isFinite(numeric) ? Math.max(current, numeric) : current;
        }, 0);

        project.finance.invoices.unshift({
          id: `INV-${randomUUID().slice(0, 8)}`,
          projectId,
          invoiceNumber: `FAC-2026-${String(maxSuffix + 1).padStart(3, "0")}`,
          project: project.summary.name,
          periodMonth,
          amountHt,
          tvaRate: vatRegime.rate,
          tvaAmount,
          amountTtc: amountHt + tvaAmount,
          dueDate: "2026-05-10",
          paidAt: "",
          status: "Brouillon",
          tone: "warning",
          retentionAmount,
          advanceDeduction: dmDraft.advanceDeduction,
          sourceProgress: dmDraft.progressPct,
          validatedByMoe: false,
          validatedByMo: false,
          moeValidatedBy: "",
          moeValidatedAt: "",
          moValidatedBy: "",
          moValidatedAt: "",
        } as unknown as (typeof project.finance.invoices)[number]);
        project.finance.dmDraft = clone(dmDraft);
        project.finance.defaultVatRegimeId = vatRegime.id;
        appendAudit(
          database,
          user.name,
          "a genere une facture",
          `${project.summary.code} - ${project.finance.invoices[0].invoiceNumber}`,
        );
        appendNotification(database, {
          actor: user.name,
          actorId: user.id,
          detail: `${project.finance.invoices[0].invoiceNumber} est prete pour envoi et validation client.`,
          href: buildModuleHref("/finance", {
            invoice: project.finance.invoices[0].id,
            tab: "invoices",
          }),
          permission: "finance.view",
          projectCode: project.summary.code,
          projectId: project.summary.id,
          requiresAction: true,
          title: "Nouvelle facture generee",
          tone: "warning",
          type: "invoice",
        });
        break;
      }
      case "send-invoice": {
        ensurePermission(user, "finance.invoice.send");
        const invoiceId = String(payload.invoiceId ?? "");
        const invoice = project.finance.invoices.find((item) => item.id === invoiceId) as
          | ((typeof project.finance.invoices)[number] & {
              moValidatedAt?: string;
              moValidatedBy?: string;
              moeValidatedAt?: string;
              moeValidatedBy?: string;
            })
          | undefined;
        assert(invoice, 404, "Facture introuvable.");
        invoice.status = invoice.validatedByMo
          ? "Validee"
          : invoice.validatedByMoe
            ? "Validation MO"
            : "Envoyee";
        invoice.tone = toInvoiceTone(invoice.status);
        appendAudit(database, user.name, "a envoye une facture", invoiceId);
        appendNotification(database, {
          actor: user.name,
          actorId: user.id,
          channel: "In-app + email",
          detail: `${invoice.invoiceNumber} a ete envoyee et attend la validation cote projet avant transmission finale au client.`,
          href: buildModuleHref("/finance", { invoice: invoice.id, tab: "invoices" }),
          roles: ["Chef de projet", "Super Admin"],
          projectCode: project.summary.code,
          projectId: project.summary.id,
          requiresAction: true,
          title: "Facture en attente validation projet",
          tone: "warning",
          type: "invoice",
        });
        break;
      }
      case "validate-invoice": {
        ensurePermission(user, "finance.invoice.validate");
        const invoiceId = String(payload.invoiceId ?? "");
        const invoice = project.finance.invoices.find((item) => item.id === invoiceId) as
          | ((typeof project.finance.invoices)[number] & {
              moValidatedAt?: string;
              moValidatedBy?: string;
              moeValidatedAt?: string;
              moeValidatedBy?: string;
            })
          | undefined;
        assert(invoice, 404, "Facture introuvable.");

        if (!invoice.validatedByMoe) {
          ensureAssignedWorkflowOwner(user, project, "projectManagerId");
          invoice.validatedByMoe = true;
          invoice.moeValidatedBy = user.name;
          invoice.moeValidatedAt = toDateTimeLabel(nowTimestamp);
          invoice.status = "Validation MO";
          invoice.tone = "primary";
          appendAudit(database, user.name, "a valide une facture cote projet", invoiceId);
          appendNotification(database, {
            actor: user.name,
            actorId: user.id,
            channel: "In-app + email",
            detail: `${invoice.invoiceNumber} est validee cote projet et attend maintenant la validation du maitre d'ouvrage.`,
            href: buildModuleHref("/finance", { invoice: invoice.id, tab: "invoices" }),
            roles: ["Maitre d'ouvrage", "Super Admin"],
            projectCode: project.summary.code,
            projectId: project.summary.id,
            requiresAction: true,
            title: "Facture en attente validation client",
            tone: "primary",
            type: "invoice",
          });
          break;
        }

        ensureAssignedWorkflowOwner(user, project, "clientApproverId");
        assert(invoice.validatedByMoe, 400, "La validation projet doit etre finalisee avant la validation client.");
        if (invoice.validatedByMo) {
          throw new ApiError(400, "Cette facture a deja ete validee.");
        }

        invoice.validatedByMo = true;
        invoice.moValidatedBy = user.name;
        invoice.moValidatedAt = toDateTimeLabel(nowTimestamp);
        invoice.status = "Validee";
        invoice.tone = "primary";
        appendAudit(database, user.name, "a valide une facture cote client", invoiceId);
        appendNotification(database, {
          actor: user.name,
          actorId: user.id,
          detail: `${invoice.invoiceNumber} a ete validee. Le suivi d'encaissement peut commencer.`,
          href: buildModuleHref("/finance", { invoice: invoice.id, tab: "invoices" }),
          permission: "finance.view",
          projectCode: project.summary.code,
          projectId: project.summary.id,
          title: "Facture validee",
          tone: "primary",
          type: "invoice",
        });
        break;
      }
      case "update-invoice-status": {
        const invoiceId = String(payload.invoiceId ?? "");
        const nextStatus = String(payload.status ?? "").trim();
        const invoice = project.finance.invoices.find((item) => item.id === invoiceId);
        const isSuperAdmin = user.role === "Super Admin";
        const canManageManualStatus =
          isSuperAdmin || isAssignedWorkflowOwner(user, project, "financeLeadId");
        const allowedStatuses = isSuperAdmin
          ? ["Brouillon", "Envoyee", "Validation MO", "Validee", "Payee", "Litigieuse"]
          : ["Brouillon", "Envoyee", "Litigieuse"];
        assert(canManageManualStatus, 403, "Referent finance assigne requis pour cette action.");
        assert(invoice, 404, "Facture introuvable.");
        assert(
          allowedStatuses.includes(nextStatus),
          400,
          "Statut facture invalide pour cette action.",
        );
        project.finance.invoices = project.finance.invoices.map((invoice) =>
          invoice.id === invoiceId
            ? {
                ...invoice,
                status: nextStatus,
                tone: toInvoiceTone(nextStatus),
                paidAt:
                  nextStatus === "Payee"
                    ? invoice.paidAt || nowTimestamp
                    : nextStatus === "Brouillon" || nextStatus === "Envoyee" || nextStatus === "Validation MO" || nextStatus === "Litigieuse"
                      ? ""
                      : invoice.paidAt,
                validatedByMoe:
                  nextStatus === "Validation MO" || nextStatus === "Validee" || nextStatus === "Payee"
                    ? true
                    : nextStatus === "Brouillon"
                      ? false
                      : nextStatus === "Envoyee" || nextStatus === "Litigieuse"
                        ? false
                        : invoice.validatedByMoe,
                validatedByMo:
                  nextStatus === "Validee" || nextStatus === "Payee"
                    ? true
                    : nextStatus === "Brouillon" || nextStatus === "Envoyee" || nextStatus === "Validation MO" || nextStatus === "Litigieuse"
                      ? false
                      : invoice.validatedByMo,
                moeValidatedBy:
                  nextStatus === "Validation MO" || nextStatus === "Validee" || nextStatus === "Payee"
                    ? (invoice as { moeValidatedBy?: string }).moeValidatedBy || user.name
                    : "",
                moeValidatedAt:
                  nextStatus === "Validation MO" || nextStatus === "Validee" || nextStatus === "Payee"
                    ? (invoice as { moeValidatedAt?: string }).moeValidatedAt || toDateTimeLabel(nowTimestamp)
                    : "",
                moValidatedBy:
                  nextStatus === "Validee" || nextStatus === "Payee"
                    ? (invoice as { moValidatedBy?: string }).moValidatedBy || user.name
                    : "",
                moValidatedAt:
                  nextStatus === "Validee" || nextStatus === "Payee"
                    ? (invoice as { moValidatedAt?: string }).moValidatedAt || toDateTimeLabel(nowTimestamp)
                    : "",
              }
            : invoice,
        );
        appendAudit(
          database,
          user.name,
          "a mis a jour le statut d'une facture",
          `${invoiceId} - ${nextStatus}`,
        );
        appendNotification(database, {
          actor: user.name,
          actorId: user.id,
          detail: `${invoice.invoiceNumber} passe au statut ${nextStatus.toLowerCase()}.`,
          href: buildModuleHref("/finance", { invoice: invoice.id, tab: "invoices" }),
          permission: "finance.view",
          projectCode: project.summary.code,
          projectId: project.summary.id,
          requiresAction: nextStatus === "Litigieuse",
          title: "Statut facture mis a jour",
          tone: toInvoiceTone(nextStatus),
          type: "invoice",
        });
        break;
      }
      case "register-payment": {
        ensurePermission(user, "finance.payment.record");
        const invoiceId = String(payload.invoiceId ?? "");
        const paymentDraft = payload.paymentDraft as FinanceModuleData["paymentDraft"];
        const invoice = project.finance.invoices.find((item) => item.id === invoiceId);
        assert(invoice, 404, "Facture introuvable.");
        assert(
          invoice.validatedByMo || invoice.status === "Payee",
          400,
          "La facture doit etre validee avant l'enregistrement d'un paiement.",
        );
        const amount = Number(paymentDraft.amount);
        assert(Number.isFinite(amount) && amount > 0, 400, "Montant de paiement invalide.");
        project.finance.payments.unshift({
          id: `PAY-${randomUUID().slice(0, 8)}`,
          invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          amount,
          method: paymentDraft.method,
          reference: paymentDraft.reference,
          paidAt: nowTimestamp,
        });
        const paidAmount = project.finance.payments
          .filter((payment) => payment.invoiceId === invoiceId)
          .reduce((total, payment) => total + payment.amount, 0);
        project.finance.invoices = project.finance.invoices.map((item) =>
          item.id === invoiceId
            ? {
                ...item,
                paidAt: paidAmount >= item.amountTtc ? nowTimestamp : item.paidAt,
                status: paidAmount >= item.amountTtc ? "Payee" : "Validee",
                tone: paidAmount >= item.amountTtc ? "success" : "primary",
              }
            : item,
        );
        project.finance.paymentDraft = clone(paymentDraft);
        appendAudit(
          database,
          user.name,
          "a enregistre un paiement",
          `${invoice.invoiceNumber} - ${amount.toLocaleString("fr-FR")} TND`,
        );
        appendNotification(database, {
          actor: user.name,
          actorId: user.id,
          detail: `${amount.toLocaleString("fr-FR")} TND recus sur ${invoice.invoiceNumber}.`,
          href: buildModuleHref("/finance", { invoice: invoice.id, tab: "invoices" }),
          permission: "finance.view",
          projectCode: project.summary.code,
          projectId: project.summary.id,
          title: "Paiement enregistre",
          tone: "success",
          type: "finance",
        });
        break;
      }
      default:
        throw new ApiError(400, "Action finance inconnue.");
    }

    const { portfolioEntry } = recomputeProjectSummary(project);
    database.portfolio = database.portfolio.map((entry) =>
      entry.code === portfolioEntry.code ? portfolioEntry : entry,
    );

    return deriveFinanceData(database, project);
  });
}
