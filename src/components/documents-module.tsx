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

type DocumentFile = DocumentsPayload["files"][number];

type Recipient = {
  id: string;
  documentId: string;
  name: string;
  role: string;
  status: string;
  acknowledgedAt: string;
};

type DocumentTreeRoot = {
  title: string;
  nodes: Array<{ label: string; phases: string[] }>;
};

const tabs: Array<{ key: DocumentsTab; label: string; helper: string }> = [
  {
    key: "library",
    label: "Bibliotheque",
    helper: "Arborescence, formats, recherche et acces rapide",
  },
  {
    key: "versions",
    label: "Versionning",
    helper: "Historique, comparaison visuelle et version courante",
  },
  {
    key: "distribution",
    label: "Diffusion",
    helper: "Destinataires, lecture et plans obsoletes",
  },
  {
    key: "offline",
    label: "Offline mobile",
    helper: "Cache intelligent et acces chantier sans 4G",
  },
];

const metricIcons = [HardDriveDownload, CheckCheck, Layers3, ShieldCheck];

const toneByReadStatus: Record<string, ActiveTone> = {
  Lu: "success",
  "Non lu": "warning",
};

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
      </div>
    );
  }

  if (!projectData) {
    return (
      <div className="space-y-6">
        <SectionHeading eyebrow="Documents" title="La GED est indisponible" />
        <Panel>{error}</Panel>
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
  currentUserRole,
  projectData,
}: {
  canAcknowledge: boolean;
  activeProjectId: string;
  canDistribute: boolean;
  canMarkObsolete: boolean;
  canPublishVersion: boolean;
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
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
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

  async function runDocumentsAction(action: string, payload: Record<string, unknown>) {
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
  const hasMetadataChanges = Boolean(
    selectedDocument &&
      (metadataDraft.title !== selectedDocument.title ||
        metadataDraft.discipline !== selectedDocument.discipline ||
        metadataDraft.lot !== selectedDocument.lot ||
        metadataDraft.phase !== selectedDocument.phase),
  );
  const canSubmitMetadataUpdate = Boolean(canPublishVersion && selectedDocument && hasMetadataChanges);
  const metadataActionHelper = !canPublishVersion
    ? "Votre role peut consulter les metadonnees, mais pas les modifier."
    : !selectedDocument
      ? "Selectionnez un document pour modifier ses metadonnees."
      : hasMetadataChanges
        ? "Les metadonnees modifiees seront enregistrees sur la revision courante."
        : "Aucune modification de metadonnees a enregistrer.";
  const canPublishSelectedVersion = Boolean(canPublishVersion && versionFile);
  const publishVersionHelper = !canPublishVersion
    ? "Votre role ne peut pas publier de nouvelle revision."
    : versionFile
      ? "La nouvelle revision sera publiee comme version courante."
      : "Ajoutez un fichier avant de publier une nouvelle revision.";
  const canMarkSelectedObsolete = Boolean(
    canMarkObsolete && selectedDocument && selectedDocument.status !== "Obsolete",
  );
  const markObsoleteHelper = !canMarkObsolete
    ? "Votre role ne peut pas marquer un plan comme obsolete."
    : selectedDocument?.status === "Obsolete"
      ? "Ce plan est deja marque obsolete."
      : "Le plan sera retire des revisions en vigueur.";
  const canDistributeSelected = Boolean(
    canDistribute && selectedDocument && draftVersion.audience.trim(),
  );
  const distributeActionHelper = !canDistribute
    ? "Votre role peut consulter la diffusion, mais pas la lancer."
    : draftVersion.audience.trim()
      ? "La liste selectionnee recevra une diffusion controlee avec accuse de lecture."
      : "Choisissez d'abord une liste de diffusion.";
  const selectedCompareVersion = selectedDocument
    ? comparisonSelections[selectedDocument.id] ?? selectedDocument.compareWith
    : "";

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
    }
  }

  async function markObsolete(documentId: string) {
    try {
      await runDocumentsAction("mark-obsolete", { documentId });
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
      });
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
      });
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Accuse impossible.");
    }
  }

  async function toggleOffline(documentId: string) {
    try {
      const nextData = await runDocumentsAction("toggle-offline", { documentId });
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
      });
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Mise a jour impossible.");
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Documents"
        title="Controle documentaire et diffusion des plans"
        action={
          <button
            onClick={() => (canPublishVersion ? selectTab("versions") : null)}
            disabled={!canPublishVersion}
            className={cx(
              "rounded-2xl px-4 py-3 text-sm font-semibold",
              canPublishVersion
                ? "bg-black text-white hover:bg-stone-800"
                : "cursor-not-allowed bg-stone-200 text-stone-500",
            )}
          >
            Publier un plan
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
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-6 text-rose-700">
          {mutationError}
        </div>
      ) : null}

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
                  canAcknowledge={canAcknowledge}
                  canDistributeSelected={canDistributeSelected}
                  distributeActionHelper={distributeActionHelper}
                  selectedDocument={selectedDocument}
                  recipients={recipientsForSelected}
                  draftVersion={draftVersion}
                  setDraftVersion={setDraftVersion}
                  distributionOptions={projectData.distributionOptions}
                  distributeSelected={distributeSelected}
                  acknowledgeRecipient={acknowledgeRecipient}
                />
              ) : null : null}

              {activeTab === "offline" ? (
                <OfflineTab
                  documents={documents}
                  offlineSummary={overview.offline}
                  cachedUrls={cachedDocumentUrls}
                  toggleOffline={toggleOffline}
                />
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            <Panel
              title="Preview & comparaison"
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
                    Mettre a jour les metadonnees
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
              title="Arborescence projet"
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
              {canPublishSelectedVersion ? "Publier nouvelle version" : "Publication indisponible"}
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
              Marquer obsolete
            </button>
          </div>
          <div className="grid gap-2 text-xs leading-5 text-slate-400 sm:grid-cols-2">
            <p>{publishVersionHelper}</p>
            <p>{markObsoleteHelper}</p>
          </div>
        </div>

        <div className="rounded-[22px] border border-white/8 bg-white/4 p-4">
          <div className="flex items-center gap-2">
            <FileStack className="size-4 text-slate-400" />
            <p className="text-sm font-semibold text-white">
              Historique complet des versions
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
  canAcknowledge,
  canDistributeSelected,
  distributeActionHelper,
  selectedDocument,
  recipients,
  draftVersion,
  setDraftVersion,
  distributionOptions,
  distributeSelected,
  acknowledgeRecipient,
}: {
  canAcknowledge: boolean;
  canDistributeSelected: boolean;
  distributeActionHelper: string;
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
  acknowledgeRecipient: (recipientId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <SelectField
            label="Liste de diffusion"
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
                {selectedDocument.code} - accusés de reception
              </p>
              <StatusBadge tone="primary">
                {selectedDocument.readCount}/{selectedDocument.recipients} lus
              </StatusBadge>
            </div>
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.14em] text-slate-500">
                <span>Taux de lecture</span>
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
            {canDistributeSelected ? "Creer la diffusion controlee" : "Diffusion indisponible"}
          </button>
          <p className="text-xs leading-5 text-slate-400">{distributeActionHelper}</p>
        </div>

        <div className="space-y-3">
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
                  onClick={() => (canAcknowledge ? acknowledgeRecipient(recipient.id) : null)}
                  disabled={!canAcknowledge}
                  title={
                    canAcknowledge
                      ? "Confirmer la lecture de ce document pour la diffusion controlee."
                      : "Votre role ne peut pas accuser reception des documents."
                  }
                  className={cx(
                    "mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm",
                    canAcknowledge
                      ? "border border-white/10 bg-white/5 text-white hover:bg-white/8"
                      : "cursor-not-allowed border border-white/8 bg-white/5 text-slate-500",
                  )}
                >
                  <CheckCheck className="size-4" />
                  Marquer comme lu
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
  toggleOffline,
}: {
  documents: DocumentFile[];
  offlineSummary: {
    syncedAt: string;
    cachedFiles: number;
    coverage: string;
  };
  cachedUrls: string[];
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
                  disabled={!canToggleOffline}
                  title={
                    canToggleOffline
                      ? isCached
                        ? "Retirer cette version du cache local de l'appareil."
                        : "Ajouter cette version au cache local de l'appareil."
                      : "Aucun fichier telechargeable n'est disponible pour cette revision."
                  }
                  className={cx(
                    "mt-3 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm",
                    canToggleOffline
                      ? "border-white/10 bg-white/5 text-white hover:bg-white/8"
                      : "cursor-not-allowed border-white/8 bg-white/5 text-slate-500",
                  )}
                >
                  <CloudDownload className="size-4" />
                  {!canToggleOffline
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-white">{value}</p>
    </div>
  );
}
