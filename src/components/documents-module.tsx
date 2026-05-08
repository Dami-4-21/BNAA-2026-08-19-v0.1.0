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
  CheckCheck,
  CloudDownload,
  FileStack,
  FolderOpen,
  HardDriveDownload,
  Layers3,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Upload,
} from "lucide-react";

import {
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
import { formatDate } from "@/lib/format";
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

  const selectedDocument =
    documents.find((item) => item.id === selectedDocumentId) ?? documents[0];

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

  const filteredDocuments = useMemo(() => {
    return documents.filter((document) => {
      const needle = deferredSearch.trim().toLowerCase();
      const matchesSearch =
        !needle ||
        document.code.toLowerCase().includes(needle) ||
        document.title.toLowerCase().includes(needle) ||
        document.discipline.toLowerCase().includes(needle) ||
        document.phase.toLowerCase().includes(needle);

      const matchesFilter =
        filter === "Tous" ||
        filter === document.discipline ||
        filter === `Lot ${document.lot}` ||
        filter === `Phase ${document.phase}` ||
        (filter === "Courants" && document.status === "Courante") ||
        (filter === "Obsoletes" && document.status === "Obsolete");

      return matchesSearch && matchesFilter;
    });
  }, [deferredSearch, documents, filter]);

  const recipientsForSelected = useMemo(
    () => recipients.filter((recipient) => recipient.documentId === selectedDocument?.id),
    [recipients, selectedDocument],
  );
  const unreadRecipients = useMemo(
    () => recipientsForSelected.filter((recipient) => recipient.status !== "Lu"),
    [recipientsForSelected],
  );
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
        title="Plans d'execution et diffusion controlee"
        description="Publier la bonne revision, la diffuser au bon groupe, puis suivre les lectures sans perdre la trace documentaire."
        action={
          <button
            onClick={() => (canPublishVersion ? selectTab("versions") : null)}
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
          <MetricCard
            key={item.label}
            label={item.label}
            value={item.value}
            helper={item.helper}
            tone={item.tone}
            icon={metricIcons[index]}
          />
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

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel
          title="Parcours documentaire"
          description="Le flux reste simple : choisir la reference, publier la bonne revision, diffuser, puis verifier les lectures."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {workflowSteps.map((step) => (
              <div
                key={step.step}
                className={cx(
                  "rounded-[22px] border px-4 py-4",
                  step.state === "done"
                    ? "border-emerald-200 bg-emerald-50"
                    : step.state === "current"
                      ? "border-black/10 bg-stone-100"
                      : "border-stone-200 bg-stone-50",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-stone-950">{step.step}</p>
                  <StatusBadge
                    tone={
                      step.tone === "danger"
                        ? "danger"
                        : step.tone === "warning"
                          ? "warning"
                          : step.tone === "success"
                            ? "success"
                            : "primary"
                    }
                  >
                    {step.state === "done"
                      ? "Pret"
                      : step.state === "current"
                        ? "En cours"
                        : "A venir"}
                  </StatusBadge>
                </div>
                <p className="mt-3 text-sm leading-6 text-stone-600">{step.detail}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Prochaine etape"
          description={nextDocumentAction.detail}
          action={
            <button
              type="button"
              onClick={() => selectTab(nextDocumentAction.tab)}
              className={cx(
                "rounded-2xl px-4 py-3 text-sm font-semibold",
                nextDocumentAction.actionTone === "success"
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : nextDocumentAction.actionTone === "warning"
                    ? "bg-amber-500 text-stone-950 hover:bg-amber-400"
                    : "bg-black text-white hover:bg-stone-800",
              )}
            >
              {nextDocumentAction.actionLabel}
            </button>
          }
        >
          <div className="space-y-4">
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-stone-950">{nextDocumentAction.title}</p>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{nextDocumentAction.helper}</p>
                </div>
                {selectedDocument ? (
                  <StatusBadge tone={selectedDocument.tone}>{selectedDocument.status}</StatusBadge>
                ) : null}
              </div>
            </div>

            {selectedDocument ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <MiniStat label="Revision" value={selectedDocument.revision} />
                <MiniStat label="Diffusion" value={selectedDocument.recipients > 0 ? `${selectedDocument.recipients} cible(s)` : "A lancer"} />
                <MiniStat label="Lectures" value={selectedDocument.recipients > 0 ? `${readRate}%` : "0%"} />
              </div>
            ) : null}
          </div>
        </Panel>
      </div>

      <Panel className="overflow-hidden">
        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => selectTab(tab.key)}
                  className={cx(
                    "rounded-[20px] border px-4 py-3 text-left",
                    activeTab === tab.key
                      ? "border-sky-400/25 bg-sky-400/12 text-white"
                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/8",
                  )}
                >
                  <div className="text-sm font-semibold">{tab.label}</div>
                  <div className="mt-1 text-xs text-slate-400">{tab.helper}</div>
                </button>
              ))}
            </div>

            <div className="rounded-[28px] border border-white/8 bg-white/4 p-5">
              {activeTab === "library" ? (
                <LibraryTab
                  documents={filteredDocuments}
                  selectedDocumentId={selectedDocumentId}
                  selectDocument={handleSelectDocument}
                  search={search}
                  setSearch={setSearch}
                  filter={filter}
                  setFilter={setFilter}
                  documentFilters={documentFilters}
                />
              ) : null}

              {activeTab === "versions" ? selectedDocument ? (
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
              ) : null : null}

              {activeTab === "distribution" ? selectedDocument ? (
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
              ) : null : null}

              {activeTab === "offline" ? (
                <OfflineTab
                  documents={documents}
                  offlineSummary={overview.offline}
                  cachedUrls={cachedDocumentUrls}
                  pendingAction={pendingAction}
                  toggleOffline={toggleOffline}
                />
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            <Panel
              title="Revision selectionnee"
              description="Consultez la version courante, mettez a jour ses metadonnees et comparez les revisions PDF."
            >
              {selectedDocument ? (
                <div className="space-y-4 rounded-[24px] border border-white/8 bg-white/4 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-display text-2xl font-semibold text-white">
                        {selectedDocument.code}
                      </p>
                      <p className="mt-1 text-sm text-slate-300">
                        {selectedDocument.title}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge tone={selectedDocument.tone}>
                        {selectedDocument.status}
                      </StatusBadge>
                      <StatusBadge tone="primary">
                        {selectedDocument.revision}
                      </StatusBadge>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
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
                      options={projectData.projectSetup.lots}
                      onChange={(value) =>
                        setMetadataDraft((current) => ({ ...current, lot: value }))
                      }
                    />
                    <SelectField
                      label="Phase"
                      value={metadataDraft.phase}
                      options={projectData.projectSetup.phases}
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
                      "inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold",
                      canSubmitMetadataUpdate
                        ? "border border-white/10 bg-white/5 text-white hover:bg-white/8"
                        : "cursor-not-allowed border border-white/8 bg-white/5 text-slate-500",
                    )}
                  >
                    <CheckCheck className="size-4" />
                    {pendingAction === "update-metadata"
                      ? "Mise a jour..."
                      : "Mettre a jour les metadonnees"}
                  </button>
                  <p className="text-xs leading-5 text-slate-400">{metadataActionHelper}</p>

                  <div className="rounded-[22px] border border-dashed border-sky-400/20 bg-sky-400/8 p-5">
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge tone="success">
                        {selectedDocument.isCurrent ? "Version en vigueur" : "Hors vigueur"}
                      </StatusBadge>
                      <StatusBadge tone="primary">
                        {selectedDocument.readCount}/{selectedDocument.recipients} lus
                      </StatusBadge>
                      <StatusBadge tone={selectedDocument.offlineReady ? "success" : "warning"}>
                        {selectedDocument.offlineReady ? "Offline pret" : "Non synchronise"}
                      </StatusBadge>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      {selectedDocument.downloadUrl ? (
                        <a
                          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/8"
                          href={selectedDocument.downloadUrl}
                          target="_blank"
                        >
                          <CloudDownload className="size-4" />
                          Telecharger la version courante
                        </a>
                      ) : (
                        <div className="rounded-full border border-white/8 bg-white/4 px-4 py-2 text-sm text-slate-400">
                          Aucun fichier televerse pour cette revision
                        </div>
                      )}
                      {selectedDocument.fileName ? (
                        <div className="rounded-full border border-white/8 bg-white/4 px-4 py-2 text-sm text-slate-300">
                          {selectedDocument.fileName}
                        </div>
                      ) : null}
                    </div>
                    {selectedDocument.format === "PDF" ? (
                      <div className="mt-4">
                        <PdfOverlayCompare
                          document={selectedDocument}
                          key={`${selectedDocument.id}-${selectedCompareVersion || "default"}`}
                          onSelectVersion={(version) =>
                            setComparisonSelections((current) => ({
                              ...current,
                              [selectedDocument.id]: version,
                            }))
                          }
                          selectedVersion={selectedCompareVersion}
                        />
                      </div>
                    ) : (
                      <div className="mt-4 rounded-[22px] border border-white/8 bg-white/4 px-4 py-5 text-sm leading-6 text-slate-300">
                        La comparaison visuelle par superposition est disponible pour les revisions
                        PDF. Les autres formats restent consultables via l&apos;historique et le
                        telechargement courant.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </Panel>

            <Panel
              title="Classement du projet"
              description="Retrouvez la structure par lot, phase et dossier de diffusion."
            >
              <div className="space-y-3">
                {projectData.tree.map((root: DocumentTreeRoot) => (
                  <div
                    key={root.title}
                    className="rounded-[22px] border border-white/8 bg-white/4 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <FolderOpen className="size-4 text-slate-400" />
                      <p className="text-sm font-semibold text-white">{root.title}</p>
                    </div>
                    <div className="mt-4 space-y-3">
                      {root.nodes.map((node) => (
                        <div
                          key={node.label}
                          className="rounded-[18px] border border-white/8 bg-white/4 px-4 py-3"
                        >
                          <p className="text-sm text-white">{node.label}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Phases: {node.phases.join(", ")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

          </div>
        </div>
      </Panel>
    </div>
  );
}

function LibraryTab({
  documents,
  selectedDocumentId,
  selectDocument,
  search,
  setSearch,
  filter,
  setFilter,
  documentFilters,
}: {
  documents: DocumentFile[];
  selectedDocumentId: string;
  selectDocument: (documentId: string) => void;
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  filter: string;
  setFilter: React.Dispatch<React.SetStateAction<string>>;
  documentFilters: string[];
}) {
  return (
    <div className="space-y-4">
      <StepHeading
        title="1. Trouver la bonne reference"
        description="Cherchez un plan, filtrez par lot ou phase, puis gardez une seule reference active pour la suite."
      />
      <label className="glass-panel-soft flex items-center gap-3 rounded-[24px] px-4 py-4 text-sm text-slate-300">
        <Search className="size-4 text-slate-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
          placeholder="Chercher un plan, une phase, une discipline..."
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {documentFilters.map((item) => (
          <button
            key={item}
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

      <StepHeading
        title="2. Ouvrir le document de travail"
        description="Selectionnez la revision a traiter pour synchroniser la publication, la diffusion et le suivi."
      />
      <div className="space-y-3">
        {documents.map((document) => (
          <button
            key={document.id}
            type="button"
            onClick={() => selectDocument(document.id)}
            title={
              selectedDocumentId === document.id
                ? "Ce document est deja selectionne."
                : "Ouvrir ce document et synchroniser la selection dans l'URL."
            }
            className={cx(
              "w-full rounded-[24px] border p-4 text-left",
              selectedDocumentId === document.id
                ? "border-sky-400/25 bg-sky-400/10"
                : "border-white/8 bg-white/4 hover:bg-white/6",
            )}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display text-lg font-semibold text-white">
                    {document.code}
                  </p>
                  <StatusBadge tone={document.tone}>{document.status}</StatusBadge>
                  <StatusBadge tone="primary">{document.format}</StatusBadge>
                </div>
                <p className="mt-2 text-sm text-slate-200">{document.title}</p>
                <p className="mt-1 text-sm text-slate-400">
                  {document.discipline} - {document.lot} - {document.phase}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm text-slate-300 sm:grid-cols-4">
                <MiniStat label="Revision" value={document.revision} />
                <MiniStat label="Taille" value={`${document.fileSizeMb} Mo`} />
                <MiniStat label="Publie" value={formatDate(document.publishedAt)} />
                <MiniStat label="Lectures" value={`${document.readCount}/${document.recipients}`} />
              </div>
            </div>
          </button>
        ))}
      </div>
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
