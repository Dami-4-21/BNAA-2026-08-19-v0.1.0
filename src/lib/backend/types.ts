import type { AppUser, SafeUser } from "@/lib/auth";

export type TenantRecord = {
  name: string;
  sector: string;
  users: number;
  activeProjects: number;
};

export type WorkspaceProject = {
  id: string;
  name: string;
  code: string;
  client: string;
  location: string;
  status: string;
  progress: number;
  budgetTnd: number;
  spentTnd: number;
  invoicesDue: number;
  nextMilestone: string;
  allowedRoles: string[];
};

export type TeamMember = {
  name: string;
  role: string;
  initials: string;
  state: string;
};

export type PortfolioProject = {
  name: string;
  code: string;
  location: string;
  progress: number;
  budget: number;
  health: string;
  tone: Tone;
  nextMilestone: string;
};

export type RoleMatrixItem = {
  role: string;
  access: string;
};

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

export type MetricCard = {
  label: string;
  value: string;
  helper: string;
  tone: Tone;
};

export type SiteWeatherCard = {
  label: string;
  temperature: string;
  wind: string;
  rainRisk: string;
  source: string;
};

export type SiteLotProgressRecord = {
  lot: string;
  task: string;
  progress: number;
  planned: number;
  owner: string;
  tone: "primary" | "success" | "warning" | "danger";
};

export type SiteSignatureQueueRecord = {
  role: string;
  state: string;
  note: string;
  tone: Tone;
};

export type SiteReportRecord = {
  id: string;
  date: string;
  weather: string;
  workforce: number;
  progress: number;
  author: string;
  status: string;
  tone: "primary" | "success" | "warning" | "danger";
  summary: string;
  completeness: number;
  pdfReady: boolean;
  signedByCt: boolean;
  signedByMoe: boolean;
  ctSignatureAt?: string;
  moeSignatureAt?: string;
  completedLots?: string[];
  blockers?: string;
  note?: string;
  incidents?: string;
  activities?: string;
  ctSignatureBy?: string;
  moeSignatureBy?: string;
  progressByLot?: Array<{
    lot: string;
    progress: number;
    task: string;
    tone: "primary" | "success" | "warning" | "danger";
  }>;
  pdfUrl?: string;
};

export type SitePhotoBaseRecord = {
  id: string;
  title: string;
  zone: string;
  lot: string;
  task: string;
  time: string;
  timestamp: string;
  geo: string;
  author: string;
  accent: string;
};

export type SiteNcrBaseRecord = {
  ref: string;
  title: string;
  owner: string;
  dueDate: string;
  severity: string;
  status: string;
  tone: "primary" | "success" | "warning" | "danger";
  photoAttached: boolean;
  description: string;
  closedAt?: string;
  closedBy?: string;
};

export type SiteReportDraft = {
  reportDate: string;
  weather: string;
  workforce: number;
  completedLots: string[];
  blockers: string;
  note: string;
};

export type SitePhotoDraft = {
  title: string;
  zone: string;
  lot: string;
  task: string;
  geo: string;
};

export type SiteNcrDraft = {
  title: string;
  owner: string;
  dueDate: string;
  severity: string;
  description: string;
  photoAttached: boolean;
};

export type SiteModuleBaseData = {
  overview: {
    weather: SiteWeatherCard;
    kpis: MetricCard[];
  };
  lotProgress: SiteLotProgressRecord[];
  signatureQueue: SiteSignatureQueueRecord[];
  incidentTemplates: string[];
  photoLibrary: SitePhotoBaseRecord[];
  ncrs: SiteNcrBaseRecord[];
  reports: SiteReportRecord[];
  reportDraft: SiteReportDraft;
  draftPhoto: SitePhotoDraft;
  draftNcr: SiteNcrDraft;
};

export type DocumentVersionBaseRecord = {
  version: string;
  publishedAt: string;
  status: string;
};

export type DocumentFileBaseRecord = {
  id: string;
  code: string;
  title: string;
  discipline: string;
  lot: string;
  phase: string;
  format: string;
  revision: string;
  fileSizeMb: number;
  uploadedBy: string;
  publishedAt: string;
  status: string;
  tone: "primary" | "success" | "warning" | "danger";
  isCurrent: boolean;
  offlineReady: boolean;
  lastDistributedAt: string;
  readCount: number;
  recipients: number;
  storage: string;
  versions: DocumentVersionBaseRecord[];
  compareWith: string;
};

export type DocumentRecipientBaseRecord = {
  id: string;
  documentId: string;
  name: string;
  role: string;
  status: string;
  acknowledgedAt: string;
};

export type DocumentsModuleBaseData = {
  overview: {
    kpis: MetricCard[];
    offline: {
      syncedAt: string;
      cachedFiles: number;
      coverage: string;
    };
  };
  tree: Array<{
    title: string;
    nodes: Array<{
      label: string;
      phases: string[];
    }>;
  }>;
  files: DocumentFileBaseRecord[];
  recipients: DocumentRecipientBaseRecord[];
  draftVersion: {
    revision: string;
    format: string;
    audience: string;
  };
};

export type FinanceInvoiceRecord = {
  id: string;
  projectId: string;
  invoiceNumber: string;
  project: string;
  periodMonth: string;
  amountHt: number;
  tvaRate: number;
  tvaAmount: number;
  amountTtc: number;
  dueDate: string;
  paidAt: string;
  status: string;
  tone: "primary" | "success" | "warning" | "danger";
  retentionAmount: number;
  advanceDeduction: number;
  sourceProgress: number;
  validatedByMoe: boolean;
  validatedByMo: boolean;
  moeValidatedBy?: string;
  moeValidatedAt?: string;
  moValidatedBy?: string;
  moValidatedAt?: string;
};

export type FinancePaymentRecord = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  method: string;
  reference: string;
  paidAt: string;
};

export type FinanceModuleBaseData = {
  overview: {
    kpis: MetricCard[];
    treasuryAlert: string;
  };
  invoices: FinanceInvoiceRecord[];
  payments: FinancePaymentRecord[];
  cashflow: Array<{
    label: string;
    plannedReceipts: number;
    actualReceipts: number;
    actualCosts: number;
  }>;
  declaration: {
    month: string;
    collectedTva: number;
    declaredTva: number;
    variance: number;
    status: string;
  };
  defaultVatRegimeId: string;
  dmDraft: {
    periodMonth: string;
    progressPct: number;
    baseAmountHt: number;
    retentionPct: number;
    advanceDeduction: number;
  };
  paymentDraft: {
    amount: string;
    method: string;
    reference: string;
  };
};

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
