"use client";

import {
  startTransition,
  useDeferredValue,
  useMemo,
  useState,
} from "react";
import {
  CheckCheck,
  CloudDownload,
  FileDiff,
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
import { formatDate } from "@/lib/format";
import {
  getDocumentsModuleData,
} from "@/lib/mock-data";
import { useWorkspace } from "@/components/workspace-context";

type DocumentsTab = "library" | "versions" | "distribution" | "offline";

type ActiveTone = "primary" | "success" | "warning" | "danger";

type DocumentFile = {
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
  tone: ActiveTone;
  isCurrent: boolean;
  offlineReady: boolean;
  lastDistributedAt: string;
  readCount: number;
  recipients: number;
  storage: string;
  versions: Array<{ version: string; publishedAt: string; status: string }>;
  compareWith: string;
};

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
  const projectData = useMemo(
    () => getDocumentsModuleData(activeProject.id),
    [activeProject.id],
  );
  const canPublishVersion = can("documents.version.publish");
  const canDistribute = can("documents.distribute");
  const canMarkObsolete = can("documents.obsolete.mark");

  return (
    <DocumentsModuleContent
      key={activeProject.id}
      canDistribute={canDistribute}
      canMarkObsolete={canMarkObsolete}
      canPublishVersion={canPublishVersion}
      currentUserRole={currentUser.role}
      projectData={projectData}
    />
  );
}

