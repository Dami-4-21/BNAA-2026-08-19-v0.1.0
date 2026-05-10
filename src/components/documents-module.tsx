"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  startTransition,
  useEffect,
  useDeferredValue,
  useMemo,
  useState,
} from "react";
import {
  ArrowUpDown,
  ChevronsLeft,
  ChevronsRight,
  CheckCheck,
  CloudDownload,
  FileStack,
  FolderOpen,
  HardDriveDownload,
  Layers3,
  Maximize2,
  Minimize2,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Upload,
  X,
} from "lucide-react";

import {
  EmptyStateCard,
  InlineNotice,
  LoadingStateCard,
  MetricCard,
  Panel,
  ProgressBar,
  SectionHeading,
  StatusBadge,
  cx,
} from "@/components/ui";
import { PdfOverlayCompare } from "@/components/pdf-overlay-compare";
import { formatDate, formatVersion, timeAgo } from "@/lib/format";
import { apiFetch, apiUpload } from "@/lib/api";
import type { DocumentsModuleData as DocumentsPayload } from "@/lib/backend/types";
import {
  cacheDocumentForOffline,
  isDocumentCached,
  removeCachedDocument,
} from "@/lib/offline";
import { useWorkspace } from "@/components/workspace-context";

type DocumentsTab = "library" | "versions" | "distribution" | "offline";

type ActiveTone = "primary" | "success" | "warning" | "danger";
type DocumentWorkflowStep = {
  step: string;
  detail: string;
  tone: ActiveTone;
  state: "done" | "current" | "todo";
};

type DocumentFile = DocumentsPayload["files"][number];
type Recipient = DocumentsPayload["recipients"][number];

type DocumentTreeRoot = {
  title: string;
  nodes: Array<{ label: string; phases: string[] }>;
};

type DocumentWorkspaceView =
  | "all"
  | "current"
  | "to-distribute"
  | "distribution-pending"
  | "obsolete"
  | "offline"
  | "audit"
  | "plans"
  | "reports"
  | "photos"
  | "finance"
  | "quality"
  | "exports";

type DocumentHubType =
  | "plan"
  | "report"
  | "photo"
  | "finance"
  | "quality"
  | "export"
  | "audit";

type DocumentSortKey = "updated" | "priority" | "title" | "read" | "distribution";

type WorkspaceTreeFilter =
  | {
      kind: "lot" | "phase" | "discipline";
      value: string;
    }
  | null;

type DocumentQuickBadge = {
  label: string;
  tone: ActiveTone;
};

type HubAttachment = {
  id: string;
  label: string;
  kind: string;
  status: string;
  meta: string;
  href?: string;
};

type HubDocument = {
  id: string;
  code: string;
  title: string;
  documentType: DocumentHubType;
  documentTypeLabel: string;
  sourceModule: string;
  lot: string;
  phase: string;
  discipline: string;
  zone: string | null;
  revision: string;
  status: string;
  tone: DocumentFile["tone"];
  distributionLabel: string;
  distributionTone: ActiveTone;
  readLabel: string;
  readTone: ActiveTone;
  offlineLabel: string;
  offlineTone: ActiveTone;
  priority: "high" | "medium" | "low";
  visibilityScope: string;
  updatedAt: string;
  updatedBy: string;
  recipients: Recipient[];
  unreadCount: number;
  quickBadges: DocumentQuickBadge[];
  attachments: HubAttachment[];
  relatedPhotos: HubAttachment[];
  file: DocumentFile;
};

const tabs: Array<{ key: DocumentsTab; label: string; helper: string }> = [
  {
    key: "library",
    label: "Bibliotheque",
    helper: "Chercher et choisir la bonne reference",
  },
  {
    key: "versions",
    label: "Publier",
    helper: "Publier la revision en vigueur",
  },
  {
    key: "distribution",
    label: "Diffuser",
    helper: "Diffuser puis suivre les lectures",
  },
  {
    key: "offline",
    label: "Mobile chantier",
    helper: "Preparer les plans pour le terrain",
  },
];

const metricIcons = [HardDriveDownload, CheckCheck, Layers3, ShieldCheck];

const toneByReadStatus: Record<string, ActiveTone> = {
  Lu: "success",
  "Non lu": "warning",
};

function buildDocumentWorkflowSteps({
  readRate,
  selectedDocument,
  unreadRecipients,
}: {
  readRate: number;
  selectedDocument?: DocumentFile;
  unreadRecipients: Recipient[];
}): DocumentWorkflowStep[] {
  if (!selectedDocument) {
    return [
      {
        step: "1. Choisir la reference",
        detail: "Selectionnez un plan ou un document pour lancer le suivi.",
        tone: "primary",
        state: "current",
      },
      {
        step: "2. Publier la revision",
        detail: "Ajoutez la nouvelle revision et gardez une version courante claire.",
        tone: "warning",
        state: "todo",
      },
      {
        step: "3. Lancer la diffusion",
        detail: "Diffusez seulement la revision valide aux bons destinataires.",
        tone: "warning",
        state: "todo",
      },
      {
        step: "4. Suivre les lectures",
        detail: "Controlez les accuses de lecture avant execution sur chantier.",
        tone: "warning",
        state: "todo",
      },
    ];
  }

  return [
    {
      step: "1. Reference selectionnee",
      detail: `${selectedDocument.code} · ${selectedDocument.revision}`,
      tone: "primary",
      state: "done",
    },
    {
      step: "2. Revision publiee",
      detail: selectedDocument.status === "Obsolete"
        ? "Cette revision est obsolete. Publiez une version en vigueur."
        : selectedDocument.isCurrent
          ? "La version courante est bien identifiee."
          : "Verifiez la revision courante avant diffusion.",
      tone:
        selectedDocument.status === "Obsolete"
          ? "warning"
          : selectedDocument.isCurrent
            ? "success"
            : "primary",
      state:
        selectedDocument.status === "Obsolete"
          ? "current"
          : selectedDocument.isCurrent
            ? "done"
            : "current",
    },
    {
      step: "3. Diffusion",
      detail:
        selectedDocument.recipients > 0
          ? `${selectedDocument.recipients} destinataire(s) suivis sur cette diffusion.`
          : "Aucune diffusion lancee pour cette revision.",
      tone: selectedDocument.recipients > 0 ? "success" : "warning",
      state: selectedDocument.recipients > 0 ? "done" : "current",
    },
    {
      step: "4. Lectures",
      detail:
        selectedDocument.recipients > 0
          ? unreadRecipients.length === 0
            ? "Tous les destinataires ont accuse reception."
            : `${unreadRecipients.length} lecture(s) encore attendue(s) · ${readRate}% lus.`
          : "Le suivi des lectures commencera apres la diffusion.",
      tone:
        selectedDocument.recipients === 0
          ? "warning"
          : unreadRecipients.length === 0
            ? "success"
            : "primary",
      state:
        selectedDocument.recipients === 0
          ? "todo"
          : unreadRecipients.length === 0
            ? "done"
            : "current",
    },
  ];
}

const roleViewProfiles: Record<
  string,
  {
    defaultView: DocumentWorkspaceView;
    workflowViews: DocumentWorkspaceView[];
    contentViews: DocumentWorkspaceView[];
  }
> = {
  "Super Admin": {
    defaultView: "all",
    workflowViews: ["all", "current", "to-distribute", "distribution-pending", "obsolete", "offline", "audit"],
    contentViews: ["plans", "reports", "photos", "finance", "quality", "exports"],
  },
  Admin: {
    defaultView: "all",
    workflowViews: ["all", "current", "to-distribute", "distribution-pending", "obsolete", "offline", "audit"],
    contentViews: ["plans", "reports", "photos", "finance", "quality", "exports"],
  },
  "Bureau d'etudes": {
    defaultView: "current",
    workflowViews: ["current", "to-distribute", "distribution-pending", "obsolete", "audit"],
    contentViews: ["plans", "quality", "exports", "reports"],
  },
  "Chef de projet": {
    defaultView: "all",
    workflowViews: ["all", "current", "to-distribute", "distribution-pending", "obsolete", "offline", "audit"],
    contentViews: ["plans", "reports", "photos", "quality", "finance", "exports"],
  },
  "Conducteur de travaux": {
    defaultView: "current",
    workflowViews: ["current", "offline", "distribution-pending", "obsolete"],
    contentViews: ["plans", "reports", "photos", "quality", "exports"],
  },
  Comptable: {
    defaultView: "finance",
    workflowViews: ["distribution-pending", "audit", "offline"],
    contentViews: ["finance", "exports", "reports"],
  },
  "Maitre d'ouvrage": {
    defaultView: "audit",
    workflowViews: ["distribution-pending", "audit", "current"],
    contentViews: ["exports", "finance", "reports", "plans"],
  },
};

const workspaceViewLabels: Record<DocumentWorkspaceView, string> = {
  all: "Tous les documents",
  current: "Plans en vigueur",
  "to-distribute": "A diffuser",
  "distribution-pending": "Diffusion en attente",
  obsolete: "Obsoletes",
  offline: "Offline chantier",
  audit: "Audit documentaire",
  plans: "Plans & revisions",
  reports: "Rapports chantier",
  photos: "Photos & preuves",
  finance: "Finance & justificatifs",
  quality: "Qualite / NCR",
  exports: "Exports & PDF signes",
};

const workspaceViewCompactLabels: Record<DocumentWorkspaceView, string> = {
  all: "Tous docs",
  current: "Plans",
  "to-distribute": "A diffuser",
  "distribution-pending": "Attente",
  obsolete: "Obsoletes",
  offline: "Offline",
  audit: "Audit",
  plans: "Plans",
  reports: "Rapports",
  photos: "Photos",
  finance: "Finance",
  quality: "Qualite",
  exports: "PDF",
};

const sortLabels: Record<DocumentSortKey, string> = {
  updated: "Derniere mise a jour",
  priority: "Priorite",
  title: "Titre",
  read: "Lecture",
  distribution: "Diffusion",
};

function getDocumentType(document: DocumentFile): DocumentHubType {
  if (document.documentType) {
    return document.documentType;
  }

  const haystack = `${document.code} ${document.title} ${document.discipline} ${document.format}`.toLowerCase();

  if (["jpg", "jpeg", "png", "webp", "heic", "mp4"].includes(document.format.toLowerCase())) {
    return "photo";
  }
  if (/facture|decompte|paiement|reglement|tva|finance|encaissement/.test(haystack)) {
    return "finance";
  }
  if (/ncr|non.?conform|qualite|reserve|preuve/.test(haystack)) {
    return "quality";
  }
  if (/rapport|rjc|journal/.test(haystack)) {
    return "report";
  }
  if (/export|signe|signee|signature|diffusion|accuse|audit/.test(haystack)) {
    return "export";
  }
  return "plan";
}

function getDocumentTypeLabel(documentType: DocumentHubType) {
  switch (documentType) {
    case "plan":
      return "Plan / technique";
    case "report":
      return "Rapport chantier";
    case "photo":
      return "Preuve photo";
    case "finance":
      return "Justificatif finance";
    case "quality":
      return "Qualite / NCR";
    case "export":
      return "PDF / export";
    case "audit":
      return "Audit";
    default:
      return "Document";
  }
}

function getDocumentSourceLabel(documentType: DocumentHubType, sourceModule?: string) {
  if (sourceModule?.trim()) {
    return sourceModule;
  }

  switch (documentType) {
    case "report":
    case "photo":
    case "quality":
      return "Chantier";
    case "finance":
      return "Finance";
    case "export":
      return "Systeme";
    case "audit":
      return "Audit";
    default:
      return "Plans";
  }
}

