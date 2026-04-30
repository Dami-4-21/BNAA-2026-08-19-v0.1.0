import { randomUUID } from "node:crypto";

import {
  canAccessProject,
  getHomePathForRole,
  getPermissionsForRole,
  hasPermission,
  sanitizeUser,
  type AppPermission,
  type AppUser,
  type SafeUser,
} from "@/lib/auth";
import { financeVatRegimes } from "@/lib/mock-data";
import { createSessionExpiry, createSessionToken } from "@/lib/backend/session";
import { readDatabase, updateDatabase } from "@/lib/backend/store";
import type {
  AdminPageData,
  DashboardPageData,
  DatabaseState,
  DocumentsModuleData,
  FinanceModuleData,
  NotificationsPageData,
  ProjectsPageData,
  ProjectRecord,
  SessionRecord,
  SiteModuleData,
  WorkspacePayload,
} from "@/lib/backend/types";

const todayIso = "2026-04-30";
const nowTimestamp = "2026-04-30T18:00:00.000Z";

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

function toProjectHealth(progress: number, overdueInvoices: number, unreadDocs: number) {
  if (overdueInvoices > 0) {
    return { health: "Encaissement critique", tone: "danger" as const };
  }

  if (unreadDocs > 0 || progress < 50) {
    return { health: "Attention docs", tone: "warning" as const };
  }

  return { health: "Sous controle", tone: "success" as const };
}

function getUserAccessibleProjects(database: DatabaseState, user: AppUser | SafeUser) {
  return Object.values(database.projects)
    .map((project) => project.summary)
    .filter((project) => canAccessProject(user, project.id));
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
    at: toDateTimeLabel(nowTimestamp),
  });
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
  const health = toProjectHealth(project.summary.progress, invoicesDue, unreadDocs);

  project.summary.progress = latestReport?.progress ?? project.summary.progress;
  project.summary.spentTnd = spentTnd;
  project.summary.invoicesDue = invoicesDue;
  project.summary.status =
    project.summary.progress >= 75 ? "Phase encaissement" : "En execution";
  project.summary.nextMilestone =
    latestReport?.summary ?? project.summary.nextMilestone;

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

function deriveSiteData(project: ProjectRecord): SiteModuleData {
  const site = clone(project.site);
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
    site.lotProgress.reduce(
      (total, item) => total + (item.progress - item.planned),
      0,
    ) / Math.max(site.lotProgress.length, 1),
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
        ? `Dernier RJC ${latestReport.id} - ${latestReport.signedByCt ? "signature recue" : "signature en attente"}`
        : "Aucun rapport disponible",
      tone: latestReport?.signedByCt ? "success" : "warning",
    },
    {
      role: "Maitre d'oeuvre",
      state: latestReport?.signedByMoe ? "Signe" : "En attente",
      note: latestReport
        ? `Rapport ${latestReport.id} ${latestReport.signedByMoe ? "valide" : "a valider"}`
        : "Aucun rapport disponible",
      tone: latestReport?.signedByMoe ? "success" : "warning",
    },
    {
      role: "Archivage PDF",
      state: latestReport?.pdfReady ? "Pret" : "En attente",
      note: latestReport
        ? `Generation ${latestReport.pdfReady ? "prete" : "en attente"} pour ${latestReport.id}`
        : "Aucun PDF a produire",
      tone: latestReport?.pdfReady ? "primary" : "warning",
    },
  ];

  return site;
}

function deriveDocumentsData(project: ProjectRecord): DocumentsModuleData {
  const documents = clone(project.documents);
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

  return documents;
}

