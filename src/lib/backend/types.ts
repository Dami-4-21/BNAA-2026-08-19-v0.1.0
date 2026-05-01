import type { AppUser, SafeUser } from "@/lib/auth";
import type {
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
export type TeamMember = (typeof teamMembers)[number];
export type PortfolioProject = (typeof projects)[number];
export type RoleMatrixItem = (typeof roleMatrix)[number];
export type Tone = "neutral" | "primary" | "success" | "warning" | "danger";

export type DashboardAlert = {
  title: string;
  detail: string;
  time: string;
  tone: Tone;
};

export type NotificationType =
  | "admin"
  | "document"
  | "finance"
  | "invoice"
  | "ncr"
  | "project"
  | "report";

export type NotificationChannel = "In-app" | "In-app + email" | "Email";
export type NotificationEmailStatus =
  | "captured"
  | "failed"
  | "not_applicable"
  | "queued"
  | "sent";

export type NotificationRecord = {
  id: string;
  title: string;
  detail: string;
  channel: NotificationChannel;
  createdAt: string;
  href: string;
  tone: Tone;
  type: NotificationType;
  actor: string;
  projectId?: string;
  projectCode?: string;
  recipients: string[];
  readBy: string[];
  requiresAction: boolean;
  emailDeliveredAt?: string;
  emailError?: string;
  emailStatus: NotificationEmailStatus;
};

export type UserNotification = Omit<NotificationRecord, "readBy" | "recipients"> & {
  isRead: boolean;
  when: string;
};

export type AuditTrailItem = {
  actor: string;
  action: string;
  context: string;
  at: string;
  createdAt?: string;
  id?: string;
  projectCode?: string;
  projectId?: string;
};

export type ProjectMemberOption = {
  id: string;
  initials: string;
  name: string;
  role: string;
};

export type SiteModuleBaseData = ReturnType<typeof getSiteModuleData>;
export type DocumentsModuleBaseData = ReturnType<typeof getDocumentsModuleData>;
export type FinanceModuleBaseData = ReturnType<typeof getFinanceModuleData>;

export type SiteModuleData = SiteModuleBaseData & {
  projectMembers: ProjectMemberOption[];
  projectSetup: ProjectSetupRecord;
};

export type DocumentVersionRecord = DocumentsModuleBaseData["files"][number]["versions"][number] & {
  downloadUrl?: string;
  fileName?: string;
  filePath?: string;
  isCurrent?: boolean;
  mimeType?: string;
};

export type DocumentFileRecord = Omit<
  DocumentsModuleBaseData["files"][number],
  "versions"
> & {
  downloadUrl?: string;
  fileName?: string;
  filePath?: string;
  mimeType?: string;
  versions: DocumentVersionRecord[];
};

export type DocumentRecipientRecord = DocumentsModuleBaseData["recipients"][number] & {
  audience?: string;
  distributedAt?: string;
  userId?: string;
};

export type DocumentsModuleRecord = Omit<DocumentsModuleBaseData, "files" | "recipients"> & {
  files: DocumentFileRecord[];
  recipients: DocumentRecipientRecord[];
};

export type DocumentsModuleData = DocumentsModuleRecord & {
  distributionOptions: string[];
  projectMembers: ProjectMemberOption[];
  projectSetup: ProjectSetupRecord;
};

export type FinanceModuleData = FinanceModuleBaseData & {
  projectMembers: ProjectMemberOption[];
  projectSetup: ProjectSetupRecord;
};

export type SitePhotoRecord = SiteModuleBaseData["photoLibrary"][number] & {
  fileName?: string;
  filePath?: string;
  fileUrl?: string;
  mimeType?: string;
};

export type SessionRecord = {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

export type ProjectWorkflowOwnerKey =
  | "clientApproverId"
  | "designLeadId"
  | "financeLeadId"
  | "projectManagerId"
  | "siteLeadId";

export type ProjectWorkflowOwnersRecord = Record<ProjectWorkflowOwnerKey, string>;

export type ProjectSetupRecord = {
  lots: string[];
  memberIds: string[];
  phases: string[];
  workflowOwners: ProjectWorkflowOwnersRecord;
  zones: string[];
};

export type ProjectRecord = {
  summary: WorkspaceProject;
  setup: ProjectSetupRecord;
  site: SiteModuleBaseData;
  documents: DocumentsModuleRecord;
  finance: FinanceModuleBaseData;
};

export type DatabaseState = {
  tenant: TenantRecord;
  users: AppUser[];
  projects: Record<string, ProjectRecord>;
  alerts: DashboardAlert[];
  teamMembers: TeamMember[];
  notifications: NotificationRecord[];
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
  teamMembers: Array<{
    initials: string;
    name: string;
    role: string;
    state: string;
  }>;
  alerts: DashboardAlert[];
  hero: {
    projectStatus: string;
    invoicesDue: number;
    budgetTnd: number;
    spentTnd: number;
    nextMilestone: string;
    nextCheckpointDate: string;
    nextCheckpointTone: Tone;
    nextCheckpointDetail: string;
    focusLabel: string;
    focusDetail: string;
    focusTone: Tone;
    teamSize: number;
    actionRequiredCount: number;
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
  projects: Array<{
    summary: WorkspaceProject;
    memberCount: number;
    workflowOwners: Array<{
      id: string;
      label: string;
      name: string;
      role: string;
    }>;
  }>;
};

export type NotificationsPageData = {
  alerts: DashboardAlert[];
  notifications: UserNotification[];
  activity: AuditTrailItem[];
  summary: {
    actionRequiredCount: number;
    readCount: number;
    totalCount: number;
    unreadCount: number;
  };
};

export type AdminPageData = {
  teamMembers: TeamMember[];
  roleMatrix: RoleMatrixItem[];
  auditTrail: AuditTrailItem[];
  users: SafeUser[];
  availableProjects: WorkspaceProject[];
  projects: Array<{
    summary: WorkspaceProject;
    setup: ProjectSetupRecord;
    memberCount: number;
    members: Array<{
      id: string;
      initials: string;
      name: string;
      role: string;
    }>;
  }>;
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
