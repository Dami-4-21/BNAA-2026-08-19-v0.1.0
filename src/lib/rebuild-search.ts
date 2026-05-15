import type { GlobalSearchPayload, GlobalSearchResult, WorkspaceProject } from "@/lib/backend/types";
import {
  fetchRebuildBridgeContext,
  fetchRebuildJson,
  type RebuildProjectScope,
} from "@/lib/rebuild-auth";
import {
  findPilotProjectCompatibilityByBackendId,
  findPilotProjectCompatibilityByName,
} from "@/lib/server/pilot-seed";

type RebuildDocumentSearchResponse = {
  items: Array<{
    code: string;
    id: string;
    sourceModule: string;
    status: string;
    title: string;
  }>;
};

type RebuildInvoiceListResponse = {
  items: Array<{
    amountTtc: number;
    dueDate: string;
    id: string;
    invoiceNumber: string;
    periodMonth: string;
    projectId: string;
    projectName: string | null;
    status: string;
  }>;
};

type RebuildReportListResponse = {
  items: Array<{
    activities: string;
    id: string;
    notes: string;
    reportDate: string;
    status: string;
    weather: string;
  }>;
};

type RebuildUsersListResponse = {
  items: Array<{
    email: string;
    fullName: string;
    id: string;
    role: string;
  }>;
};

type BridgedSearchProject = {
  backendId: string;
  client: string;
  code: string;
  legacyId: string;
  location: string;
  name: string;
  nextMilestone: string;
};

const sectionOrder: Record<GlobalSearchResult["section"], number> = {
  project: 0,
  report: 1,
  document: 2,
  invoice: 3,
  user: 4,
};