function getDocumentPriority(document: DocumentFile, unreadCount: number, documentType: DocumentHubType) {
  if (document.priority) {
    return document.priority;
  }

  if (document.status === "Obsolete") {
    return "low" as const;
  }
  if (document.isCurrent || unreadCount > 0 || document.recipients === 0) {
    return "high" as const;
  }
  if (documentType === "report" || documentType === "photo" || documentType === "export") {
    return "medium" as const;
  }
  return "medium" as const;
}

function getVisibilityScopeLabel(documentType: DocumentHubType, role: string, visibilityScope?: string) {
  if (visibilityScope?.trim()) {
    return visibilityScope;
  }

  if (role === "Super Admin" || role === "Admin") {
    return "Toutes les equipes";
  }
  if (role === "Comptable" || documentType === "finance") {
    return "Finance / validation";
  }
  if (role === "Bureau d'etudes") {
    return "Technique / diffusion";
  }
  if (role === "Maitre d'ouvrage") {
    return "Partage / audit";
  }
  return "Projet / chantier";
}

function buildHubDocument({
  document,
  recipients,
  cachedDocumentUrls,
  currentUserRole,
}: {
  document: DocumentFile;
  recipients: Recipient[];
  cachedDocumentUrls: string[];
  currentUserRole: string;
}): HubDocument {
  const documentType = getDocumentType(document);
  const unreadCount = Math.max(document.recipients - document.readCount, 0);
  const isCached =
    document.offlineReady ||
    (document.downloadUrl ? cachedDocumentUrls.includes(document.downloadUrl) : false);

  const distributionLabel =
    document.recipients === 0
      ? "A diffuser"
      : unreadCount > 0
        ? "Diffusion en attente"
        : "Diffuse";
  const distributionTone: ActiveTone =
    document.recipients === 0 ? "warning" : unreadCount > 0 ? "primary" : "success";

  const attachments: HubAttachment[] =
    document.attachments && document.attachments.length > 0
      ? document.attachments
      : document.fileName || document.downloadUrl
    ? [
        {
          id: `${document.id}-main`,
          label: document.fileName ?? `${document.code}.${document.format.toLowerCase()}`,
          kind: "Document principal",
          status: document.status,
          meta: `${document.format} · ${document.fileSizeMb} Mo`,
          href: document.downloadUrl,
        },
      ]
    : [];

  const relatedPhotos: HubAttachment[] =
    document.relatedPhotos && document.relatedPhotos.length > 0
      ? document.relatedPhotos
      : documentType === "photo"
    ? [
        {
          id: `${document.id}-photo`,
          label: document.title,
          kind: "Preuve liee",
          status: "Liee",
          meta: `Source ${getDocumentSourceLabel(documentType, document.sourceModule)}`,
          href: document.downloadUrl,
        },
      ]
    : [];

  const quickBadges: DocumentQuickBadge[] = [
    {
      label: document.isCurrent ? "Version en vigueur" : "Version archivee",
      tone: document.isCurrent ? "success" : "warning",
    },
    {
      label:
        document.recipients > 0
          ? `${document.readCount}/${document.recipients} lus`
          : "Diffusion non lancee",
      tone: document.recipients > 0 ? (unreadCount > 0 ? "primary" : "success") : "warning",
    },
    {
      label: isCached ? "Disponible hors connexion" : "Non synchronise",
      tone: isCached ? "success" : "warning",
    },
  ];

  if (document.status === "Obsolete") {
    quickBadges.push({ label: "Plan obsolete - ne plus utiliser sur chantier", tone: "danger" });
  }
  if (documentType === "finance") {
    quickBadges.push({ label: "Finance lie", tone: "primary" });
  }
  if (documentType === "report") {
    quickBadges.push({ label: "Rapport du jour", tone: "primary" });
  }

  return {
    id: document.id,
    code: document.code,
    title: document.title,
    documentType,
    documentTypeLabel: getDocumentTypeLabel(documentType),
    sourceModule: getDocumentSourceLabel(documentType, document.sourceModule),
    lot: document.lot,
    phase: document.phase,
    discipline: document.discipline,
    zone: document.zone ?? null,
    revision: document.revision,
    status: document.status,
    tone: document.tone,
    distributionLabel,
    distributionTone,
    readLabel:
      document.recipients > 0 ? `${document.readCount}/${document.recipients} lus` : "Lecture non requise",
    readTone: document.recipients > 0 ? (unreadCount > 0 ? "warning" : "success") : "primary",
    offlineLabel: document.offlineState ?? (isCached ? "Disponible hors connexion" : "Non synchronise"),
    offlineTone: isCached ? "success" : "warning",
    priority: getDocumentPriority(document, unreadCount, documentType),
    visibilityScope: getVisibilityScopeLabel(documentType, currentUserRole, document.visibilityScope),
    updatedAt: document.publishedAt,
    updatedBy: document.uploadedBy,
    recipients,
    unreadCount,
    quickBadges,
    attachments,
    relatedPhotos,
    file: document,
  };
}

function documentMatchesRole(document: HubDocument, role: string) {
  if (role === "Super Admin" || role === "Admin" || role === "Chef de projet") {
    return true;
  }
  if (role === "Bureau d'etudes") {
    return document.documentType !== "finance";
  }
  if (role === "Conducteur de travaux") {
    return document.documentType !== "finance";
  }
  if (role === "Comptable") {
    return document.documentType === "finance" || document.documentType === "export" || document.documentType === "report";
  }
  if (role === "Maitre d'ouvrage") {
    return (
      document.documentType === "finance" ||
      document.documentType === "export" ||
      document.documentType === "report" ||
      document.file.recipients > 0
    );
  }
  return true;
}

function documentMatchesWorkspaceView(document: HubDocument, view: DocumentWorkspaceView) {
  switch (view) {
    case "all":
      return true;
    case "current":
      return document.file.isCurrent && document.documentType === "plan";
    case "to-distribute":
      return document.file.recipients === 0 && document.status !== "Obsolete";
    case "distribution-pending":
      return document.unreadCount > 0;
    case "obsolete":
      return document.status === "Obsolete";
    case "offline":
      return document.file.offlineReady;
    case "audit":
      return document.documentType === "export" || document.documentType === "finance" || document.file.recipients > 0;
    case "plans":
      return document.documentType === "plan";
    case "reports":
      return document.documentType === "report";
    case "photos":
      return document.documentType === "photo";
    case "finance":
      return document.documentType === "finance";
    case "quality":
      return document.documentType === "quality";
    case "exports":
      return document.documentType === "export";
    default:
      return true;
  }
}