function deriveFinanceData(project: ProjectRecord): FinanceModuleData {
  const finance = clone(project.finance);
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

  return finance;
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

function buildDashboardData(
  database: DatabaseState,
  user: AppUser | SafeUser,
  projectId: string,
): DashboardPageData {
  ensureProjectAccess(user, projectId);
  const project = getProjectRecord(database, projectId);
  const site = deriveSiteData(project);
  const documents = deriveDocumentsData(project);
  const finance = deriveFinanceData(project);

  return {
    dashboardMetrics: buildDashboardMetrics(project),
    teamMembers: clone(database.teamMembers),
    alerts: clone(database.alerts),
    hero: {
      projectStatus: project.summary.status,
      invoicesDue: project.summary.invoicesDue,
      budgetTnd: project.summary.budgetTnd,
      spentTnd: project.summary.spentTnd,
      nextMilestone: project.summary.nextMilestone,
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
  const user = getUserForSession(database, token);
  assert(user, 401, "Session invalide ou expiree.");
  return buildDashboardData(database, user, projectId);
}

export async function getProjectsPayload(token: string): Promise<ProjectsPageData> {
  const database = await readDatabase();
  const user = getUserForSession(database, token);
  assert(user, 401, "Session invalide ou expiree.");

  const accessibleCodes = new Set(
    getUserAccessibleProjects(database, user).map((project) => project.code),
  );

  return {
    projects: clone(database.portfolio).filter((project) => accessibleCodes.has(project.code)),
  };
}

export async function getNotificationsPayload(token: string): Promise<NotificationsPageData> {
  const database = await readDatabase();
  const user = getUserForSession(database, token);
  assert(user, 401, "Session invalide ou expiree.");
  ensurePermission(user, "notifications.view");

  return {
    alerts: clone(database.alerts),
    notifications: clone(database.notifications),
  };
}

export async function getAdminPayload(token: string): Promise<AdminPageData> {
  const database = await readDatabase();
  const user = getUserForSession(database, token);
  assert(user, 401, "Session invalide ou expiree.");
  ensurePermission(user, "admin.view");

  return {
    teamMembers: clone(database.teamMembers),
    roleMatrix: clone(database.roleMatrix),
    auditTrail: clone(database.auditTrail),
  };
}

export async function getSitePayload(token: string, projectId: string) {
  const database = await readDatabase();
  const user = getUserForSession(database, token);
  assert(user, 401, "Session invalide ou expiree.");
  ensurePermission(user, "site.view");
  ensureProjectAccess(user, projectId);
  return deriveSiteData(getProjectRecord(database, projectId));
}

export async function mutateSitePayload(
  token: string,
  projectId: string,
  action: string,
  payload: Record<string, unknown>,
) {
  return updateDatabase(async (database) => {
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

        project.site.reports.unshift({
          id: `RJC-${randomUUID().slice(0, 8)}`,
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
        });

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
          `${project.summary.code} - ${project.site.reports[0].summary}`,
        );
        break;
      }
      case "mark-pdf-ready": {
        const reportId = String(payload.reportId ?? "");
        project.site.reports = project.site.reports.map((report) =>
          report.id === reportId
            ? { ...report, pdfReady: true, status: "Pret PDF", tone: "primary" }
            : report,
        );
        appendAudit(database, user.name, "a prepare le PDF du RJC", reportId);
        break;
      }
      case "sign-report": {
        const reportId = String(payload.reportId ?? "");
        project.site.reports = project.site.reports.map((report) =>
          report.id === reportId
            ? { ...report, signedByMoe: true, pdfReady: true, status: "Signe", tone: "success" }
            : report,
        );
        appendAudit(database, user.name, "a valide un RJC", reportId);
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
        project.site.ncrs.unshift({
          ref: `NC-${String(project.site.ncrs.length + 1).padStart(3, "0")}`,
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
        break;
      }
      default:
        throw new ApiError(400, "Action chantier inconnue.");
    }

    const { portfolioEntry } = recomputeProjectSummary(project);
    database.portfolio = database.portfolio.map((entry) =>
      entry.code === portfolioEntry.code ? portfolioEntry : entry,
    );

    return deriveSiteData(project);
  });
}

export async function getDocumentsPayload(token: string, projectId: string) {
  const database = await readDatabase();
  const user = getUserForSession(database, token);
  assert(user, 401, "Session invalide ou expiree.");
  ensurePermission(user, "documents.view");
  ensureProjectAccess(user, projectId);
  return deriveDocumentsData(getProjectRecord(database, projectId));
}

export async function mutateDocumentsPayload(
  token: string,
  projectId: string,
  action: string,
  payload: Record<string, unknown>,
) {
  return updateDatabase(async (database) => {
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
        document.versions = document.versions.map((version) =>
          version.status === "Courante" ? { ...version, status: "Archive" } : version,
        );
        document.versions.push({
          version: revision,
          publishedAt: todayIso,
          status: "Courante",
        });
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
        break;
      }
      case "mark-obsolete": {
        ensurePermission(user, "documents.obsolete.mark");
        document.status = "Obsolete";
        document.tone = "warning";
        document.isCurrent = false;
        appendAudit(database, user.name, "a marque un plan obsolete", document.code);
        break;
      }
      case "distribute": {
        ensurePermission(user, "documents.distribute");
        const audience = String(payload.audience ?? "").trim();
        assert(audience, 400, "Audience de diffusion requise.");
        document.status = "Diffusion";
        document.tone = "primary";
        document.lastDistributedAt = todayIso;
        document.recipients = Math.max(document.recipients, document.readCount + 1);
        project.documents.recipients.push({
          id: `REC-${randomUUID().slice(0, 8)}`,
          documentId,
          name: audience,
          role: "Liste de diffusion",
          status: "Non lu",
          acknowledgedAt: "",
        });
        appendAudit(
          database,
          user.name,
          "a diffuse un document",
          `${document.code} vers ${audience}`,
        );
        break;
      }
      case "acknowledge": {
        const recipientId = String(payload.recipientId ?? "");
        const recipient = project.documents.recipients.find((item) => item.id === recipientId);
        assert(recipient, 404, "Destinataire introuvable.");
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

    return deriveDocumentsData(project);
  });
}

export async function getFinancePayload(token: string, projectId: string) {
  const database = await readDatabase();
  const user = getUserForSession(database, token);
  assert(user, 401, "Session invalide ou expiree.");
  ensurePermission(user, "finance.view");
  ensureProjectAccess(user, projectId);
  return deriveFinanceData(getProjectRecord(database, projectId));
}

export async function mutateFinancePayload(
  token: string,
  projectId: string,
  action: string,
  payload: Record<string, unknown>,
) {
  return updateDatabase(async (database) => {
    const user = getUserForSession(database, token);
    assert(user, 401, "Session invalide ou expiree.");
    ensurePermission(user, "finance.view");
    ensureProjectAccess(user, projectId);
    const project = getProjectRecord(database, projectId);

    switch (action) {
      case "create-invoice": {
        ensurePermission(user, "finance.invoice.create");
        const dmDraft = payload.dmDraft as FinanceModuleData["dmDraft"];
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
          periodMonth: dmDraft.periodMonth,
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
        });
        project.finance.dmDraft = clone(dmDraft);
        project.finance.defaultVatRegimeId = vatRegime.id;
        appendAudit(
          database,
          user.name,
          "a genere une facture",
          `${project.summary.code} - ${project.finance.invoices[0].invoiceNumber}`,
        );
        break;
      }
      case "send-invoice": {
        ensurePermission(user, "finance.invoice.send");
        const invoiceId = String(payload.invoiceId ?? "");
        project.finance.invoices = project.finance.invoices.map((invoice) =>
          invoice.id === invoiceId ? { ...invoice, status: "Envoyee", tone: "primary" } : invoice,
        );
        appendAudit(database, user.name, "a envoye une facture", invoiceId);
        break;
      }
      case "validate-invoice": {
        ensurePermission(user, "finance.invoice.validate");
        const invoiceId = String(payload.invoiceId ?? "");
        project.finance.invoices = project.finance.invoices.map((invoice) =>
          invoice.id === invoiceId
            ? {
                ...invoice,
                status: "Validee",
                tone: "primary",
                validatedByMo: true,
                validatedByMoe: true,
              }
            : invoice,
        );
        appendAudit(database, user.name, "a valide une facture", invoiceId);
        break;
      }
      case "register-payment": {
        ensurePermission(user, "finance.payment.record");
        const invoiceId = String(payload.invoiceId ?? "");
        const paymentDraft = payload.paymentDraft as FinanceModuleData["paymentDraft"];
        const invoice = project.finance.invoices.find((item) => item.id === invoiceId);
        assert(invoice, 404, "Facture introuvable.");
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
        break;
      }
      default:
        throw new ApiError(400, "Action finance inconnue.");
    }

    const { portfolioEntry } = recomputeProjectSummary(project);
    database.portfolio = database.portfolio.map((entry) =>
      entry.code === portfolioEntry.code ? portfolioEntry : entry,
    );

    return deriveFinanceData(project);
  });
}