function DocumentsModuleContent({
  canDistribute,
  canMarkObsolete,
  canPublishVersion,
  currentUserRole,
  projectData,
}: {
  canDistribute: boolean;
  canMarkObsolete: boolean;
  canPublishVersion: boolean;
  currentUserRole: string;
  projectData: ReturnType<typeof getDocumentsModuleData>;
}) {
  const [activeTab, setActiveTab] = useState<DocumentsTab>("library");
  const [documents, setDocuments] = useState<DocumentFile[]>(projectData.files);
  const [recipients, setRecipients] = useState<Recipient[]>(projectData.recipients);
  const [selectedDocumentId, setSelectedDocumentId] = useState(
    projectData.files[0]?.id ?? "",
  );
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Tous");
  const [draftVersion, setDraftVersion] = useState(projectData.draftVersion);

  const deferredSearch = useDeferredValue(search);

  const selectedDocument =
    documents.find((item) => item.id === selectedDocumentId) ?? documents[0];

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
        (filter === "Courants" && document.status === "Courante") ||
        (filter === "Obsoletes" && document.status === "Obsolete");

      return matchesSearch && matchesFilter;
    });
  }, [deferredSearch, documents, filter]);

  const recipientsForSelected = useMemo(
    () => recipients.filter((recipient) => recipient.documentId === selectedDocument?.id),
    [recipients, selectedDocument?.id],
  );

  const documentFilters = useMemo(
    () => [
      "Tous",
      ...new Set(documents.map((document) => document.discipline)),
      "Courants",
      "Obsoletes",
    ],
    [documents],
  );

  function publishNewVersion() {
    if (!selectedDocument) {
      return;
    }

    const currentRevision = draftVersion.revision;

    startTransition(() => {
      setDocuments((current) =>
        current.map((item) =>
          item.id === selectedDocument.id
            ? {
                ...item,
                revision: currentRevision,
                format: draftVersion.format,
                publishedAt: "2026-04-30",
                status: "Diffusion",
                tone: "primary",
                isCurrent: true,
                offlineReady: true,
                compareWith: item.revision,
                versions: [
                  ...item.versions.map((version) =>
                    version.status === "Courante"
                      ? { ...version, status: "Archive" }
                      : version,
                  ),
                  {
                    version: currentRevision,
                    publishedAt: "2026-04-30",
                    status: "Courante",
                  },
                ],
              }
            : item,
        ),
      );
    });
  }

  function markObsolete(documentId: string) {
    startTransition(() => {
      setDocuments((current) =>
        current.map((item) =>
          item.id === documentId
            ? {
                ...item,
                status: "Obsolete",
                tone: "warning",
                isCurrent: false,
              }
            : item,
        ),
      );
    });
  }

  function distributeSelected() {
    if (!selectedDocument) {
      return;
    }

    startTransition(() => {
      setDocuments((current) =>
        current.map((item) =>
          item.id === selectedDocument.id
            ? {
                ...item,
                status: "Diffusion",
                tone: "primary",
                lastDistributedAt: "2026-04-30",
                recipients: Math.max(item.recipients, 18),
                readCount: Math.min(item.readCount, 15),
              }
            : item,
        ),
      );

      setRecipients((current) => {
        const exists = current.some(
          (recipient) =>
            recipient.documentId === selectedDocument.id &&
            recipient.role === draftVersion.audience,
        );

        if (exists) {
          return current;
        }

        return [
          ...current,
          {
            id: `REC-${Date.now()}`,
            documentId: selectedDocument.id,
            name: draftVersion.audience,
            role: "Liste de diffusion",
            status: "Non lu",
            acknowledgedAt: "",
          },
        ];
      });
    });
  }

  function acknowledgeRecipient(recipientId: string) {
    startTransition(() => {
      setRecipients((current) =>
        current.map((item) =>
          item.id === recipientId
            ? {
                ...item,
                status: "Lu",
                acknowledgedAt: "2026-04-30 17:08",
              }
            : item,
        ),
      );

      if (selectedDocument) {
        setDocuments((current) =>
          current.map((item) =>
            item.id === selectedDocument.id
              ? {
                  ...item,
                  readCount: Math.min(item.readCount + 1, item.recipients || item.readCount + 1),
                  tone: item.status === "Courante" ? "success" : item.tone,
                }
              : item,
          ),
        );
      }
    });
  }

  function toggleOffline(documentId: string) {
    startTransition(() => {
      setDocuments((current) =>
        current.map((item) =>
          item.id === documentId
            ? { ...item, offlineReady: !item.offlineReady }
            : item,
        ),
      );
    });
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Documents"
        title="Controle documentaire et diffusion des plans"
        action={
          <button
            onClick={() => (canPublishVersion ? setActiveTab("versions") : null)}
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
        {projectData.overview.kpis.map((item, index) => (
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

      {!canPublishVersion || !canDistribute || !canMarkObsolete ? (
        <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm leading-6 text-stone-600">
          Votre role <span className="font-semibold text-stone-950">{currentUserRole}</span> peut
          consulter la documentation, avec des actions de publication et de diffusion selon les
          droits attribues.
        </div>
      ) : null}

      <Panel className="overflow-hidden">
        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
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
                  setSelectedDocumentId={setSelectedDocumentId}
                  search={search}
                  setSearch={setSearch}
                  filter={filter}
                  setFilter={setFilter}
                  documentFilters={documentFilters}
                />
              ) : null}

              {activeTab === "versions" ? selectedDocument ? (
                <VersionsTab
                  canMarkObsolete={canMarkObsolete}
                  canPublishVersion={canPublishVersion}
                  selectedDocument={selectedDocument}
                  draftVersion={draftVersion}
                  setDraftVersion={setDraftVersion}
                  publishNewVersion={publishNewVersion}
                  markObsolete={markObsolete}
                />
              ) : null : null}

              {activeTab === "distribution" ? selectedDocument ? (
                <DistributionTab
                  canDistribute={canDistribute}
                  selectedDocument={selectedDocument}
                  recipients={recipientsForSelected}
                  draftVersion={draftVersion}
                  setDraftVersion={setDraftVersion}
                  distributeSelected={distributeSelected}
                  acknowledgeRecipient={acknowledgeRecipient}
                />
              ) : null : null}

              {activeTab === "offline" ? (
                <OfflineTab
                  documents={documents}
                  offlineSummary={projectData.overview.offline}
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
                <div className="rounded-[24px] border border-white/8 bg-white/4 p-5">
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

                  <div className="mt-6 rounded-[22px] border border-dashed border-sky-400/20 bg-sky-400/8 p-5">
                    <div className="aspect-[4/3] rounded-[18px] border border-white/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4">
                      <div className="flex h-full items-end justify-between rounded-[14px] border border-white/6 bg-[#08111f]/65 p-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            Comparaison
                          </p>
                          <p className="mt-2 text-sm text-white">
                            {selectedDocument.compareWith} vs {selectedDocument.revision}
                          </p>
                        </div>
                        <FileDiff className="size-5 text-slate-300" />
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
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
  setSelectedDocumentId,
  search,
  setSearch,
  filter,
  setFilter,
  documentFilters,
}: {
  documents: DocumentFile[];
  selectedDocumentId: string;
  setSelectedDocumentId: React.Dispatch<React.SetStateAction<string>>;
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
            onClick={() => setSelectedDocumentId(document.id)}
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
  canMarkObsolete,
  canPublishVersion,
  selectedDocument,
  draftVersion,
  setDraftVersion,
  publishNewVersion,
  markObsolete,
}: {
  canMarkObsolete: boolean;
  canPublishVersion: boolean;
  selectedDocument: DocumentFile;
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

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => (canPublishVersion ? publishNewVersion() : null)}
              disabled={!canPublishVersion}
              className={cx(
                "flex items-center justify-center gap-2 rounded-[22px] px-4 py-4 text-sm font-semibold",
                canPublishVersion
                  ? "bg-sky-400 text-slate-950 hover:bg-sky-300"
                  : "cursor-not-allowed bg-slate-700 text-slate-400",
              )}
            >
              <Upload className="size-4" />
              {canPublishVersion ? "Publier nouvelle version" : "Lecture seule des versions"}
            </button>
            <button
              onClick={() => (canMarkObsolete ? markObsolete(selectedDocument.id) : null)}
              disabled={!canMarkObsolete}
              className={cx(
                "flex items-center justify-center gap-2 rounded-[22px] px-4 py-4 text-sm font-semibold",
                canMarkObsolete
                  ? "border border-white/10 bg-white/5 text-white hover:bg-white/8"
                  : "cursor-not-allowed border border-white/8 bg-white/5 text-slate-500",
              )}
            >
              <ShieldCheck className="size-4" />
              Marquer obsolete
            </button>
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
  canDistribute,
  selectedDocument,
  recipients,
  draftVersion,
  setDraftVersion,
  distributeSelected,
  acknowledgeRecipient,
}: {
  canDistribute: boolean;
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
  distributeSelected: () => void;
  acknowledgeRecipient: (recipientId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <Field
            label="Liste de diffusion"
            value={draftVersion.audience}
            onChange={(value) =>
              setDraftVersion((current) => ({ ...current, audience: value }))
            }
          />

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
            onClick={() => (canDistribute ? distributeSelected() : null)}
            disabled={!canDistribute}
            className={cx(
              "flex w-full items-center justify-center gap-2 rounded-[22px] px-4 py-4 text-sm font-semibold",
              canDistribute
                ? "bg-sky-400 text-slate-950 hover:bg-sky-300"
                : "cursor-not-allowed bg-slate-700 text-slate-400",
            )}
          >
            <Send className="size-4" />
            {canDistribute ? "Creer la diffusion controlee" : "Lecture seule de la diffusion"}
          </button>
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
                  onClick={() => (canDistribute ? acknowledgeRecipient(recipient.id) : null)}
                  disabled={!canDistribute}
                  className={cx(
                    "mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm",
                    canDistribute
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
  toggleOffline,
}: {
  documents: DocumentFile[];
  offlineSummary: {
    syncedAt: string;
    cachedFiles: number;
    coverage: string;
  };
  toggleOffline: (documentId: string) => void;
}) {
  const cached = documents.filter((document) => document.offlineReady).length;

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
          {documents.map((document) => (
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
                <StatusBadge tone={document.offlineReady ? "success" : "warning"}>
                  {document.offlineReady ? "En cache" : "Hors cache"}
                </StatusBadge>
              </div>
              <button
                onClick={() => toggleOffline(document.id)}
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/8"
              >
                <CloudDownload className="size-4" />
                {document.offlineReady ? "Retirer du cache" : "Ajouter au cache"}
              </button>
            </div>
          ))}
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-white">{value}</p>
    </div>
  );
}