function sortDocuments(documents: HubDocument[], sortKey: DocumentSortKey) {
  const priorityWeight = { high: 0, medium: 1, low: 2 };

  return [...documents].sort((left, right) => {
    if (sortKey === "title") {
      return left.title.localeCompare(right.title, "fr");
    }
    if (sortKey === "read") {
      return right.file.readCount - left.file.readCount;
    }
    if (sortKey === "distribution") {
      return right.file.recipients - left.file.recipients;
    }
    if (sortKey === "priority") {
      return priorityWeight[left.priority] - priorityWeight[right.priority];
    }
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

function getViewProfile(role: string) {
  return roleViewProfiles[role] ?? roleViewProfiles["Chef de projet"];
}

function getTypeLetter(documentType: DocumentHubType) {
  switch (documentType) {
    case "plan":
      return "P";
    case "report":
      return "R";
    case "photo":
      return "PH";
    case "finance":
      return "F";
    case "quality":
      return "Q";
    case "export":
      return "PDF";
    case "audit":
      return "A";
    default:
      return "D";
  }
}

export function DocumentsModule() {
  const { activeProject, can, currentUser } = useWorkspace();
  const [projectData, setProjectData] = useState<DocumentsPayload | null>(null);
  const [error, setError] = useState("");
  const canAcknowledge = can("documents.view");
  const canPublishVersion = can("documents.version.publish");
  const canDistribute = can("documents.distribute");
  const canMarkObsolete = can("documents.obsolete.mark");

  useEffect(() => {
    let cancelled = false;

    async function loadDocuments() {
      try {
        setError("");
        setProjectData(null);
        const payload = await apiFetch<DocumentsPayload>(
          `/api/projects/${activeProject.id}/documents`,
          { method: "GET" },
        );

        if (!cancelled) {
          setProjectData(payload);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error ? nextError.message : "Impossible de charger les documents.",
          );
        }
      }
    }

    void loadDocuments();

    return () => {
      cancelled = true;
    };
  }, [activeProject.id]);

  if (!projectData && !error) {
    return (
      <div className="space-y-6">
        <SectionHeading eyebrow="Documents" title="Chargement de la GED" />
        <LoadingStateCard
          title="La GED se synchronise"
          detail="Nous recuperons la bibliotheque, les revisions, les diffusions et la disponibilite mobile du projet actif."
        />
      </div>
    );
  }

  if (!projectData) {
    return (
      <div className="space-y-6">
        <SectionHeading eyebrow="Documents" title="La GED est indisponible" />
        <InlineNotice tone="danger" title="Impossible de charger la GED">
          {error}
        </InlineNotice>
      </div>
    );
  }

  return (
    <DocumentsModuleContent
      activeProjectId={activeProject.id}
      key={activeProject.id}
      canDistribute={canDistribute}
      canAcknowledge={canAcknowledge}
      canMarkObsolete={canMarkObsolete}
      canPublishVersion={canPublishVersion}
      currentUserId={currentUser.id}
      currentUserRole={currentUser.role}
      projectData={projectData}
    />
  );
}

function DocumentsModuleContent({
  canAcknowledge,
  activeProjectId,
  canDistribute,
  canMarkObsolete,
  canPublishVersion,
  currentUserId,
  currentUserRole,
  projectData,
}: {
  canAcknowledge: boolean;
  activeProjectId: string;
  canDistribute: boolean;
  canMarkObsolete: boolean;
  canPublishVersion: boolean;
  currentUserId: string;
  currentUserRole: string;
  projectData: DocumentsPayload;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<DocumentsTab>("library");
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [overview, setOverview] = useState(projectData.overview);
  const [documents, setDocuments] = useState<DocumentFile[]>(projectData.files);
  const [recipients, setRecipients] = useState<Recipient[]>(projectData.recipients);
  const [cachedDocumentUrls, setCachedDocumentUrls] = useState<string[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState(
    projectData.files[0]?.id ?? "",
  );
  const [comparisonSelections, setComparisonSelections] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Tous");
  const [workspaceView, setWorkspaceView] = useState<DocumentWorkspaceView>(() =>
    getViewProfile(currentUserRole).defaultView,
  );
  const [sortKey, setSortKey] = useState<DocumentSortKey>("updated");
  const [treeFilter, setTreeFilter] = useState<WorkspaceTreeFilter>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [draftVersion, setDraftVersion] = useState(projectData.draftVersion);
  const [metadataDraft, setMetadataDraft] = useState({
    title: projectData.files[0]?.title ?? "",
    discipline: projectData.files[0]?.discipline ?? "",
    lot: projectData.files[0]?.lot ?? "",
    phase: projectData.files[0]?.phase ?? "",
  });
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [mutationError, setMutationError] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [compareDrawerOpen, setCompareDrawerOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(true);

  const deferredSearch = useDeferredValue(search);

  function replaceModuleUrl(nextTab: DocumentsTab, documentId?: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    if (documentId) {
      params.set("document", documentId);
    } else {
      params.delete("document");
    }

    const query = params.toString();
    const nextUrl = query ? `${pathname}?${query}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }

  function selectTab(nextTab: DocumentsTab) {
    setActiveTab(nextTab);
    replaceModuleUrl(nextTab, nextTab === "library" || nextTab === "versions" || nextTab === "distribution"
      ? selectedDocument?.id
      : undefined);
  }

  function applyProjectData(nextData: DocumentsPayload) {
    startTransition(() => {
      setOverview(nextData.overview);
      setDocuments(nextData.files);
      setRecipients(nextData.recipients);
      setDraftVersion(nextData.draftVersion);
      setVersionFile(null);
      const nextSelectedDocument =
        nextData.files.find((item) => item.id === selectedDocumentId) ?? nextData.files[0];
      setMetadataDraft({
        title: nextSelectedDocument?.title ?? "",
        discipline: nextSelectedDocument?.discipline ?? "",
        lot: nextSelectedDocument?.lot ?? "",
        phase: nextSelectedDocument?.phase ?? "",
      });
      setSelectedDocumentId((current) =>
        nextData.files.some((item) => item.id === current) ? current : (nextData.files[0]?.id ?? ""),
      );
    });
  }

  useEffect(() => {
    function updateNetworkStatus() {
      setIsOnline(window.navigator.onLine);
    }

    window.addEventListener("online", updateNetworkStatus);
    window.addEventListener("offline", updateNetworkStatus);

    return () => {
      window.removeEventListener("online", updateNetworkStatus);
      window.removeEventListener("offline", updateNetworkStatus);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function readCachedDocuments() {
      const urls = await Promise.all(
        documents.map(async (document) => {
          if (!document.downloadUrl) {
            return null;
          }

          return (await isDocumentCached(document.downloadUrl)) ? document.downloadUrl : null;
        }),
      );

      if (!cancelled) {
        setCachedDocumentUrls(urls.filter(Boolean) as string[]);
      }
    }

    void readCachedDocuments();

    return () => {
      cancelled = true;
    };
  }, [documents]);

  async function runDocumentsAction(
    action: string,
    payload: Record<string, unknown>,
    pendingKey = action,
  ) {
    setPendingAction(pendingKey);
    try {
      const nextData = await apiFetch<DocumentsPayload>(`/api/projects/${activeProjectId}/documents`, {
        method: "POST",
        body: {
          action,
          payload,
        },
      });
      setMutationError("");
      applyProjectData(nextData);
      return nextData;
    } finally {
      setPendingAction("");
    }
  }

  useEffect(() => {
    const tab = searchParams.get("tab");
    const documentId = searchParams.get("document");
    const nextDocument =
      documentId && documents.some((item) => item.id === documentId)
        ? documents.find((item) => item.id === documentId)
        : undefined;

    startTransition(() => {
      if (tab && tabs.some((item) => item.key === tab)) {
        setActiveTab(tab as DocumentsTab);
      }

      if (documentId && nextDocument) {
        setSelectedDocumentId(documentId);
        setMetadataDraft({
          title: nextDocument.title,
          discipline: nextDocument.discipline,
          lot: nextDocument.lot,
          phase: nextDocument.phase,
        });
      }
    });
  }, [documents, searchParams]);

  function handleSelectDocument(documentId: string) {
    const nextDocument = documents.find((item) => item.id === documentId);
    setSelectedDocumentId(documentId);
    setSelectedDocumentIds((current) =>
      current.includes(documentId) && current.length === 1 ? current : [documentId],
    );
    if (nextDocument) {
      setMetadataDraft({
        title: nextDocument.title,
        discipline: nextDocument.discipline,
        lot: nextDocument.lot,
        phase: nextDocument.phase,
      });
    }
    replaceModuleUrl(activeTab, documentId);
  }

  const roleViewProfile = useMemo(() => getViewProfile(currentUserRole), [currentUserRole]);

  const hubDocuments = useMemo(() => {
    const documentsWithRoleFilter = documents.map((document) =>
      buildHubDocument({
        document,
        recipients: recipients.filter((recipient) => recipient.documentId === document.id),
        cachedDocumentUrls,
        currentUserRole,
      }),
    );

    const roleRelevant = documentsWithRoleFilter.filter((document) =>
      documentMatchesRole(document, currentUserRole),
    );

    return roleRelevant.length > 0 ? roleRelevant : documentsWithRoleFilter;
  }, [cachedDocumentUrls, currentUserRole, documents, recipients]);

  const filteredDocuments = useMemo(() => {
    const nextDocuments = hubDocuments.filter((document) => {
      const needle = deferredSearch.trim().toLowerCase();
      const matchesSearch =
        !needle ||
        document.code.toLowerCase().includes(needle) ||
        document.title.toLowerCase().includes(needle) ||
        document.discipline.toLowerCase().includes(needle) ||
        document.phase.toLowerCase().includes(needle) ||
        document.documentTypeLabel.toLowerCase().includes(needle) ||
        document.sourceModule.toLowerCase().includes(needle);

      const matchesFilter =
        filter === "Tous" ||
        filter === document.discipline ||
        filter === `Lot ${document.lot}` ||
        filter === `Phase ${document.phase}` ||
        (filter === "Courants" && document.status === "Courante") ||
        (filter === "Obsoletes" && document.status === "Obsolete");

      const matchesWorkspaceView = documentMatchesWorkspaceView(document, workspaceView);

      const matchesTreeFilter =
        !treeFilter ||
        (treeFilter.kind === "lot" && document.lot === treeFilter.value) ||
        (treeFilter.kind === "phase" && document.phase === treeFilter.value) ||
        (treeFilter.kind === "discipline" && document.discipline === treeFilter.value);

      return matchesSearch && matchesFilter && matchesWorkspaceView && matchesTreeFilter;
    });

    return sortDocuments(nextDocuments, sortKey);
  }, [deferredSearch, filter, hubDocuments, sortKey, treeFilter, workspaceView]);

  const effectiveSelectedDocumentId = filteredDocuments.some(
    (document) => document.id === selectedDocumentId,
  )
    ? selectedDocumentId
    : (filteredDocuments[0]?.id ?? selectedDocumentId);
  const selectedDocument =
    documents.find((item) => item.id === effectiveSelectedDocumentId) ?? documents[0];

  const recipientsForSelected = useMemo(
    () => recipients.filter((recipient) => recipient.documentId === selectedDocument?.id),
    [recipients, selectedDocument],
  );
  const unreadRecipients = useMemo(
    () => recipientsForSelected.filter((recipient) => recipient.status !== "Lu"),
    [recipientsForSelected],
  );
  const selectedHubDocument =
    filteredDocuments.find((item) => item.id === selectedDocument?.id) ?? filteredDocuments[0];
  const readRate = selectedDocument
    ? Math.round(
        (selectedDocument.readCount / Math.max(selectedDocument.recipients, 1)) * 100,
      )
    : 0;
  const hasMetadataChanges = Boolean(
    selectedDocument &&
      (metadataDraft.title !== selectedDocument.title ||
        metadataDraft.discipline !== selectedDocument.discipline ||
        metadataDraft.lot !== selectedDocument.lot ||
        metadataDraft.phase !== selectedDocument.phase),
  );
  const canSubmitMetadataUpdate = Boolean(
    canPublishVersion && selectedDocument && hasMetadataChanges && !pendingAction,
  );
  const metadataActionHelper = !canPublishVersion
    ? "Votre role peut consulter les metadonnees, mais pas les modifier."
    : !selectedDocument
      ? "Selectionnez un document pour modifier ses metadonnees."
      : hasMetadataChanges
        ? "Les metadonnees modifiees seront enregistrees sur la revision courante."
        : "Aucune modification de metadonnees a enregistrer.";
  const canPublishSelectedVersion = Boolean(canPublishVersion && versionFile && !pendingAction);
  const publishVersionHelper = !canPublishVersion
    ? "Votre role ne peut pas publier de nouvelle revision."
    : versionFile
      ? "La nouvelle revision sera publiee comme version courante."
      : "Ajoutez un fichier avant de publier une nouvelle revision.";
  const canMarkSelectedObsolete = Boolean(
    canMarkObsolete && selectedDocument && selectedDocument.status !== "Obsolete" && !pendingAction,
  );
  const markObsoleteHelper = !canMarkObsolete
    ? "Votre role ne peut pas marquer un plan comme obsolete."
    : selectedDocument?.status === "Obsolete"
      ? "Ce plan est deja marque obsolete."
      : "Le plan sera retire des revisions en vigueur.";
  const canDistributeSelected = Boolean(
    canDistribute && selectedDocument && draftVersion.audience.trim() && !pendingAction,
  );
  const distributeActionHelper = !canDistribute
    ? "Votre role peut consulter la diffusion, mais pas la lancer."
    : draftVersion.audience.trim()
      ? "La liste selectionnee recevra une diffusion controlee avec accuse de lecture."
      : "Choisissez d'abord une liste de diffusion.";
  const selectedCompareVersion = selectedDocument
    ? comparisonSelections[selectedDocument.id] ?? selectedDocument.compareWith
    : "";
  const getRecipientAcknowledgeHelper = (recipient: Recipient) => {
    if (!canAcknowledge) {
      return "Votre role ne peut pas accuser reception des documents.";
    }

    if (recipient.userId && currentUserRole !== "Super Admin" && recipient.userId !== currentUserId) {
      return `Accuse reserve a ${recipient.name}.`;
    }

    return "Confirmer la lecture de ce document pour la diffusion controlee.";
  };
  const canAcknowledgeRecipient = (recipient: Recipient) =>
    canAcknowledge &&
    (!recipient.userId || currentUserRole === "Super Admin" || recipient.userId === currentUserId);
  const pendingRecipientForCurrentUser = unreadRecipients.find(
    (recipient) =>
      recipient.userId &&
      (currentUserRole === "Super Admin" || recipient.userId === currentUserId),
  );
  const canAcknowledgePendingRecipient = pendingRecipientForCurrentUser
    ? canAcknowledgeRecipient(pendingRecipientForCurrentUser)
    : false;
  const pendingRecipientHelper = pendingRecipientForCurrentUser
    ? getRecipientAcknowledgeHelper(pendingRecipientForCurrentUser)
    : "";
  const workflowSteps = buildDocumentWorkflowSteps({
    readRate,
    selectedDocument,
    unreadRecipients,
  });
  const nextDocumentAction = useMemo(() => {
    if (!selectedDocument) {
      return {
        title: "Choisir une reference",
        detail: "Commencez par ouvrir le bon plan ou le bon document dans la bibliotheque.",
        helper: "La selection du document synchronise aussi les vues de publication et de diffusion.",
        actionLabel: "Ouvrir la bibliotheque",
        actionTone: "primary" as ActiveTone,
        tab: "library" as DocumentsTab,
      };
    }

    if (selectedDocument.status === "Obsolete" && canPublishVersion) {
      return {
        title: "Publier une revision en vigueur",
        detail: "Le document selectionne est obsolete. Publiez une nouvelle revision avant de le redistribuer.",
        helper: publishVersionHelper,
        actionLabel: "Publier la revision",
        actionTone: "warning" as ActiveTone,
        tab: "versions" as DocumentsTab,
      };
    }

    if (selectedDocument.recipients === 0) {
      return {
        title: "Lancer la diffusion",
        detail: "La revision est prete, mais aucun destinataire n'a encore recu ce plan.",
        helper: distributeActionHelper,
        actionLabel: canDistribute ? "Ouvrir la diffusion" : "Voir la diffusion",
        actionTone: canDistribute ? ("primary" as ActiveTone) : ("warning" as ActiveTone),
        tab: "distribution" as DocumentsTab,
      };
    }

    if (pendingRecipientForCurrentUser && canAcknowledgePendingRecipient) {
      return {
        title: "Confirmer votre lecture",
        detail: "Vous faites partie des destinataires attendus sur cette diffusion.",
        helper: pendingRecipientHelper,
        actionLabel: "Ouvrir le suivi de lecture",
        actionTone: "primary" as ActiveTone,
        tab: "distribution" as DocumentsTab,
      };
    }

    if (unreadRecipients.length > 0) {
      return {
        title: "Relancer le suivi de lecture",
        detail: `${unreadRecipients.length} destinataire(s) n'ont pas encore accuse reception de cette revision.`,
        helper: "Le suivi de lecture vous aide a verifier que le chantier travaille sur la bonne version.",
        actionLabel: "Suivre les lectures",
        actionTone: "warning" as ActiveTone,
        tab: "distribution" as DocumentsTab,
      };
    }

    if (!selectedDocument.offlineReady) {
      return {
        title: "Preparer le mobile chantier",
        detail: "Ajoutez cette revision au cache pour la rendre disponible sans 4G.",
        helper: "Le cache intelligent garde les derniers plans de terrain accessibles hors connexion.",
        actionLabel: "Ouvrir le mode mobile",
        actionTone: "success" as ActiveTone,
        tab: "offline" as DocumentsTab,
      };
    }

    return {
      title: "Revision diffusee et suivie",
      detail: "La reference est en vigueur, diffusee et lue. Vous pouvez continuer avec la prochaine mise a jour.",
      helper: "La comparaison PDF et l'historique restent disponibles pour tout audit ou preparation de revision.",
      actionLabel: "Revenir a la bibliotheque",
      actionTone: "success" as ActiveTone,
      tab: "library" as DocumentsTab,
    };
  }, [
    canAcknowledgePendingRecipient,
    canDistribute,
    canPublishVersion,
    distributeActionHelper,
    pendingRecipientForCurrentUser,
    pendingRecipientHelper,
    publishVersionHelper,
    selectedDocument,
    unreadRecipients.length,
  ]);

  const documentFilters = useMemo(
    () => [
      "Tous",
      ...new Set(documents.map((document) => document.discipline)),
      ...projectData.projectSetup.lots.map((lot) => `Lot ${lot}`),
      ...projectData.projectSetup.phases.map((phase) => `Phase ${phase}`),
      "Courants",
      "Obsoletes",
    ],
    [documents, projectData.projectSetup.lots, projectData.projectSetup.phases],
  );

  function toggleDocumentSelection(documentId: string) {
    setSelectedDocumentIds((current) =>
      current.includes(documentId)
        ? current.filter((item) => item !== documentId)
        : [...current, documentId],
    );
  }

  function openWorkflow(nextTab: DocumentsTab) {
    selectTab(nextTab);
  }

  function applyKpiView(label: string) {
    if (label.includes("Volume")) {
      setWorkspaceView("all");
      return;
    }
    if (label.includes("Lecture")) {
      setWorkspaceView("distribution-pending");
      return;
    }
    if (label.includes("Versions")) {
      setWorkspaceView("current");
      return;
    }
    if (label.includes("non diffus")) {
      setWorkspaceView("to-distribute");
    }
  }

  async function prepareOfflineSelection() {
    const offlineCandidates = documents.filter((document) =>
      selectedDocumentIds.includes(document.id),
    );

    for (const document of offlineCandidates) {
      if (!document.offlineReady) {
        await toggleOffline(document.id);
      }
    }
  }

  async function publishNewVersion() {
    if (!selectedDocument) {
      return;
    }
    try {
      if (!versionFile) {
        throw new Error("Ajoutez un fichier avant de publier une nouvelle revision.");
      }

      setPendingAction("publish-version");

      const formData = new FormData();
      formData.set("documentId", selectedDocument.id);
      formData.set("revision", draftVersion.revision);
      formData.set("format", draftVersion.format);
      formData.set("file", versionFile);

      const nextData = await apiUpload<DocumentsPayload>(
        `/api/projects/${activeProjectId}/documents`,
        formData,
        {
          method: "POST",
        },
      );

      setMutationError("");
      applyProjectData(nextData);
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Publication impossible.");
    } finally {
      setPendingAction("");
    }
  }

  async function markObsolete(documentId: string) {
    try {
      await runDocumentsAction("mark-obsolete", { documentId }, "mark-obsolete");
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Operation impossible.");
    }
  }

  async function distributeSelected() {
    if (!selectedDocument) {
      return;
    }
    try {
      await runDocumentsAction("distribute", {
        documentId: selectedDocument.id,
        audience: draftVersion.audience,
      }, "distribute");
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Diffusion impossible.");
    }
  }

  async function acknowledgeRecipient(recipientId: string) {
    if (!selectedDocument) {
      return;
    }
    try {
      await runDocumentsAction("acknowledge", {
        documentId: selectedDocument.id,
        recipientId,
      }, "acknowledge");
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Accuse impossible.");
    }
  }

  async function toggleOffline(documentId: string) {
    try {
      const nextData = await runDocumentsAction("toggle-offline", { documentId }, "toggle-offline");
      const nextDocument = nextData.files.find((item) => item.id === documentId) as
        | DocumentFile
        | undefined;

      if (nextDocument?.downloadUrl) {
        if (nextDocument.offlineReady) {
          await cacheDocumentForOffline(nextDocument.downloadUrl);
        } else {
          await removeCachedDocument(nextDocument.downloadUrl);
        }
      }

      setCachedDocumentUrls(
        (nextData.files as DocumentFile[])
          .filter((item) => item.offlineReady && item.downloadUrl)
          .map((item) => item.downloadUrl as string),
      );
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Sync offline impossible.");
    }
  }

  async function updateMetadata() {
    if (!selectedDocument) {
      return;
    }

    try {
      await runDocumentsAction("update-metadata", {
        documentId: selectedDocument.id,
        ...metadataDraft,
      }, "update-metadata");
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Mise a jour impossible.");
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Documents"
        title="Module 6 — GED & Plans"
        description="Hub documentaire central du projet : plans, rapports, preuves, exports signes et justificatifs relies au meme espace documentaire."
        action={
          <button
            onClick={() => (canPublishVersion ? openWorkflow("versions") : null)}
            disabled={!canPublishVersion || Boolean(pendingAction)}
            className={cx(
              "rounded-2xl px-4 py-3 text-sm font-semibold",
              canPublishVersion && !pendingAction
                ? "bg-black text-white hover:bg-stone-800"
                : "cursor-not-allowed bg-stone-200 text-stone-500",
            )}
          >
            Publier une revision
          </button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-4">
        {overview.kpis.map((item, index) => (
          <button key={item.label} type="button" onClick={() => applyKpiView(item.label)} className="text-left">
            <MetricCard
              label={item.label}
              value={item.value}
              helper={`${item.helper} · cliquer pour filtrer`}
              tone={item.tone}
              icon={metricIcons[index]}
            />
          </button>
        ))}
      </div>

      {!isOnline ? (
        <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-800">
          Mode hors ligne actif. Les plans deja mis en cache restent accessibles depuis cet appareil.
        </div>
      ) : null}

      {!canPublishVersion || !canDistribute || !canMarkObsolete ? (
        <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm leading-6 text-stone-600">
          Votre role <span className="font-semibold text-stone-950">{currentUserRole}</span> peut
          consulter la documentation, avec des actions de publication et de diffusion selon les
          droits attribues.
        </div>
      ) : null}

      {mutationError ? (
        <InlineNotice tone="danger" title="Action documentaire interrompue">
          {mutationError}
        </InlineNotice>
      ) : null}

      {pendingAction ? (
        <div className="rounded-[22px] border border-sky-200 bg-sky-50 px-4 py-4 text-sm leading-6 text-sky-800">
          Action en cours sur la GED. Les commandes se reactiveront des que la mise a jour sera terminee.
        </div>
      ) : null}

      <Panel className="overflow-hidden">
        <div className="space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <label className="glass-panel-soft flex flex-1 items-center gap-3 rounded-[24px] px-4 py-4 text-sm text-slate-300">
              <Search className="size-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
                placeholder="Recherche globale : plan, rapport, preuve, revision, finance..."
              />
            </label>
            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                <ArrowUpDown className="size-4 text-slate-400" />
                <select
                  value={sortKey}
                  onChange={(event) => setSortKey(event.target.value as DocumentSortKey)}
                  className="bg-transparent text-white outline-none"
                >
                  {Object.entries(sortLabels).map(([value, label]) => (
                    <option key={value} value={value} className="bg-stone-950 text-white">
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => (canPublishVersion ? openWorkflow("versions") : null)}
                disabled={!canPublishVersion || Boolean(pendingAction)}
                className={cx(
                  "rounded-full px-4 py-3 text-sm font-semibold",
                  canPublishVersion && !pendingAction
                    ? "bg-black text-white hover:bg-stone-800"
                    : "cursor-not-allowed bg-stone-200 text-stone-500",
                )}
              >
                Publier une revision
              </button>
              <button
                type="button"
                onClick={() => (selectedDocument ? openWorkflow("distribution") : null)}
                disabled={!selectedDocument || Boolean(pendingAction)}
                className={cx(
                  "rounded-full border px-4 py-3 text-sm font-semibold",
                  selectedDocument && !pendingAction
                    ? "border-black/10 bg-white text-stone-950 hover:bg-stone-100"
                    : "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400",
                )}
              >
                Distribuer
              </button>
              <button
                type="button"
                onClick={() => setCompareDrawerOpen(true)}
                disabled={!selectedDocument || selectedDocument.format !== "PDF"}
                className={cx(
                  "rounded-full border px-4 py-3 text-sm font-semibold",
                  selectedDocument && selectedDocument.format === "PDF"
                    ? "border-black/10 bg-white text-stone-950 hover:bg-stone-100"
                    : "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400",
                )}
                title={
                  selectedDocument?.format === "PDF"
                    ? "Comparer cette revision avec son historique."
                    : "La comparaison visuelle est reservee aux PDF."
                }
              >
                Comparer
              </button>
              <button
                type="button"
                onClick={() => openWorkflow("offline")}
                className="rounded-full border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-stone-950 hover:bg-stone-100"
              >
                Preparer offline
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="primary">{workspaceViewLabels[workspaceView]}</StatusBadge>
            {treeFilter ? (
              <StatusBadge tone="neutral">
                {treeFilter.kind === "lot" ? "Lot" : treeFilter.kind === "phase" ? "Phase" : "Discipline"} · {treeFilter.value}
              </StatusBadge>
            ) : null}
            {documentFilters.slice(0, 8).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={cx(
                  "rounded-full border px-4 py-2 text-sm font-semibold",
                  filter === item
                    ? "border-sky-400/25 bg-sky-400/12 text-sky-100"
                    : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/8",
                )}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-[28px] border border-white/8 bg-white/4">
            <div
              className={cx(
                "grid min-h-full",
                isContextPanelOpen ? "xl:grid-cols-[minmax(0,1fr)_220px]" : "grid-cols-1",
              )}
            >
              <div className="min-w-0">
                <div
                  className={cx(
                    "grid min-h-full",
                    isSidebarOpen
                      ? "xl:grid-cols-[336px_minmax(0,1fr)]"
                      : "xl:grid-cols-[72px_minmax(0,1fr)]",
                  )}
                >
                  <DocumentsSidebar
                    activeView={workspaceView}
                    collapsed={!isSidebarOpen}
                    currentUserRole={currentUserRole}
                    onToggle={() => setIsSidebarOpen((current) => !current)}
                    profile={roleViewProfile}
                    setActiveView={setWorkspaceView}
                    tree={projectData.tree}
                    treeFilter={treeFilter}
                    setTreeFilter={setTreeFilter}
                  />

                  <div className="min-w-0">
                    <LibraryTab
                      documents={filteredDocuments}
                      embedded
                      isFullView={!isContextPanelOpen}
                      onToggleFullView={() => setIsContextPanelOpen((current) => !current)}
                      selectedDocumentId={effectiveSelectedDocumentId}
                      selectDocument={handleSelectDocument}
                      selectedDocumentIds={selectedDocumentIds}
                      toggleDocumentSelection={toggleDocumentSelection}
                    />
                  </div>
                </div>
              </div>

              {isContextPanelOpen ? (
                <div className="min-w-0 border-t border-white/8 xl:border-l xl:border-t-0">
                  <DocumentContextPanel
                    canMarkSelectedObsolete={canMarkSelectedObsolete}
                    canSubmitMetadataUpdate={canSubmitMetadataUpdate}
                    compact
                    documentsCount={filteredDocuments.length}
                    embedded
                    markObsolete={markObsolete}
                    markObsoleteHelper={markObsoleteHelper}
                    metadataActionHelper={metadataActionHelper}
                    metadataDraft={metadataDraft}
                    nextDocumentAction={nextDocumentAction}
                    openCompare={() => setCompareDrawerOpen(true)}
                    openDistribution={() => openWorkflow("distribution")}
                    openOffline={() => openWorkflow("offline")}
                    openVersions={() => openWorkflow("versions")}
                    pendingAction={pendingAction}
                    readRate={readRate}
                    recipientsForSelected={recipientsForSelected}
                    selectedCompareVersion={selectedCompareVersion}
                    selectedDocument={selectedDocument}
                    selectedHubDocument={selectedHubDocument}
                    setMetadataDraft={setMetadataDraft}
                    workflowSteps={workflowSteps}
                    updateMetadata={updateMetadata}
                    projectLots={projectData.projectSetup.lots}
                    projectPhases={projectData.projectSetup.phases}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </Panel>

      {selectedDocumentIds.length > 0 ? (
        <div className="sticky bottom-6 z-20 rounded-[24px] border border-black/10 bg-white/95 px-4 py-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-stone-950">
                {selectedDocumentIds.length} document(s) selectionne(s)
              </p>
              <p className="text-sm text-stone-600">
                La barre rapide garde le document actif au centre, puis ouvre la bonne action sans quitter la GED.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => selectedDocument && openWorkflow("distribution")}
                disabled={!selectedDocument}
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-stone-950 hover:bg-stone-100"
              >
                Distribuer la selection
              </button>
              <button
                type="button"
                onClick={() => void prepareOfflineSelection()}
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-stone-950 hover:bg-stone-100"
              >
                Preparer offline
              </button>
              <button
                type="button"
                onClick={() => setSelectedDocumentIds([])}
                className="rounded-full border border-stone-200 bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-200"
              >
                Vider la selection
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <WorkflowDrawer
        open={activeTab === "versions"}
        title="Publier une nouvelle revision"
        description="Ajoutez la nouvelle version, verifiez l'historique et gardez une revision courante claire."
        onClose={() => selectTab("library")}
      >
        {selectedDocument ? (
          <VersionsTab
            canMarkSelectedObsolete={canMarkSelectedObsolete}
            canPublishSelectedVersion={canPublishSelectedVersion}
            markObsoleteHelper={markObsoleteHelper}
            pendingAction={pendingAction}
            publishVersionHelper={publishVersionHelper}
            selectedDocument={selectedDocument}
            draftVersion={draftVersion}
            versionFile={versionFile}
            setVersionFile={setVersionFile}
            setDraftVersion={setDraftVersion}
            publishNewVersion={publishNewVersion}
            markObsolete={markObsolete}
          />
        ) : (
          <EmptyStateCard
            title="Selectionnez un document"
            detail="Choisissez d'abord un document dans la bibliotheque centrale pour publier une nouvelle revision."
          />
        )}
      </WorkflowDrawer>

      <WorkflowDrawer
        open={activeTab === "distribution"}
        title="Diffusion controlee"
        description="Lancez la diffusion, suivez les non-lus et relancez les lectures critiques."
        onClose={() => selectTab("library")}
      >
        {selectedDocument ? (
          <DistributionTab
            canDistributeSelected={canDistributeSelected}
            distributeActionHelper={distributeActionHelper}
            pendingAction={pendingAction}
            selectedDocument={selectedDocument}
            recipients={recipientsForSelected}
            draftVersion={draftVersion}
            setDraftVersion={setDraftVersion}
            distributionOptions={projectData.distributionOptions}
            canAcknowledgeRecipient={canAcknowledgeRecipient}
            distributeSelected={distributeSelected}
            getRecipientAcknowledgeHelper={getRecipientAcknowledgeHelper}
            acknowledgeRecipient={acknowledgeRecipient}
          />
        ) : (
          <EmptyStateCard
            title="Selectionnez un document"
            detail="Choisissez d'abord la reference a diffuser depuis la table centrale."
          />
        )}
      </WorkflowDrawer>

      <WorkflowDrawer
        open={activeTab === "offline"}
        title="Preparation offline"
        description="Gardez les documents utiles disponibles sur le chantier, meme hors connexion."
        onClose={() => selectTab("library")}
      >
        <OfflineTab
          documents={documents}
          offlineSummary={overview.offline}
          cachedUrls={cachedDocumentUrls}
          pendingAction={pendingAction}
          toggleOffline={toggleOffline}
        />
      </WorkflowDrawer>

      <WorkflowDrawer
        open={compareDrawerOpen}
        title="Comparer les versions"
        description="Verifiez visuellement les differences entre la revision en vigueur et son historique."
        onClose={() => setCompareDrawerOpen(false)}
      >
        {selectedDocument?.format === "PDF" ? (
          <PdfOverlayCompare
            document={selectedDocument}
            key={`${selectedDocument.id}-${selectedCompareVersion || "default"}-drawer`}
            onSelectVersion={(version) =>
              setComparisonSelections((current) => ({
                ...current,
                [selectedDocument.id]: version,
              }))
            }
            selectedVersion={selectedCompareVersion}
          />
        ) : (
          <EmptyStateCard
            title="Comparaison reservee aux PDF"
            detail="Les autres formats restent visibles dans l'historique et les telechargements du document."
          />
        )}
      </WorkflowDrawer>
    </div>
  );
}

function LibraryTab({
  documents,
  embedded = false,
  isFullView,
  onToggleFullView,
  selectedDocumentId,
  selectDocument,
  selectedDocumentIds,
  toggleDocumentSelection,
}: {
  documents: HubDocument[];
  embedded?: boolean;
  isFullView: boolean;
  onToggleFullView: () => void;
  selectedDocumentId: string;
  selectDocument: (documentId: string) => void;
  selectedDocumentIds: string[];
  toggleDocumentSelection: (documentId: string) => void;
}) {
  return (
    <div className={cx(embedded ? "h-full" : "rounded-[28px] border border-white/8 bg-white/4")}>
      <div className="border-b border-white/8 px-4 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[15px] font-semibold text-white">Bibliotheque documentaire</p>
            <p className="mt-1 max-w-3xl text-[13px] leading-5 text-slate-400">
              La table centrale vous montre la bonne version, la diffusion, la lecture et l&apos;etat offline sans ouvrir chaque fiche.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge tone="primary">{documents.length} element(s)</StatusBadge>
            <button
              type="button"
              onClick={onToggleFullView}
              className="inline-flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/8"
              title={
                isFullView
                  ? "Rouvrir le panneau document"
                  : "Afficher la bibliotheque en vue large"
              }
              aria-label={
                isFullView
                  ? "Rouvrir le panneau document"
                  : "Afficher la bibliotheque en vue large"
              }
            >
              {isFullView ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
          </div>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="p-5">
          <EmptyStateCard
            title="Aucun document dans cette vue"
            detail="Essayez un autre filtre, une autre vue de gauche, ou repassez sur Tous les documents."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left">
            <thead className="border-b border-white/8 bg-black/10 text-[11px] uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-3 py-3">
                  <span className="sr-only">Selection</span>
                </th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Code</th>
                <th className="px-3 py-3">Titre</th>
                <th className="px-3 py-3">Source</th>
                <th className="px-3 py-3">Lot</th>
                <th className="px-3 py-3">Phase</th>
                <th className="px-3 py-3">Discipline</th>
                <th className="px-3 py-3">Revision</th>
                <th className="px-3 py-3">Statut</th>
                <th className="px-3 py-3">Diffusion</th>
                <th className="px-3 py-3">Lecture</th>
                <th className="px-3 py-3">Offline</th>
                <th className="px-3 py-3">Derniere mise a jour</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => {
                const isSelected = selectedDocumentId === document.id;
                const isChecked = selectedDocumentIds.includes(document.id);

                return (
                  <tr
                    key={document.id}
                    onClick={() => selectDocument(document.id)}
                    className={cx(
                      "cursor-pointer border-b border-white/6 text-[13px] text-slate-200 transition hover:bg-white/6",
                      isSelected ? "bg-sky-400/10" : "",
                    )}
                  >
                    <td className="px-3 py-3.5" onClick={(event) => event.stopPropagation()}>
                      <input
                        checked={isChecked}
                        onChange={() => toggleDocumentSelection(document.id)}
                        type="checkbox"
                        aria-label={`Selectionner ${document.title}`}
                        className="size-4 rounded border-white/10 bg-white/5"
                      />
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="inline-flex min-w-[36px] items-center justify-center rounded-full border border-white/8 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                        {getTypeLetter(document.documentType)}
                      </div>
                    </td>
                    <td className="px-3 py-3.5 font-semibold text-white">{document.code}</td>
                    <td className="px-3 py-3.5">
                      <div>
                        <p className="font-medium leading-5 text-white">{document.title}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{document.documentTypeLabel}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-slate-300">{document.sourceModule}</td>
                    <td className="px-3 py-3.5 text-slate-300">{document.lot}</td>
                    <td className="px-3 py-3.5 text-slate-300">{document.phase}</td>
                    <td className="px-3 py-3.5 text-slate-300">{document.discipline}</td>
                    <td className="px-3 py-3.5">
                      <StatusBadge tone="primary">{formatVersion(document.revision)}</StatusBadge>
                    </td>
                    <td className="px-3 py-3.5">
                      <StatusBadge tone={document.tone}>{document.status}</StatusBadge>
                    </td>
                    <td className="px-3 py-3.5">
                      <StatusBadge tone={document.distributionTone}>{document.distributionLabel}</StatusBadge>
                    </td>
                    <td className="px-3 py-3.5">
                      <StatusBadge tone={document.readTone}>{document.readLabel}</StatusBadge>
                    </td>
                    <td className="px-3 py-3.5">
                      <StatusBadge tone={document.offlineTone}>{document.offlineLabel}</StatusBadge>
                    </td>
                    <td className="px-3 py-3.5 text-slate-300">
                      <div>
                        <p className="text-[13px]">{formatDate(document.updatedAt)}</p>
                        <p className="mt-1 text-xs text-slate-500">{document.updatedBy} · {timeAgo(document.updatedAt)}</p>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DocumentsSidebar({
  activeView,
  collapsed,
  currentUserRole,
  onToggle,
  profile,
  setActiveView,
  tree,
  treeFilter,
  setTreeFilter,
}: {
  activeView: DocumentWorkspaceView;
  collapsed: boolean;
  currentUserRole: string;
  onToggle: () => void;
  profile: ReturnType<typeof getViewProfile>;
  setActiveView: React.Dispatch<React.SetStateAction<DocumentWorkspaceView>>;
  tree: DocumentTreeRoot[];
  treeFilter: WorkspaceTreeFilter;
  setTreeFilter: React.Dispatch<React.SetStateAction<WorkspaceTreeFilter>>;
}) {
  return (
    <aside
      className={cx(
        "flex h-full flex-col",
        collapsed ? "px-2 py-3" : "px-5 py-5",
      )}
    >
      <div
        className={cx(
          "border-b border-white/8",
          collapsed
            ? "flex flex-col items-center gap-2 pb-3"
            : "flex items-start justify-between gap-3 pb-4",
        )}
      >
        <div className={cx("min-w-0", collapsed ? "text-center" : "space-y-1")}>
          <p
            className={cx(
              "font-semibold text-white",
              collapsed ? "text-[11px] uppercase tracking-[0.16em] text-slate-500" : "text-sm",
            )}
          >
            {collapsed ? "GED" : "Vues documentaires"}
          </p>
          {!collapsed ? (
            <p className="text-[13px] leading-5 text-slate-400">
              Navigation adaptee au role {currentUserRole}.
            </p>
          ) : (
            <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
              {workspaceViewCompactLabels[activeView]}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={cx(
            "inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10",
            collapsed ? "size-9" : "size-10",
          )}
          title={
            collapsed
              ? "Ouvrir la navigation documentaire"
              : "Refermer la navigation documentaire"
          }
          aria-label={
            collapsed
              ? "Ouvrir la navigation documentaire"
              : "Refermer la navigation documentaire"
          }
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
        </button>
      </div>

      {collapsed ? (
        <div className="mt-3 space-y-2">
          <div className="rounded-[18px] border border-white/8 bg-white/4 px-2.5 py-2.5">
            <p className="text-[9px] uppercase tracking-[0.18em] text-slate-500">Vue</p>
            <p className="mt-1 text-[11px] font-semibold leading-4 text-white">
              {workspaceViewCompactLabels[activeView]}
            </p>
          </div>
          {treeFilter ? (
            <div className="rounded-[18px] border border-white/8 bg-white/4 px-2.5 py-2.5">
              <p className="text-[9px] uppercase tracking-[0.18em] text-slate-500">
                Classement
              </p>
              <p className="mt-1 text-[11px] font-semibold leading-4 text-white">
                {treeFilter.kind === "lot"
                  ? "Lot"
                  : treeFilter.kind === "phase"
                    ? "Phase"
                    : "Discipline"}
              </p>
              <p className="mt-1 break-words text-[11px] leading-4 text-slate-400">{treeFilter.value}</p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <SidebarGroup
            title="Workflow"
            views={profile.workflowViews}
            activeView={activeView}
            onSelect={setActiveView}
          />
          <SidebarGroup
            title="Contenus"
            views={profile.contentViews}
            activeView={activeView}
            onSelect={setActiveView}
          />

          <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
            <div className="flex items-center gap-3">
              <FolderOpen className="size-4 text-slate-400" />
              <div>
                <p className="text-sm font-semibold text-white">Classement du projet</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Naviguez par lot, phase et discipline comme dans un classement chantier.
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {tree.map((root) => (
                <div
                  key={root.title}
                  className="rounded-[22px] border border-white/8 bg-white/4 p-4"
                >
                  <div className="flex items-center gap-3">
                    <FolderOpen className="size-4 text-slate-400" />
                    <button
                      type="button"
                      onClick={() => setTreeFilter({ kind: "discipline", value: root.title })}
                      className={cx(
                        "text-sm font-semibold",
                        treeFilter?.kind === "discipline" && treeFilter.value === root.title
                          ? "text-white"
                          : "text-slate-300",
                      )}
                    >
                      {root.title}
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {root.nodes.map((node) => (
                      <div
                        key={node.label}
                        className="space-y-2 rounded-[18px] border border-white/8 bg-white/4 px-4 py-3"
                      >
                        <button
                          type="button"
                          onClick={() => setTreeFilter({ kind: "lot", value: node.label })}
                          className={cx(
                            "text-left text-sm font-medium",
                            treeFilter?.kind === "lot" && treeFilter.value === node.label
                              ? "text-white"
                              : "text-slate-300",
                          )}
                        >
                          {node.label}
                        </button>
                        <div className="flex flex-wrap gap-2">
                          {node.phases.map((phase) => (
                            <button
                              key={`${node.label}-${phase}`}
                              type="button"
                              onClick={() => setTreeFilter({ kind: "phase", value: phase })}
                              className={cx(
                                "rounded-full border px-3 py-1 text-xs",
                                treeFilter?.kind === "phase" && treeFilter.value === phase
                                  ? "border-sky-400/25 bg-sky-400/12 text-sky-100"
                                  : "border-white/10 bg-white/5 text-slate-400",
                              )}
                            >
                              {phase}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {treeFilter ? (
                <button
                  type="button"
                  onClick={() => setTreeFilter(null)}
                  className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/8"
                >
                  Effacer le classement
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function SidebarGroup({
  title,
  views,
  activeView,
  onSelect,
}: {
  title: string;
  views: DocumentWorkspaceView[];
  activeView: DocumentWorkspaceView;
  onSelect: (view: DocumentWorkspaceView) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{title}</p>
      <div className="space-y-2">
        {views.map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => onSelect(view)}
            className={cx(
              "flex w-full items-center justify-between rounded-[18px] border px-4 py-2.5 text-left text-[13px] font-semibold",
              activeView === view
                ? "border-sky-400/25 bg-sky-400/12 text-white"
                : "border-white/8 bg-white/4 text-slate-300 hover:bg-white/6",
            )}
          >
            <span>{workspaceViewLabels[view]}</span>
            <span className="text-[11px] text-slate-500">{view === activeView ? "Actif" : ""}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DocumentContextPanel({
  canMarkSelectedObsolete,
  canSubmitMetadataUpdate,
  compact = false,
  documentsCount,
  embedded = false,
  markObsolete,
  markObsoleteHelper,
  metadataActionHelper,
  metadataDraft,
  nextDocumentAction,
  openCompare,
  openDistribution,
  openOffline,
  openVersions,
  pendingAction,
  readRate,
  recipientsForSelected,
  selectedCompareVersion,
  selectedDocument,
  selectedHubDocument,
  setMetadataDraft,
  workflowSteps,
  updateMetadata,
  projectLots,
  projectPhases,
}: {
  canMarkSelectedObsolete: boolean;
  canSubmitMetadataUpdate: boolean;
  compact?: boolean;
  documentsCount: number;
  embedded?: boolean;
  markObsolete: (documentId: string) => void;
  markObsoleteHelper: string;
  metadataActionHelper: string;
  metadataDraft: {
    title: string;
    discipline: string;
    lot: string;
    phase: string;
  };
  nextDocumentAction: {
    title: string;
    detail: string;
    helper: string;
    actionLabel: string;
    actionTone: ActiveTone;
    tab: DocumentsTab;
  };
  openCompare: () => void;
  openDistribution: () => void;
  openOffline: () => void;
  openVersions: () => void;
  pendingAction: string;
  readRate: number;
  recipientsForSelected: Recipient[];
  selectedCompareVersion: string;
  selectedDocument?: DocumentFile;
  selectedHubDocument?: HubDocument;
  setMetadataDraft: React.Dispatch<
    React.SetStateAction<{
      title: string;
      discipline: string;
      lot: string;
      phase: string;
    }>
  >;
  workflowSteps: DocumentWorkflowStep[];
  updateMetadata: () => void;
  projectLots: string[];
  projectPhases: string[];
}) {
  const panelTitle = "Document selectionne";
  const panelDescription = selectedHubDocument
    ? "Le panneau de contexte repond tout de suite aux questions de version, diffusion, lecture et offline."
    : "Selectionnez un document dans la table pour ouvrir son contexte.";

  const content =
    !selectedHubDocument || !selectedDocument ? (
      <EmptyStateCard
        title="Aucune fiche ouverte"
        detail={`Choisissez un document parmi les ${documentsCount} elements de la bibliotheque pour ouvrir sa fiche detail.`}
      />
    ) : (
      <div className={cx("space-y-4", compact && "space-y-3")}>
            <div className={cx("rounded-[22px] border border-white/8 bg-white/4", compact ? "p-4" : "p-5")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={cx(
                        "font-display font-semibold text-white",
                        compact ? "text-[1.35rem] leading-8" : "text-xl",
                      )}
                    >
                      {selectedHubDocument.code}
                    </p>
                    <StatusBadge tone={selectedHubDocument.tone}>{selectedHubDocument.status}</StatusBadge>
                  </div>
                  <p className={cx("leading-5 text-slate-200", compact ? "text-[12px]" : "text-[13px]")}>{selectedHubDocument.title}</p>
                  <p className="text-[13px] text-slate-500">
                    {selectedHubDocument.documentTypeLabel} · {selectedHubDocument.sourceModule}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedHubDocument.quickBadges.map((badge) => (
                    <StatusBadge key={badge.label} tone={badge.tone}>
                      {badge.label}
                    </StatusBadge>
                  ))}
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {selectedHubDocument.quickBadges.slice(0, 4).map((badge) => (
                  <div
                    key={`${selectedHubDocument.id}-${badge.label}`}
                    className={cx(
                      "rounded-[16px] border border-white/8 bg-white/4",
                      compact ? "px-3 py-2.5" : "px-4 py-3",
                    )}
                  >
                    <p className="text-[9px] uppercase tracking-[0.14em] text-slate-500">Reponse rapide</p>
                    <p className={cx("mt-1 font-semibold text-white", compact ? "text-[12px] leading-5" : "text-[13px]")}>{badge.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <QuickActionButton label="Ouvrir" onClick={() => (selectedDocument.downloadUrl ? window.open(selectedDocument.downloadUrl, "_blank") : null)} disabled={!selectedDocument.downloadUrl} />
              <QuickActionButton label="Telecharger" onClick={() => (selectedDocument.downloadUrl ? window.open(selectedDocument.downloadUrl, "_blank") : null)} disabled={!selectedDocument.downloadUrl} />
              <QuickActionButton label="Distribuer" onClick={openDistribution} />
              <QuickActionButton label="Publier revision" onClick={openVersions} />
              <QuickActionButton label="Comparer" onClick={openCompare} disabled={selectedDocument.format !== "PDF"} />
              <QuickActionButton
                label={pendingAction === "mark-obsolete" ? "Mise a jour..." : "Marquer obsolete"}
                onClick={() => (canMarkSelectedObsolete ? markObsolete(selectedDocument.id) : null)}
                disabled={!canMarkSelectedObsolete}
                title={markObsoleteHelper}
              />
            </div>

            <div className={cx("rounded-[20px] border border-white/8 bg-white/4", compact ? "p-3.5" : "p-4")}>
              <p className={cx("font-semibold text-white", compact ? "text-[12px]" : "text-[13px]")}>Metadonnees</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field
                  label="Titre"
                  value={metadataDraft.title}
                  onChange={(value) =>
                    setMetadataDraft((current) => ({ ...current, title: value }))
                  }
                />
                <Field
                  label="Discipline"
                  value={metadataDraft.discipline}
                  onChange={(value) =>
                    setMetadataDraft((current) => ({ ...current, discipline: value }))
                  }
                />
                <SelectField
                  label="Lot"
                  value={metadataDraft.lot}
                  options={projectLots}
                  onChange={(value) =>
                    setMetadataDraft((current) => ({ ...current, lot: value }))
                  }
                />
                <SelectField
                  label="Phase"
                  value={metadataDraft.phase}
                  options={projectPhases}
                  onChange={(value) =>
                    setMetadataDraft((current) => ({ ...current, phase: value }))
                  }
                />
              </div>
              <button
                onClick={() => (canSubmitMetadataUpdate ? void updateMetadata() : null)}
                disabled={!canSubmitMetadataUpdate}
                title={metadataActionHelper}
                className={cx(
                  "mt-4 inline-flex items-center gap-2 rounded-2xl font-semibold",
                  compact ? "px-3.5 py-2 text-[12px]" : "px-4 py-2.5 text-[13px]",
                  canSubmitMetadataUpdate
                    ? "border border-white/10 bg-white/5 text-white hover:bg-white/8"
                    : "cursor-not-allowed border border-white/8 bg-white/5 text-slate-500",
                )}
              >
                <CheckCheck className="size-4" />
                {pendingAction === "update-metadata" ? "Mise a jour..." : "Mettre a jour les metadonnees"}
              </button>
              <p className="mt-2 text-[11px] leading-5 text-slate-400">{metadataActionHelper}</p>
            </div>

            <DetailSection title="Pieces jointes" description="Le parent document et ses elements relies restent visibles au meme endroit.">
              {selectedHubDocument.attachments.length > 0 ? (
                <div className="space-y-2">
                  {selectedHubDocument.attachments.map((attachment) => (
                    <AttachmentRow key={attachment.id} attachment={attachment} />
                  ))}
                </div>
              ) : (
                <EmptyHint text="Aucune piece jointe supplementaire exposee par la source actuelle." />
              )}
            </DetailSection>

            <DetailSection title="Preuves liees" description="Photos et preuves rattachees au document parent quand elles existent.">
              {selectedHubDocument.relatedPhotos.length > 0 ? (
                <div className="space-y-2">
                  {selectedHubDocument.relatedPhotos.map((attachment) => (
                    <AttachmentRow key={attachment.id} attachment={attachment} />
                  ))}
                </div>
              ) : (
                <EmptyHint text="Les preuves liees apparaitront ici a mesure que les autres modules alimentent le hub documentaire." />
              )}
            </DetailSection>

            <DetailSection title="Versions" description="Historique complet et comparaison de la revision en vigueur.">
              <div className="space-y-2">
                {selectedDocument.versions.slice().reverse().map((version) => (
                  <div key={`${selectedDocument.id}-${version.version}`} className="rounded-[18px] border border-white/8 bg-white/4 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{formatVersion(version.version)}</p>
                      <StatusBadge tone={version.status === "Courante" ? "success" : version.status === "Obsolete" ? "warning" : "primary"}>
                        {version.status}
                      </StatusBadge>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">Publie le {formatDate(version.publishedAt)}</p>
                  </div>
                ))}
              </div>
              {selectedDocument.format === "PDF" ? (
                <div className="mt-3 rounded-[18px] border border-white/8 bg-white/4 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Comparaison PDF</p>
                      <p className="mt-1 text-sm text-slate-400">
                        Revision de reference : {selectedCompareVersion ? formatVersion(selectedCompareVersion) : formatVersion(selectedDocument.compareWith)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openCompare}
                      className={cx(
                        "rounded-full border border-white/10 bg-white/5 font-semibold text-white hover:bg-white/8",
                        compact ? "px-3 py-1.5 text-[12px]" : "px-4 py-2 text-sm",
                      )}
                    >
                      Comparer
                    </button>
                  </div>
                </div>
              ) : null}
            </DetailSection>

            <DetailSection title="Diffusion" description="Audience, progression de lecture et relances depuis la meme fiche.">
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <MiniStat label="Audience" value={selectedDocument.recipients > 0 ? `${selectedDocument.recipients} cible(s)` : "A definir"} />
                  <MiniStat label="Lecture" value={selectedDocument.recipients > 0 ? `${readRate}%` : "0%"} />
                  <MiniStat label="Non lus" value={`${selectedHubDocument.unreadCount}`} />
                </div>
                <ProgressBar value={readRate} tone={selectedHubDocument.unreadCount > 0 ? "warning" : "success"} />
                {recipientsForSelected.length > 0 ? (
                  <div className="space-y-2">
                    {recipientsForSelected.map((recipient) => (
                      <div key={recipient.id} className="flex items-center justify-between gap-3 rounded-[18px] border border-white/8 bg-white/4 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{recipient.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{recipient.role}</p>
                        </div>
                        <StatusBadge tone={recipient.status === "Lu" ? "success" : "warning"}>
                          {recipient.status}
                        </StatusBadge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyHint text="Aucune diffusion lancee pour cette revision." />
                )}
              </div>
            </DetailSection>

            <DetailSection title="Offline" description="Suivi du cache mobile et dernier etat de synchronisation.">
              <div className="grid gap-3 sm:grid-cols-2">
                <MiniStat label="Etat" value={selectedHubDocument.offlineLabel} />
                <MiniStat label="Derniere sync" value={timeAgo(selectedDocument.publishedAt)} />
              </div>
              <button
                type="button"
                onClick={openOffline}
                className={cx(
                  "mt-3 rounded-full border border-white/10 bg-white/5 font-semibold text-white hover:bg-white/8",
                  compact ? "px-3 py-1.5 text-[12px]" : "px-4 py-2 text-sm",
                )}
              >
                Gerer le cache
              </button>
            </DetailSection>

            <DetailSection title="Audit trail" description="Trace documentaire, diffusion et origine du flux.">
              <div className="space-y-2">
                <AuditTrailRow label="Publie par" value={`${selectedHubDocument.updatedBy} · ${formatDate(selectedHubDocument.updatedAt)}`} />
                <AuditTrailRow label="Source" value={selectedHubDocument.sourceModule} />
                <AuditTrailRow label="Visibilite" value={selectedHubDocument.visibilityScope} />
                <AuditTrailRow label="Priorite" value={selectedHubDocument.priority === "high" ? "Haute" : selectedHubDocument.priority === "medium" ? "Moyenne" : "Basse"} />
              </div>
            </DetailSection>

            <DetailSection title="Prochaine etape" description={nextDocumentAction.detail}>
              <div className="space-y-3">
                <div className="rounded-[18px] border border-white/8 bg-white/4 px-4 py-3">
                  <p className="text-sm font-semibold text-white">{nextDocumentAction.title}</p>
                  <p className="mt-2 text-sm text-slate-400">{nextDocumentAction.helper}</p>
                </div>
                <div className="space-y-2">
                  {workflowSteps.map((step) => (
                    <div key={step.step} className="rounded-[18px] border border-white/8 bg-white/4 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">{step.step}</p>
                        <StatusBadge tone={step.state === "done" ? "success" : step.state === "current" ? "primary" : "neutral"}>
                          {step.state === "done" ? "Pret" : step.state === "current" ? "En cours" : "A venir"}
                        </StatusBadge>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">{step.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </DetailSection>
      </div>
    );

  if (embedded) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-black/[0.02]">
        <div className={cx("border-b border-white/8", compact ? "px-4 py-4" : "px-5 py-5")}>
          <p className={cx("font-semibold text-white", compact ? "text-[15px]" : "text-lg")}>{panelTitle}</p>
          <p className={cx("mt-2 text-slate-400", compact ? "text-[12px] leading-5" : "text-sm leading-6")}>
            {panelDescription}
          </p>
        </div>
        <div className={cx("min-h-0 flex-1 overflow-y-auto", compact ? "px-4 py-4" : "px-5 py-5")}>
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Panel title={panelTitle} description={panelDescription}>
        {content}
      </Panel>
    </div>
  );
}

function WorkflowDrawer({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-[960px] flex-col border-l border-white/8 bg-stone-950 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5">
          <div>
            <p className="font-display text-2xl font-semibold text-white">{title}</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-white hover:bg-white/8"
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </div>
  );
}

function DetailSection({
  compact = false,
  title,
  description,
  children,
}: {
  compact?: boolean;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cx("rounded-[20px] border border-white/8 bg-white/4", compact ? "p-3.5" : "p-4")}>
      <p className={cx("font-semibold text-white", compact ? "text-[12px]" : "text-[13px]")}>{title}</p>
      <p className={cx("mt-1 text-slate-400", compact ? "text-[12px] leading-5" : "text-[13px] leading-5")}>
        {description}
      </p>
      <div className={cx(compact ? "mt-3" : "mt-4")}>{children}</div>
    </div>
  );
}

function QuickActionButton({
  compact = false,
  label,
  onClick,
  disabled,
  title,
}: {
  compact?: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      className={cx(
        "rounded-[18px] border font-semibold text-center leading-4 whitespace-normal",
        compact ? "min-h-[42px] px-3 py-2 text-[11px]" : "min-h-[46px] px-4 py-2.5 text-[13px]",
        disabled
          ? "cursor-not-allowed border-white/8 bg-white/5 text-slate-500"
          : "border-white/10 bg-white/5 text-white hover:bg-white/8",
      )}
    >
      {label}
    </button>
  );
}

function AttachmentRow({ attachment }: { attachment: HubAttachment }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] border border-white/8 bg-white/4 px-4 py-3">
      <div>
        <p className="text-[13px] font-semibold text-white">{attachment.label}</p>
        <p className="mt-1 text-[11px] text-slate-500">
          {attachment.kind} · {attachment.meta}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge tone="primary">{attachment.status}</StatusBadge>
        {attachment.href ? (
          <a
            href={attachment.href}
            target="_blank"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white hover:bg-white/8"
          >
            Ouvrir
          </a>
        ) : null}
      </div>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="rounded-[18px] border border-dashed border-white/8 bg-white/4 px-4 py-4 text-[13px] leading-5 text-slate-400">
      {text}
    </div>
  );
}

function AuditTrailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] border border-white/8 bg-white/4 px-4 py-3">
      <p className="text-[13px] text-slate-400">{label}</p>
      <p className="text-[13px] font-semibold text-white">{value}</p>
    </div>
  );
}

function VersionsTab({
  canMarkSelectedObsolete,
  canPublishSelectedVersion,
  markObsoleteHelper,
  pendingAction,
  publishVersionHelper,
  selectedDocument,
  draftVersion,
  versionFile,
  setVersionFile,
  setDraftVersion,
  publishNewVersion,
  markObsolete,
}: {
  canMarkSelectedObsolete: boolean;
  canPublishSelectedVersion: boolean;
  markObsoleteHelper: string;
  pendingAction: string;
  publishVersionHelper: string;
  selectedDocument: DocumentFile;
  draftVersion: {
    revision: string;
    format: string;
    audience: string;
  };
  versionFile: File | null;
  setVersionFile: React.Dispatch<React.SetStateAction<File | null>>;
  setDraftVersion: React.Dispatch<
    React.SetStateAction<{
      revision: string;
      format: string;
      audience: string;
    }>
  >;
  publishNewVersion: () => void;
  markObsolete: (documentId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <StepHeading
            title="1. Preparer la revision"
            description="Renseignez le numero de revision, le format, puis ajoutez le fichier qui deviendra la version en vigueur."
          />
          <Field
            label="Revision a publier"
            value={draftVersion.revision}
            onChange={(value) =>
              setDraftVersion((current) => ({ ...current, revision: value }))
            }
          />
          <Field
            label="Format"
            value={draftVersion.format}
            onChange={(value) =>
              setDraftVersion((current) => ({ ...current, format: value }))
            }
          />
          <label className="block rounded-[22px] border border-white/8 bg-white/4 p-4">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Fichier de revision
            </span>
            <input
              type="file"
              accept=".pdf,.dwg,.ifc,.xlsx,.xls,.doc,.docx,.mp4"
              onChange={(event) => setVersionFile(event.target.files?.[0] ?? null)}
              className="mt-3 block w-full text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-950"
            />
            <p className="mt-3 text-sm text-slate-400">
              {versionFile
                ? `${versionFile.name} - ${(versionFile.size / (1024 * 1024)).toFixed(2)} Mo`
                : "Ajoutez le PDF, DWG, IFC ou document a publier comme version courante."}
            </p>
          </label>

          <StepHeading
            title="2. Publier ou retirer"
            description="Publiez la nouvelle revision quand elle est prete, ou retirez la version courante de la diffusion si elle ne doit plus circuler."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => (canPublishSelectedVersion ? publishNewVersion() : null)}
              disabled={!canPublishSelectedVersion}
              title={publishVersionHelper}
              className={cx(
                "flex items-center justify-center gap-2 rounded-[22px] px-4 py-4 text-sm font-semibold",
                canPublishSelectedVersion
                  ? "bg-sky-400 text-slate-950 hover:bg-sky-300"
                  : "cursor-not-allowed bg-slate-700 text-slate-400",
              )}
            >
              <Upload className="size-4" />
              {pendingAction === "publish-version"
                ? "Publication..."
                : canPublishSelectedVersion
                  ? "Publier la revision"
                  : "Publication indisponible"}
            </button>
            <button
              onClick={() => (canMarkSelectedObsolete ? markObsolete(selectedDocument.id) : null)}
              disabled={!canMarkSelectedObsolete}
              title={markObsoleteHelper}
              className={cx(
                "flex items-center justify-center gap-2 rounded-[22px] px-4 py-4 text-sm font-semibold",
                canMarkSelectedObsolete
                  ? "border border-white/10 bg-white/5 text-white hover:bg-white/8"
                  : "cursor-not-allowed border border-white/8 bg-white/5 text-slate-500",
              )}
            >
              <ShieldCheck className="size-4" />
              {pendingAction === "mark-obsolete" ? "Mise a jour..." : "Retirer de la diffusion"}
            </button>
          </div>
          <div className="grid gap-2 text-xs leading-5 text-slate-400 sm:grid-cols-2">
            <p>{publishVersionHelper}</p>
            <p>{markObsoleteHelper}</p>
          </div>
        </div>

        <div className="rounded-[22px] border border-white/8 bg-white/4 p-4">
          <StepHeading
            title="3. Verifier l'historique"
            description="Controlez rapidement les revisions precedentes pour garder une trace claire avant comparaison ou audit."
          />
          <div className="flex items-center gap-2">
            <FileStack className="size-4 text-slate-400" />
              <p className="text-sm font-semibold text-white">
              Historique des revisions
            </p>
          </div>
          <div className="mt-4 space-y-3">
            {selectedDocument.versions
              .slice()
              .reverse()
              .map((version) => (
                <div
                  key={`${selectedDocument.id}-${version.version}`}
                  className="rounded-[20px] border border-white/8 bg-white/4 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{version.version}</p>
                    <StatusBadge
                      tone={
                        version.status === "Courante"
                          ? "success"
                          : version.status === "Obsolete"
                            ? "warning"
                            : "primary"
                      }
                    >
                      {version.status}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    Publie le {formatDate(version.publishedAt)}
                  </p>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DistributionTab({
  canAcknowledgeRecipient,
  canDistributeSelected,
  distributeActionHelper,
  pendingAction,
  selectedDocument,
  recipients,
  draftVersion,
  setDraftVersion,
  distributionOptions,
  distributeSelected,
  getRecipientAcknowledgeHelper,
  acknowledgeRecipient,
}: {
  canAcknowledgeRecipient: (recipient: Recipient) => boolean;
  canDistributeSelected: boolean;
  distributeActionHelper: string;
  pendingAction: string;
  selectedDocument: DocumentFile;
  recipients: Recipient[];
  draftVersion: {
    revision: string;
    format: string;
    audience: string;
  };
  setDraftVersion: React.Dispatch<
    React.SetStateAction<{
      revision: string;
      format: string;
      audience: string;
    }>
  >;
  distributionOptions: string[];
  distributeSelected: () => void;
  getRecipientAcknowledgeHelper: (recipient: Recipient) => string;
  acknowledgeRecipient: (recipientId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <StepHeading
            title="1. Choisir la liste de diffusion"
            description="Selectionnez d'abord le bon groupe pour envoyer seulement la revision valide aux bons destinataires."
          />
          <SelectField
            label="Destinataires"
            value={draftVersion.audience}
            options={distributionOptions}
            onChange={(value) =>
              setDraftVersion((current) => ({ ...current, audience: value }))
            }
          />

          <div className="flex flex-wrap gap-2">
            {distributionOptions.slice(0, 6).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() =>
                  setDraftVersion((current) => ({ ...current, audience: option }))
                }
                className={cx(
                  "rounded-full border px-4 py-2 text-sm font-semibold",
                  draftVersion.audience === option
                    ? "border-sky-400/25 bg-sky-400/12 text-sky-100"
                    : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/8",
                )}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="rounded-[22px] border border-white/8 bg-white/4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">
                {selectedDocument.code} - suivi des lectures
              </p>
              <StatusBadge tone="primary">
                {selectedDocument.readCount}/{selectedDocument.recipients} lus
              </StatusBadge>
            </div>
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.14em] text-slate-500">
                <span>Lectures confirmees</span>
                <span>
                  {Math.round(
                    (selectedDocument.readCount / Math.max(selectedDocument.recipients, 1)) * 100,
                  )}
                  %
                </span>
              </div>
              <ProgressBar
                value={Math.round(
                  (selectedDocument.readCount / Math.max(selectedDocument.recipients, 1)) * 100,
                )}
                tone="primary"
              />
            </div>
          </div>

          <StepHeading
            title="2. Lancer la diffusion"
            description="Envoyez la revision selectionnee, puis laissez le suivi de lecture confirmer sa bonne circulation."
          />
          <button
            onClick={() => (canDistributeSelected ? distributeSelected() : null)}
            disabled={!canDistributeSelected}
            title={distributeActionHelper}
            className={cx(
              "flex w-full items-center justify-center gap-2 rounded-[22px] px-4 py-4 text-sm font-semibold",
              canDistributeSelected
                ? "bg-sky-400 text-slate-950 hover:bg-sky-300"
                : "cursor-not-allowed bg-slate-700 text-slate-400",
            )}
            >
              <Send className="size-4" />
              {pendingAction === "distribute"
                ? "Diffusion en cours..."
                : canDistributeSelected
                  ? "Lancer la diffusion"
                  : "Diffusion indisponible"}
          </button>
          <p className="text-xs leading-5 text-slate-400">{distributeActionHelper}</p>
        </div>

        <div className="space-y-3">
          <StepHeading
            title="3. Suivre les lectures"
            description="Reperez qui a deja accuse reception et relancez seulement les lectures encore attendues."
          />
          {recipients.map((recipient) => (
            <div
              key={recipient.id}
              className="rounded-[22px] border border-white/8 bg-white/4 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{recipient.name}</p>
                  <p className="mt-1 text-sm text-slate-400">{recipient.role}</p>
                </div>
                <StatusBadge tone={toneByReadStatus[recipient.status] ?? "warning"}>
                  {recipient.status}
                </StatusBadge>
              </div>
              <p className="mt-3 text-sm text-slate-300">
                {recipient.acknowledgedAt
                  ? `Accuse le ${recipient.acknowledgedAt}`
                  : "Accuse non recu"}
              </p>
              {recipient.status !== "Lu" ? (
                <button
                  onClick={() =>
                    canAcknowledgeRecipient(recipient) ? acknowledgeRecipient(recipient.id) : null
                  }
                  disabled={!canAcknowledgeRecipient(recipient) || pendingAction === "acknowledge"}
                  title={getRecipientAcknowledgeHelper(recipient)}
                  className={cx(
                    "mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm",
                    canAcknowledgeRecipient(recipient) && pendingAction !== "acknowledge"
                      ? "border border-white/10 bg-white/5 text-white hover:bg-white/8"
                      : "cursor-not-allowed border border-white/8 bg-white/5 text-slate-500",
                  )}
                >
                  <CheckCheck className="size-4" />
                  {pendingAction === "acknowledge" ? "Mise a jour..." : "Confirmer la lecture"}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OfflineTab({
  documents,
  offlineSummary,
  cachedUrls,
  pendingAction,
  toggleOffline,
}: {
  documents: DocumentFile[];
  offlineSummary: {
    syncedAt: string;
    cachedFiles: number;
    coverage: string;
  };
  cachedUrls: string[];
  pendingAction: string;
  toggleOffline: (documentId: string) => void;
}) {
  const cached = documents.filter(
    (document) =>
      document.offlineReady ||
      (document.downloadUrl ? cachedUrls.includes(document.downloadUrl) : false),
  ).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <StepHeading
            title="1. Preparer le mobile chantier"
            description="Mettez en cache les plans utiles avant le terrain pour garantir l'acces meme sans 4G."
          />
          <div className="rounded-[22px] border border-white/8 bg-white/4 p-4">
            <div className="flex items-center gap-2">
              <Smartphone className="size-4 text-slate-400" />
              <p className="text-sm font-semibold text-white">
                Synchronisation mobile terrain
              </p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <MiniStat label="Derniere sync" value={offlineSummary.syncedAt} />
              <MiniStat label="Cache local" value={`${cached} fichiers`} />
              <MiniStat label="Couverture" value={offlineSummary.coverage} />
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Le cache intelligent sert les dernieres versions en vigueur et les documents
              utiles sur le terrain pour garantir un acces sans reseau 4G.
            </p>
          </div>

          <div className="space-y-3">
            {[
              "Conserver automatiquement la derniere version courante de chaque lot.",
              "Nettoyer les fichiers obsoletes apres validation d'une nouvelle revision.",
              "Precharger les plans ouverts recemment par le conducteur de travaux.",
            ].map((item) => (
              <div
                key={item}
                className="rounded-[20px] border border-white/8 bg-white/4 px-4 py-3 text-sm leading-6 text-slate-200"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <StepHeading
            title="2. Choisir les plans a garder"
            description="Activez seulement les references necessaires pour garder un cache mobile simple et a jour."
          />
          {documents.map((document) => {
            const isCached =
              document.offlineReady ||
              (document.downloadUrl ? cachedUrls.includes(document.downloadUrl) : false);
            const canToggleOffline = Boolean(document.downloadUrl);

            return (
              <div
                key={`${document.id}-offline`}
                className="rounded-[22px] border border-white/8 bg-white/4 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{document.code}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {document.format} - {document.revision} - {document.fileSizeMb} Mo
                    </p>
                  </div>
                  <StatusBadge tone={isCached ? "success" : "warning"}>
                    {isCached ? "En cache" : "Hors cache"}
                  </StatusBadge>
                </div>
                <button
                  onClick={() => (canToggleOffline ? toggleOffline(document.id) : null)}
                  disabled={!canToggleOffline || pendingAction === "toggle-offline"}
                  title={
                    canToggleOffline
                      ? isCached
                        ? "Retirer cette version du cache local de l'appareil."
                        : "Ajouter cette version au cache local de l'appareil."
                      : "Aucun fichier telechargeable n'est disponible pour cette revision."
                  }
                  className={cx(
                    "mt-3 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm",
                    canToggleOffline && pendingAction !== "toggle-offline"
                      ? "border-white/10 bg-white/5 text-white hover:bg-white/8"
                      : "cursor-not-allowed border-white/8 bg-white/5 text-slate-500",
                  )}
                >
                  <CloudDownload className="size-4" />
                  {pendingAction === "toggle-offline"
                    ? "Sync..."
                    : !canToggleOffline
                      ? "Fichier indisponible"
                      : isCached
                        ? "Retirer du cache"
                        : "Ajouter au cache"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="rounded-[22px] border border-white/8 bg-white/4 p-4">
      <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-3 w-full bg-transparent text-white outline-none"
      />
    </label>
  );
}

function SelectField({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="rounded-[22px] border border-white/8 bg-white/4 p-4">
      <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-3 w-full rounded-2xl border border-white/8 bg-black/20 px-3 py-3 text-sm text-white outline-none"
      >
        {options.map((option) => (
          <option key={`${label}-${option}`} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function StepHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-white/4 px-4 py-3">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-300">{description}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-white">{value}</p>
    </div>
  );
}