export async function fetchRebuildSearchPayload(
  accessToken: string,
  projectCatalog: WorkspaceProject[],
  query: string,
): Promise<GlobalSearchPayload | null> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) {
    return {
      query: trimmedQuery,
      results: [],
    };
  }

  const context = await fetchRebuildBridgeContext(accessToken, projectCatalog);
  if (!context || context.projectScope.hasCompatibilityGap) {
    return null;
  }

  const needle = normalizeSearchText(trimmedQuery);
  const bridgedProjects = buildBridgedSearchProjects(context.projectScope, projectCatalog);
  if (bridgedProjects.length !== context.projectScope.rebuildProjects.length) {
    return null;
  }

  const [reportResults, documentResults, invoiceResults, userResults] = await Promise.all([
    context.session.permissions.includes("site.view")
      ? searchReports(accessToken, bridgedProjects, needle)
      : Promise.resolve<GlobalSearchResult[]>([]),
    context.session.permissions.includes("documents.view")
      ? searchDocuments(accessToken, bridgedProjects, trimmedQuery)
      : Promise.resolve<GlobalSearchResult[]>([]),
    context.session.permissions.includes("finance.view")
      ? searchInvoices(accessToken, bridgedProjects, needle)
      : Promise.resolve<GlobalSearchResult[]>([]),
    context.session.permissions.includes("admin.view")
      ? searchUsers(accessToken, needle)
      : Promise.resolve<GlobalSearchResult[]>([]),
  ]);

  const projectResults = context.session.permissions.includes("projects.view")
    ? searchProjects(bridgedProjects, needle)
    : [];

  return {
    query: trimmedQuery,
    results: [
      ...projectResults,
      ...reportResults,
      ...documentResults,
      ...invoiceResults,
      ...userResults,
    ]
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

function buildBridgedSearchProjects(
  projectScope: RebuildProjectScope,
  projectCatalog: WorkspaceProject[],
) {
  const catalogById = new Map(projectCatalog.map((project) => [project.id, project]));

  return projectScope.rebuildProjects
    .map((project) => {
      const compatibility =
        findPilotProjectCompatibilityByBackendId(project.id) ??
        findPilotProjectCompatibilityByName(project.name);
      if (!compatibility) {
        return null;
      }

      const legacyProject = catalogById.get(compatibility.legacyId);
      if (!legacyProject) {
        return null;
      }

      return {
        backendId: project.id,
        client: legacyProject.client,
        code: legacyProject.code,
        legacyId: legacyProject.id,
        location: legacyProject.location,
        name: legacyProject.name,
        nextMilestone: legacyProject.nextMilestone,
      } satisfies BridgedSearchProject;
    })
    .filter((project): project is BridgedSearchProject => project !== null);
}

function searchProjects(projects: BridgedSearchProject[], needle: string) {
  return projects
    .filter((project) =>
      normalizeSearchText([
        project.name,
        project.code,
        project.client,
        project.location,
        project.nextMilestone,
      ]).includes(needle),
    )
    .map<GlobalSearchResult>((project) => ({
      href: "/",
      id: `project-${project.legacyId}`,
      label: project.name,
      meta: `${project.code} · ${project.client} · ${project.location}`,
      projectCode: project.code,
      projectId: project.legacyId,
      section: "project",
    }));
}

async function searchReports(
  accessToken: string,
  projects: BridgedSearchProject[],
  needle: string,
) {
  const responses = await Promise.all(
    projects.map(async (project) => ({
      project,
      payload: await fetchRebuildJson<RebuildReportListResponse>(
        `/api/v1/projects/${project.backendId}/reports`,
        accessToken,
      ),
    })),
  );

  return responses.flatMap(({ project, payload }) =>
    (payload?.items ?? [])
      .filter((report) =>
        normalizeSearchText([
          report.id,
          report.activities,
          report.notes,
          report.reportDate,
          report.status,
          report.weather,
        ]).includes(needle),
      )
      .map<GlobalSearchResult>((report) => ({
        href: buildModuleHref("/site", {
          report: report.id,
          tab: "overview",
        }),
        id: `report-${project.legacyId}-${report.id}`,
        label: `RJC · ${toDayMonth(report.reportDate)}`,
        meta: `${project.code} · ${toStatusLabel(report.status)} · ${compactText(
          report.activities || report.notes || "Rapport chantier",
          52,
        )}`,
        projectCode: project.code,
        projectId: project.legacyId,
        section: "report",
      })),
  );
}

async function searchDocuments(
  accessToken: string,
  projects: BridgedSearchProject[],
  query: string,
) {
  const responses = await Promise.all(
    projects.map(async (project) => ({
      project,
      payload: await fetchRebuildJson<RebuildDocumentSearchResponse>(
        `/api/v1/projects/${project.backendId}/documents/search?q=${encodeURIComponent(query)}`,
        accessToken,
      ),
    })),
  );

  return responses.flatMap(({ project, payload }) =>
    (payload?.items ?? []).map<GlobalSearchResult>((document) => ({
      href: buildModuleHref("/documents", {
        document: document.id,
        tab: "versions",
      }),
      id: `document-${project.legacyId}-${document.id}`,
      label: `${document.code} · ${document.title}`,
      meta: `${project.code} · ${document.sourceModule} · ${toStatusLabel(document.status)}`,
      projectCode: project.code,
      projectId: project.legacyId,
      section: "document",
    })),
  );
}

async function searchInvoices(
  accessToken: string,
  projects: BridgedSearchProject[],
  needle: string,
) {
  const responses = await Promise.all(
    projects.map(async (project) => ({
      project,
      payload: await fetchRebuildJson<RebuildInvoiceListResponse>(
        `/api/v1/projects/${project.backendId}/invoices`,
        accessToken,
      ),
    })),
  );

  return responses.flatMap(({ project, payload }) =>
    (payload?.items ?? [])
      .filter((invoice) =>
        normalizeSearchText([
          invoice.invoiceNumber,
          invoice.projectName ?? project.name,
          invoice.status,
          invoice.periodMonth,
          String(invoice.amountTtc),
        ]).includes(needle),
      )
      .map<GlobalSearchResult>((invoice) => ({
        href: buildModuleHref("/finance", {
          invoice: invoice.id,
          tab: "invoices",
        }),
        id: `invoice-${project.legacyId}-${invoice.id}`,
        label: `${invoice.invoiceNumber} · ${toStatusLabel(invoice.status)}`,
        meta: `${project.code} · ${formatMoney(invoice.amountTtc)} TND · echeance ${toDayMonth(
          invoice.dueDate,
        )}`,
        projectCode: project.code,
        projectId: project.legacyId,
        section: "invoice",
      })),
  );
}

async function searchUsers(accessToken: string, needle: string) {
  const payload = await fetchRebuildJson<RebuildUsersListResponse>("/api/v1/users", accessToken);
  if (!payload) {
    return [];
  }

  return payload.items
    .filter((user) =>
      normalizeSearchText([user.fullName, user.email, user.role]).includes(needle),
    )
    .map<GlobalSearchResult>((user) => ({
      href: "/admin",
      id: `user-${user.id}`,
      label: user.fullName,
      meta: `${toRoleLabel(user.role)} · ${user.email}`,
      section: "user",
    }));
}

function buildModuleHref(path: string, params: Record<string, string>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    searchParams.set(key, value);
  });
  return `${path}?${searchParams.toString()}`;
}

function normalizeSearchText(values: Array<string | null | undefined> | string) {
  const raw = Array.isArray(values) ? values.join(" ") : values;
  return raw.trim().toLowerCase();
}

function compactText(value: string, maxLength: number) {
  const text = value.trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function toDayMonth(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(value);
}

function toStatusLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function toRoleLabel(value: string) {
  switch (value) {
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
      return "Maitre d'ouvrage";
    default:
      return value;
  }
}
