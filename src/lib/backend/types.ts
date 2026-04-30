import type { AppUser, SafeUser } from "@/lib/auth";
import type {
  alerts,
  auditTrail,
  notifications,
  projects,
  roleMatrix,
  teamMembers,
  tenant,
  workspaceProjects,
  getDocumentsModuleData,
  getFinanceModuleData,
  getSiteModuleData,
} from "@/lib/mock-data";

export type TenantRecord = typeof tenant;
export type WorkspaceProject = (typeof workspaceProjects)[number];
export type DashboardAlert = (typeof alerts)[number];
export type TeamMember = (typeof teamMembers)[number];
export type NotificationItem = (typeof notifications)[number];
export type PortfolioProject = (typeof projects)[number];
export type RoleMatrixItem = (typeof roleMatrix)[number];
export type AuditTrailItem = (typeof auditTrail)[number];

export type SiteModuleData = ReturnType<typeof getSiteModuleData>;
export type DocumentsModuleData = ReturnType<typeof getDocumentsModuleData>;
export type FinanceModuleData = ReturnType<typeof getFinanceModuleData>;
export type SitePhotoRecord = SiteModuleData["photoLibrary"][number] & {
  fileName?: string;
  filePath?: string;
  fileUrl?: string;
  mimeType?: string;
};
export type DocumentFileRecord = DocumentsModuleData["files"][number] & {
  downloadUrl?: string;
  fileName?: string;
  filePath?: string;
  mimeType?: string;
};

export type SessionRecord = {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

export type ProjectRecord = {
  summary: WorkspaceProject;
  site: SiteModuleData;
  documents: DocumentsModuleData;
  finance: FinanceModuleData;
};

export type DatabaseState = {
  tenant: TenantRecord;
  users: AppUser[];
  projects: Record<string, ProjectRecord>;
  alerts: DashboardAlert[];
  teamMembers: TeamMember[];
  notifications: NotificationItem[];
  portfolio: PortfolioProject[];
  roleMatrix: RoleMatrixItem[];
  auditTrail: AuditTrailItem[];
  sessions: SessionRecord[];
};

export type WorkspacePayload = {
  tenant: TenantRecord;
  currentUser: SafeUser;
  availableProjects: WorkspaceProject[];
};

export type DashboardPageData = {
  dashboardMetrics: Array<{
    label: string;
    value: string;
    delta: string;
    helper: string;
    tone: "primary" | "success" | "warning" | "danger";
  }>;
  teamMembers: TeamMember[];
  alerts: DashboardAlert[];
  hero: {
    projectStatus: string;
    invoicesDue: number;
    budgetTnd: number;
    spentTnd: number;
    nextMilestone: string;
    cadenceTitle: string;
    cadenceSteps: Array<{
      step: string;
      detail: string;
      tone: "primary" | "success" | "warning" | "danger";
    }>;
  };
  siteReports: SiteModuleData["reports"];
  documentVersions: Array<{
    name: string;
    discipline: string;
    revision: string;
    publishedBy: string;
    publishedAt: string;
    status: string;
    tone: "primary" | "success" | "warning" | "danger";
    acknowledged: string;
  }>;
  distributionQueue: Array<{
    audience: string;
    dueDate: string;
    acknowledgedRate: number;
    file: string;
  }>;
  invoiceMetrics: Array<{
    label: string;
    value: number;
    helper: string;
    tone: "primary" | "success" | "warning" | "danger";
  }>;
  invoices: Array<{
    number: string;
    project: string;
    amount: number;
    dueDate: string;
    status: string;
    tone: "primary" | "success" | "warning" | "danger";
  }>;
};

export type ProjectsPageData = {
  projects: PortfolioProject[];
};

export type NotificationsPageData = {
  alerts: DashboardAlert[];
  notifications: NotificationItem[];
};

export type AdminPageData = {
  teamMembers: TeamMember[];
  roleMatrix: RoleMatrixItem[];
  auditTrail: AuditTrailItem[];
  users: SafeUser[];
  availableProjects: WorkspaceProject[];
  tenant: TenantRecord;
};

export type GlobalSearchResult = {
  href: string;
  id: string;
  label: string;
  meta: string;
  projectCode?: string;
  projectId?: string;
  section: "document" | "invoice" | "project" | "report" | "user";
};

export type GlobalSearchPayload = {
  query: string;
  results: GlobalSearchResult[];
};
