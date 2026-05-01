"use client";

import {
  startTransition,
  useEffect,
  useDeferredValue,
  useMemo,
  useState,
} from "react";
import {
  Camera,
  CheckCheck,
  ClipboardCheck,
  CloudSun,
  FileOutput,
  MapPin,
  Radio,
  Search,
  ShieldAlert,
  Signature,
  TimerReset,
  Waves,
} from "lucide-react";

import {
  MetricCard,
  Panel,
  ProgressBar,
  SectionHeading,
  StatusBadge,
  type Tone,
  cx,
} from "@/components/ui";
import { formatDate } from "@/lib/format";
import { apiFetch, apiUpload } from "@/lib/api";
import type { SiteModuleData as SitePayload } from "@/lib/backend/types";
import { useWorkspace } from "@/components/workspace-context";

type TabKey = "overview" | "rjc" | "photos" | "ncr";
type ActiveTone = "primary" | "success" | "warning" | "danger";

type ReportItem = {
  id: string;
  date: string;
  weather: string;
  workforce: number;
  progress: number;
  author: string;
  status: string;
  tone: Tone;
  summary: string;
  completeness: number;
  pdfReady: boolean;
  signedByCt: boolean;
  signedByMoe: boolean;
  activities?: string;
  ctSignatureAt?: string;
  ctSignatureBy?: string;
  incidents?: string;
  moeSignatureAt?: string;
  moeSignatureBy?: string;
  note?: string;
  progressByLot?: FormState["progressByLot"];
  pdfUrl?: string;
};

type PhotoItem = {
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
  fileName?: string;
  fileUrl?: string;
  mimeType?: string;
};

type SignatureItem = {
  role: string;
  state: string;
  note: string;
  tone: Tone;
};

type NcrItem = {
  ref: string;
  title: string;
  owner: string;
  dueDate: string;
  severity: string;
  status: string;
  tone: Tone;
  photoAttached: boolean;
  description: string;
};

type FormState = {
  reportDate: string;
  weather: string;
  workforceCount: number;
  activities: string;
  incidents: string;
  note: string;
  progressByLot: Array<{
    lot: string;
    task: string;
    progress: number;
    tone: ActiveTone;
  }>;
};

type WorkspaceProject = ReturnType<typeof useWorkspace>["activeProject"];

const tabs: Array<{ key: TabKey; label: string; helper: string }> = [
  {
    key: "overview",
    label: "Temps reel",
    helper: "KPIs, meteo, derive et signatures",
  },
  {
    key: "rjc",
    label: "Rapport journalier",
    helper: "Creation, progression, PDF et signature",
  },
  {
    key: "photos",
    label: "Journal photo",
    helper: "Galerie geo, lots et zones",
  },
  {
    key: "ncr",
    label: "Non-conformites",
    helper: "Creation, assignation et cloture",
  },
];

const kpiIcons = [ClipboardCheck, ShieldAlert, TimerReset, Radio];

const toneByStatus: Record<string, Tone> = {
  "En cours": "danger",
  Planifiee: "warning",
  Validation: "primary",
  Levee: "success",
};

function percentComplete({
  workforceCount,
  activities,
  incidents,
}: {
  workforceCount: number;
  activities: string;
  incidents: string;
}) {
  let score = 40;
  if (workforceCount > 0) score += 20;
  if (activities.trim().length > 20) score += 25;
  if (incidents.trim().length > 5) score += 15;
  return Math.min(score, 100);
}

function createFormState(projectData: SitePayload): FormState {
  return {
    reportDate: projectData.reportDraft.reportDate,
    weather: projectData.reportDraft.weather,
    workforceCount: projectData.reportDraft.workforce,
    activities: projectData.reportDraft.completedLots.join("\n"),
    incidents: projectData.reportDraft.blockers,
    note: projectData.reportDraft.note,
    progressByLot: projectData.lotProgress.map((item) => ({
      lot: item.lot,
      task: item.task,
      progress: item.progress,
      tone: item.tone,
    })),
  };
}

function openPdf(url?: string) {
  if (!url || typeof window === "undefined") {
    return;
  }

  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.click();
}

export function SiteModule() {
  const { activeProject, can, currentUser } = useWorkspace();
  const [projectData, setProjectData] = useState<SitePayload | null>(null);
  const [error, setError] = useState("");
  const canCreateReport = can("site.report.create");
  const canValidateReport = can("site.report.validate");
  const canAddPhoto = can("site.photo.create");
  const canCreateNcr = can("site.ncr.create");
  const canCloseNcr = can("site.ncr.close");

  useEffect(() => {
    let cancelled = false;

    async function loadProjectData() {
      try {
        setError("");
        const payload = await apiFetch<SitePayload>(`/api/projects/${activeProject.id}/site`, {
          method: "GET",
        });

        if (!cancelled) {
          setProjectData(payload);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Impossible de charger le suivi chantier.",
          );
        }
      }
    }

    void loadProjectData();

    return () => {
      cancelled = true;
    };
  }, [activeProject.id]);

  if (!projectData && !error) {
    return (
      <div className="space-y-6">
        <SectionHeading eyebrow="Suivi chantier" title="Chargement du suivi chantier" />
      </div>
    );
  }

  if (!projectData) {
    return (
      <div className="space-y-6">
        <SectionHeading eyebrow="Suivi chantier" title="Le suivi chantier est indisponible" />
        <Panel>{error}</Panel>
      </div>
    );
  }

  return (
    <SiteModuleContent
      key={activeProject.id}
      activeProject={activeProject}
      canAddPhoto={canAddPhoto}
      canCloseNcr={canCloseNcr}
      canCreateNcr={canCreateNcr}
      canCreateReport={canCreateReport}
      canValidateReport={canValidateReport}
      currentUserRole={currentUser.role}
      projectData={projectData}
    />
  );
}

function SiteModuleContent({
  activeProject,
  canAddPhoto,
  canCloseNcr,
  canCreateNcr,
  canCreateReport,
  canValidateReport,
  currentUserRole,
  projectData,
}: {
  activeProject: WorkspaceProject;
  canAddPhoto: boolean;
  canCloseNcr: boolean;
  canCreateNcr: boolean;
  canCreateReport: boolean;
  canValidateReport: boolean;
  currentUserRole: string;
  projectData: SitePayload;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [searchPhotos, setSearchPhotos] = useState("");
  const [photoLotFilter, setPhotoLotFilter] = useState("Tous");
  const [overview, setOverview] = useState(projectData.overview);
  const [lotProgress, setLotProgress] = useState(projectData.lotProgress);
  const [signatureQueue, setSignatureQueue] = useState(projectData.signatureQueue);
  const [reports, setReports] = useState<ReportItem[]>(projectData.reports);
  const [photos, setPhotos] = useState<PhotoItem[]>(projectData.photoLibrary);
  const [ncrs, setNcrs] = useState<NcrItem[]>(projectData.ncrs);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [editingReportId, setEditingReportId] = useState("");
  const [formState, setFormState] = useState<FormState>(() =>
    createFormState(projectData),
  );
  const [draftPhoto, setDraftPhoto] = useState(projectData.draftPhoto);
  const [draftNcr, setDraftNcr] = useState(projectData.draftNcr);
  const [mutationError, setMutationError] = useState("");
  const availableLotOptions = projectData.projectSetup.lots;
  const availableZoneOptions = projectData.projectSetup.zones;
  const responsibleOptions = projectData.projectMembers.map((member) => member.name);

  const deferredSearch = useDeferredValue(searchPhotos);

  function applyProjectData(nextData: SitePayload) {
    startTransition(() => {
      setOverview(nextData.overview);
      setLotProgress(nextData.lotProgress);
      setSignatureQueue(nextData.signatureQueue);
      setReports(nextData.reports);
      setPhotos(nextData.photoLibrary);
      setNcrs(nextData.ncrs);
      setPhotoFile(null);
      setEditingReportId("");
      setFormState(createFormState(nextData));
      setDraftPhoto(nextData.draftPhoto);
      setDraftNcr(nextData.draftNcr);
    });
  }

  async function runSiteAction(action: string, payload: Record<string, unknown>) {
    const nextData = await apiFetch<SitePayload>(`/api/projects/${activeProject.id}/site`, {
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

  const reportCompleteness = percentComplete({
    workforceCount: formState.workforceCount,
    activities: formState.activities,
    incidents: formState.incidents,
  });

  const filteredPhotos = useMemo(() => {
    return photos.filter((photo) => {
      const matchesLot = photoLotFilter === "Tous" || photo.lot === photoLotFilter;
      const needle = deferredSearch.trim().toLowerCase();
      const matchesSearch =
        !needle ||
        photo.title.toLowerCase().includes(needle) ||
        photo.zone.toLowerCase().includes(needle) ||
        photo.task.toLowerCase().includes(needle);

      return matchesLot && matchesSearch;
    });
  }, [deferredSearch, photoLotFilter, photos]);

  const openNcrCount = ncrs.filter((ncr) => ncr.status !== "Levee").length;

  const latestReport = reports[0];

  async function submitDailyReport() {
    try {
      await runSiteAction(editingReportId ? "update-report" : "create-report", {
        reportId: editingReportId,
        formState: {
          ...formState,
          reportDate: formState.reportDate.includes("/")
            ? formState.reportDate.split("/").reverse().join("-")
            : formState.reportDate,
        },
      });
      setActiveTab("overview");
    } catch (error) {
      setMutationError(
        error instanceof Error ? error.message : "Creation du rapport impossible.",
      );
    }
  }

  function editReport(report: ReportItem) {
    setEditingReportId(report.id);
    setFormState({
      reportDate: report.date,
      weather: report.weather,
      workforceCount: report.workforce,
      activities: report.activities ?? report.summary,
      incidents: report.incidents ?? "",
      note: report.note ?? "",
      progressByLot:
        report.progressByLot ??
        lotProgress.map((item) => ({
          lot: item.lot,
          task: item.task,
          progress: item.progress,
          tone: item.tone,
        })),
    });
    setActiveTab("rjc");
  }

  function resetReportComposer() {
    setEditingReportId("");
    setFormState(createFormState(projectData));
  }

  async function markPdfReady(reportId: string) {
    try {
      const nextData = await runSiteAction("mark-pdf-ready", { reportId });
      const nextReport = nextData.reports.find((report) => report.id === reportId) as
        | ReportItem
        | undefined;
      openPdf(nextReport?.pdfUrl);
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "PDF indisponible.");
    }
  }

  async function signAsMoe(reportId: string) {
    try {
      await runSiteAction("sign-report", { reportId });
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Signature impossible.");
    }
  }

  function downloadReportPdf(report: ReportItem) {
    openPdf(report.pdfUrl);
  }

  async function addPhoto() {
    try {
      if (!photoFile) {
        throw new Error("Choisissez une photo a joindre au journal chantier.");
      }

      const formData = new FormData();
      formData.set("title", draftPhoto.title);
      formData.set("zone", draftPhoto.zone);
      formData.set("lot", draftPhoto.lot);
      formData.set("task", draftPhoto.task);
      formData.set("geo", draftPhoto.geo);
      formData.set("file", photoFile);

      const nextData = await apiUpload<SitePayload>(
        `/api/projects/${activeProject.id}/site`,
        formData,
        {
          method: "POST",
        },
      );

      setMutationError("");
      applyProjectData(nextData);
      setActiveTab("photos");
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Ajout photo impossible.");
    }
  }

  async function createNcr() {
    try {
      await runSiteAction("create-ncr", { draftNcr });
      setActiveTab("ncr");
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Creation NC impossible.");
    }
  }

  async function closeNcr(ref: string) {
    try {
      await runSiteAction("close-ncr", { ref });
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Cloture NC impossible.");
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Suivi chantier"
        title="Pilotage terrain en temps reel"
        action={
          <button
            onClick={() => (canCreateReport ? setActiveTab("rjc") : null)}
            disabled={!canCreateReport}
            className={cx(
              "rounded-2xl px-4 py-3 text-sm font-semibold",
              canCreateReport
                ? "bg-black text-white hover:bg-stone-800"
                : "cursor-not-allowed bg-stone-200 text-stone-500",
            )}
          >
            Nouveau rapport
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
            icon={kpiIcons[index]}
          />
        ))}
      </div>

      {!canCreateReport || !canAddPhoto || !canCreateNcr || !canValidateReport ? (
        <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm leading-6 text-stone-600">
          Votre role <span className="font-semibold text-stone-950">{currentUserRole}</span> peut
          consulter le suivi chantier, avec des actions limitees sur la saisie terrain et les validations quotidiennes.
        </div>
      ) : null}

      {mutationError ? (
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-6 text-rose-700">
          {mutationError}
        </div>
      ) : null}

      <Panel className="overflow-hidden">
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
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
              {activeTab === "overview" ? (
                <OverviewTab
                  downloadReportPdf={downloadReportPdf}
                  latestReport={latestReport}
                  reports={reports}
                  ncrs={ncrs}
                  signatures={signatureQueue}
                />
              ) : null}

              {activeTab === "rjc" ? (
                <RjcTab
                  canCreateReport={canCreateReport}
                  editingReportId={editingReportId}
                  formState={formState}
                  setFormState={setFormState}
                  reportCompleteness={reportCompleteness}
                  incidentTemplates={projectData.incidentTemplates}
                  resetReportComposer={resetReportComposer}
                  submitDailyReport={submitDailyReport}
                />
              ) : null}

              {activeTab === "photos" ? (
                <PhotosTab
                  canAddPhoto={canAddPhoto}
                  draftPhoto={draftPhoto}
                  photoFile={photoFile}
                  setPhotoFile={setPhotoFile}
                  setDraftPhoto={setDraftPhoto}
                  photos={filteredPhotos}
                  searchPhotos={searchPhotos}
                  setSearchPhotos={setSearchPhotos}
                  photoLotFilter={photoLotFilter}
                  setPhotoLotFilter={setPhotoLotFilter}
                  availableLots={["Tous", ...availableLotOptions]}
                  availableZones={availableZoneOptions}
                  addPhoto={addPhoto}
                />
              ) : null}

              {activeTab === "ncr" ? (
                <NcrTab
                  canCloseNcr={canCloseNcr}
                  canCreateNcr={canCreateNcr}
                  draftNcr={draftNcr}
                  setDraftNcr={setDraftNcr}
                  ncrs={ncrs}
                  responsibleOptions={responsibleOptions}
                  createNcr={createNcr}
                  closeNcr={closeNcr}
                />
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            <Panel
              title="Meteo chantier"
            >
              <div className="rounded-[24px] border border-white/8 bg-white/4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                    <CloudSun className="size-5 text-sky-200" />
                     <p className="font-display text-3xl font-semibold text-white">
                        {overview.weather.temperature}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">
                      {overview.weather.label}
                    </p>
                  </div>
                  <StatusBadge tone="primary">Live</StatusBadge>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                      Vent
                    </p>
                    <p className="mt-1 text-sm text-white">
                      {overview.weather.wind}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                      Risque pluie
                    </p>
                    <p className="mt-1 text-sm text-white">
                      {overview.weather.rainRisk}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                      Source
                    </p>
                    <p className="mt-1 text-sm text-white">API TN</p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  {overview.weather.source}
                </p>
              </div>
            </Panel>

            <Panel
              title="Avancement par lot"
            >
              <div className="space-y-4">
                {formState.progressByLot.map((item, index) => {
                  const planned = lotProgress[index]?.planned ?? item.progress;
                  const delta = item.progress - planned;
                  const deltaTone: Tone =
                    delta >= 0 ? "success" : Math.abs(delta) >= 5 ? "danger" : "warning";

                  return (
                    <div
                      key={item.lot}
                      className="rounded-[22px] border border-white/8 bg-white/4 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{item.lot}</p>
                          <p className="mt-1 text-sm text-slate-300">{item.task}</p>
                        </div>
                        <StatusBadge tone={deltaTone}>
                          {delta >= 0 ? `+${delta}` : delta} pts vs prevu
                        </StatusBadge>
                      </div>
                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.14em] text-slate-500">
                          <span>Reel</span>
                          <span>{item.progress}%</span>
                        </div>
                        <ProgressBar value={item.progress} tone={item.tone} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel
              title="Actions critiques"
            >
              <div className="space-y-3">
                {[
                  "La validation projet du RJC du jour declenche l'archivage PDF.",
                  `${openNcrCount} non-conformites restent ouvertes sur ${activeProject.name}.`,
                  `${activeProject.nextMilestone} reste le prochain jalon a securiser.`,
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-[20px] border border-white/8 bg-white/4 px-4 py-3 text-sm leading-6 text-slate-200"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 2xl:grid-cols-[1.15fr_0.85fr]">
        <Panel
          title="Historique RJC"
        >
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className="rounded-[24px] border border-white/8 bg-white/4 p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-xl font-semibold text-white">
                        {report.id}
                      </p>
                      <StatusBadge tone={report.tone}>{report.status}</StatusBadge>
                      {report.pdfReady ? (
                        <StatusBadge tone="success">PDF pret</StatusBadge>
                      ) : (
                        <StatusBadge tone="warning">PDF attente</StatusBadge>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-slate-300">
                      {formatDate(report.date)} - {report.summary}
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <InfoStat label="Meteo" value={report.weather} />
                      <InfoStat label="Effectif" value={`${report.workforce} ouvriers`} />
                      <InfoStat label="Auteur" value={report.author} />
                    </div>
                    {report.ctSignatureAt || report.moeSignatureAt ? (
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                        {report.ctSignatureAt ? (
                          <span>CT: {report.ctSignatureBy ?? report.author} le {report.ctSignatureAt}</span>
                        ) : null}
                        {report.moeSignatureAt ? (
                          <span>Validation projet: {report.moeSignatureBy ?? "Equipe projet"} le {report.moeSignatureAt}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2 lg:items-end">
                    <div className="flex flex-wrap gap-2">
                      {report.signedByCt ? (
                        <StatusBadge tone="success">CT signe</StatusBadge>
                      ) : (
                        <StatusBadge tone="warning">CT attente</StatusBadge>
                      )}
                      {report.signedByMoe ? (
                        <StatusBadge tone="success">MOE signe</StatusBadge>
                      ) : (
                        <StatusBadge tone="warning">MOE attente</StatusBadge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canCreateReport ? (
                        <button
                          onClick={() => editReport(report)}
                          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/8"
                        >
                          Modifier
                        </button>
                      ) : null}
                      {!report.pdfReady ? (
                        <button
                          onClick={() => (canCreateReport ? markPdfReady(report.id) : null)}
                          disabled={!canCreateReport}
                          className={cx(
                            "rounded-2xl px-4 py-2 text-sm font-semibold",
                            canCreateReport
                              ? "border border-white/10 bg-white/5 text-white hover:bg-white/8"
                              : "cursor-not-allowed border border-white/8 bg-white/5 text-slate-500",
                          )}
                        >
                          Generer PDF
                        </button>
                      ) : null}
                      {report.pdfReady && report.pdfUrl ? (
                        <button
                          onClick={() => downloadReportPdf(report)}
                          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/8"
                        >
                          Telecharger PDF
                        </button>
                      ) : null}
                      {!report.signedByMoe ? (
                        <button
                          onClick={() => (canValidateReport ? signAsMoe(report.id) : null)}
                          disabled={!canValidateReport}
                          className={cx(
                            "rounded-2xl px-4 py-2 text-sm font-semibold",
                            canValidateReport
                              ? "bg-sky-400 text-slate-950 hover:bg-sky-300"
                              : "cursor-not-allowed bg-slate-700 text-slate-400",
                          )}
                        >
                          Valider cote projet
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.14em] text-slate-500">
                    <span>Completude</span>
                    <span>{report.completeness}%</span>
                  </div>
                  <ProgressBar
                    value={report.completeness}
                    tone={report.completeness >= 95 ? "success" : "warning"}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Rappels terrain"
          description="Les equipes chantier retrouvent ici les points de vigilance les plus frequents."
        >
          <div className="space-y-3">
            {[
              "Verifier la validation projet avant l'archivage quotidien des rapports.",
              "Associer chaque photo a une zone ou une tache pour simplifier les recherches.",
              "Cloturer les non-conformites avec une preuve photo et une note de levee.",
            ].map((item) => (
              <div
                key={item}
                className="rounded-[20px] border border-white/8 bg-white/4 px-4 py-3 text-sm leading-6 text-slate-200"
              >
                {item}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function OverviewTab({
  downloadReportPdf,
  latestReport,
  reports,
  ncrs,
  signatures,
}: {
  downloadReportPdf: (report: ReportItem) => void;
  latestReport: ReportItem | undefined;
  reports: ReportItem[];
  ncrs: NcrItem[];
  signatures: SignatureItem[];
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
            Dernier RJC
          </p>
          {latestReport ? (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <p className="font-display text-2xl font-semibold text-white">
                  {latestReport.id}
                </p>
                <StatusBadge tone={latestReport.tone}>{latestReport.status}</StatusBadge>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {latestReport.summary}
              </p>
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.14em] text-slate-500">
                  <span>Completude</span>
                  <span>{latestReport.completeness}%</span>
                </div>
                <ProgressBar
                  value={latestReport.completeness}
                  tone={latestReport.completeness >= 95 ? "success" : "warning"}
                />
              </div>
              {latestReport.pdfReady && latestReport.pdfUrl ? (
                <button
                  onClick={() => downloadReportPdf(latestReport)}
                  className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/8"
                >
                  <FileOutput className="size-4" />
                  Telecharger le PDF
                </button>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
            Signatures & archivage
          </p>
          <div className="mt-4 space-y-3">
            {signatures.map((item) => (
              <div
                key={item.role}
                className="rounded-[20px] border border-white/8 bg-white/4 px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{item.role}</p>
                  <StatusBadge tone={item.tone}>{item.state}</StatusBadge>
                </div>
                <p className="mt-2 text-sm text-slate-300">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
            Derive & alertes
          </p>
          <div className="mt-4 space-y-3">
            {[
              {
                label: "Lot structure",
                detail: "Glissement cumule +2 jours sur la sequence coffrage.",
                tone: "warning" as const,
              },
              {
                label: "Lot CVC",
                detail: "Validation detail acrotere bloque la suite des gaines.",
                tone: "danger" as const,
              },
              {
                label: "RJC du jour",
                detail: `${reports.length} rapports disponibles et archives dans le projet.`,
                tone: "primary" as const,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[20px] border border-white/8 bg-white/4 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{item.label}</p>
                  <StatusBadge tone={item.tone}>Actif</StatusBadge>
                </div>
                <p className="mt-2 text-sm text-slate-300">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
            FNC a suivre
          </p>
          <div className="mt-4 space-y-3">
            {ncrs.slice(0, 3).map((item) => (
              <div
                key={item.ref}
                className="rounded-[20px] border border-white/8 bg-white/4 px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{item.ref}</p>
                  <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
                </div>
                <p className="mt-2 text-sm text-slate-300">{item.title}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RjcTab({
  canCreateReport,
  editingReportId,
  formState,
  setFormState,
  reportCompleteness,
  incidentTemplates,
  resetReportComposer,
  submitDailyReport,
}: {
  canCreateReport: boolean;
  editingReportId: string;
  formState: FormState;
  setFormState: React.Dispatch<React.SetStateAction<FormState>>;
  reportCompleteness: number;
  incidentTemplates: string[];
  resetReportComposer: () => void;
  submitDailyReport: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="rounded-[22px] border border-white/8 bg-white/4 p-4">
              <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Date rapport
              </span>
              <input
                value={formState.reportDate}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    reportDate: event.target.value,
                  }))
                }
                className="mt-3 w-full bg-transparent text-lg font-semibold text-white outline-none"
              />
            </label>
            <label className="rounded-[22px] border border-white/8 bg-white/4 p-4">
              <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Effectif present
              </span>
              <input
                type="number"
                value={formState.workforceCount}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    workforceCount: Number(event.target.value),
                  }))
                }
                className="mt-3 w-full bg-transparent text-lg font-semibold text-white outline-none"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            {["Ensoleille", "Nuageux", "Pluie", "Vent fort"].map((weather) => (
              <button
                key={weather}
                onClick={() =>
                  setFormState((current) => ({
                    ...current,
                    weather,
                  }))
                }
                className={cx(
                  "rounded-full border px-4 py-2 text-sm font-semibold",
                  weather === formState.weather
                    ? "border-sky-400/25 bg-sky-400/12 text-sky-100"
                    : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/8",
                )}
              >
                {weather}
              </button>
            ))}
          </div>

          <label className="block rounded-[24px] border border-white/8 bg-white/4 p-4">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Activites realisees
            </span>
            <textarea
              value={formState.activities}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  activities: event.target.value,
                }))
              }
              className="mt-3 min-h-32 w-full resize-none bg-transparent text-base leading-7 text-white outline-none"
            />
          </label>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="rounded-[22px] border border-white/8 bg-white/4 p-4">
              <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Incidents / blocages
              </span>
              <textarea
                value={formState.incidents}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    incidents: event.target.value,
                  }))
                }
                className="mt-3 min-h-28 w-full resize-none bg-transparent text-sm leading-6 text-white outline-none"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {incidentTemplates.map((tag) => (
                  <button
                    key={tag}
                    onClick={() =>
                      setFormState((current) => ({
                        ...current,
                        incidents: current.incidents.includes(tag)
                          ? current.incidents
                          : `${current.incidents}\n- ${tag}`.trim(),
                      }))
                    }
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 hover:bg-white/8"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </label>

            <label className="rounded-[22px] border border-white/8 bg-white/4 p-4">
              <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Note chef de projet
              </span>
              <textarea
                value={formState.note}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
                className="mt-3 min-h-28 w-full resize-none bg-transparent text-sm leading-6 text-white outline-none"
              />
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[22px] border border-white/8 bg-white/4 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">Completude du RJC</p>
              <StatusBadge tone={reportCompleteness >= 95 ? "success" : "warning"}>
                {reportCompleteness}%
              </StatusBadge>
            </div>
            <div className="mt-4">
              <ProgressBar
                value={reportCompleteness}
                tone={reportCompleteness >= 95 ? "success" : "warning"}
              />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Completez le rapport rapidement depuis le terrain tout en gardant une trace claire
              pour les validations et l&apos;archivage.
            </p>
          </div>

          <div className="rounded-[22px] border border-white/8 bg-white/4 p-4">
            <div className="flex items-center gap-2">
              <Waves className="size-4 text-slate-400" />
              <p className="text-sm font-semibold text-white">Progression par lot / tache</p>
            </div>
            <div className="mt-4 space-y-4">
              {formState.progressByLot.map((item, index) => (
                <div key={item.lot}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-white">{item.lot}</p>
                      <p className="text-xs text-slate-500">{item.task}</p>
                    </div>
                    <span className="text-sm text-slate-300">{item.progress}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={item.progress}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        progressByLot: current.progressByLot.map((entry, entryIndex) =>
                          entryIndex === index
                            ? { ...entry, progress: Number(event.target.value) }
                            : entry,
                        ),
                      }))
                    }
                    className="w-full accent-sky-400"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <ActionButton icon={Camera} label="Photos" />
            <ActionButton icon={Signature} label="Validation projet" />
            <ActionButton icon={FileOutput} label="Preparer PDF" />
          </div>

          {editingReportId ? (
            <button
              onClick={resetReportComposer}
              className="flex w-full items-center justify-center gap-2 rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-sm font-semibold text-white hover:bg-white/8"
            >
              Revenir au nouveau RJC
            </button>
          ) : null}

          <button
            onClick={() => (canCreateReport ? submitDailyReport() : null)}
            disabled={!canCreateReport}
            className={cx(
              "flex w-full items-center justify-center gap-2 rounded-[22px] px-4 py-4 text-sm font-semibold",
              canCreateReport
                ? "bg-sky-400 text-slate-950 hover:bg-sky-300"
                : "cursor-not-allowed bg-slate-700 text-slate-400",
            )}
          >
            <CheckCheck className="size-4" />
            {canCreateReport
              ? editingReportId
                ? "Mettre a jour le RJC"
                : "Soumettre le RJC du jour"
              : "Lecture seule sur le RJC"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PhotosTab({
  canAddPhoto,
  draftPhoto,
  photoFile,
  setPhotoFile,
  setDraftPhoto,
  photos,
  searchPhotos,
  setSearchPhotos,
  photoLotFilter,
  setPhotoLotFilter,
  availableLots,
  availableZones,
  addPhoto,
}: {
  canAddPhoto: boolean;
  draftPhoto: {
    title: string;
    zone: string;
    lot: string;
    task: string;
    geo: string;
  };
  setDraftPhoto: React.Dispatch<
    React.SetStateAction<{
      title: string;
      zone: string;
      lot: string;
      task: string;
      geo: string;
    }>
  >;
  photoFile: File | null;
  setPhotoFile: React.Dispatch<React.SetStateAction<File | null>>;
  photos: PhotoItem[];
  searchPhotos: string;
  setSearchPhotos: React.Dispatch<React.SetStateAction<string>>;
  photoLotFilter: string;
  setPhotoLotFilter: React.Dispatch<React.SetStateAction<string>>;
  availableLots: string[];
  availableZones: string[];
  addPhoto: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Titre photo"
              value={draftPhoto.title}
              onChange={(value) =>
                setDraftPhoto((current) => ({ ...current, title: value }))
              }
            />
            <SelectField
              label="Zone"
              value={draftPhoto.zone}
              options={availableZones}
              onChange={(value) =>
                setDraftPhoto((current) => ({ ...current, zone: value }))
              }
            />
            <SelectField
              label="Lot"
              value={draftPhoto.lot}
              options={availableLots.filter((lot) => lot !== "Tous")}
              onChange={(value) =>
                setDraftPhoto((current) => ({ ...current, lot: value }))
              }
            />
            <Field
              label="Tache associee"
              value={draftPhoto.task}
              onChange={(value) =>
                setDraftPhoto((current) => ({ ...current, task: value }))
              }
            />
          </div>
          <Field
            label="Coordonnees geo"
            value={draftPhoto.geo}
            onChange={(value) =>
              setDraftPhoto((current) => ({ ...current, geo: value }))
            }
          />
          <label className="block rounded-[22px] border border-white/8 bg-white/4 p-4">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Photo terrain
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
              className="mt-3 block w-full text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-950"
            />
            <p className="mt-3 text-sm text-slate-400">
              {photoFile
                ? `${photoFile.name} - ${(photoFile.size / (1024 * 1024)).toFixed(2)} Mo`
                : "Choisissez une image pour alimenter le journal photo geolocalise."}
            </p>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <ActionButton icon={MapPin} label="Capturer GPS" />
            <button
              onClick={() => (canAddPhoto ? addPhoto() : null)}
              disabled={!canAddPhoto}
              className={cx(
                "flex items-center justify-center gap-2 rounded-[22px] px-4 py-4 text-sm font-semibold",
                canAddPhoto
                  ? "bg-sky-400 text-slate-950 hover:bg-sky-300"
                  : "cursor-not-allowed bg-slate-700 text-slate-400",
              )}
            >
              <Camera className="size-4" />
              {canAddPhoto ? "Ajouter au journal photo" : "Consultation du journal photo"}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <label className="flex items-center gap-3 rounded-[22px] border border-white/8 bg-white/4 px-4 py-3 text-sm text-slate-300">
            <Search className="size-4 text-slate-400" />
            <input
              value={searchPhotos}
              onChange={(event) => setSearchPhotos(event.target.value)}
              className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
              placeholder="Chercher par titre, zone ou tache..."
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {availableLots.map((lot) => (
              <button
                key={lot}
                onClick={() => setPhotoLotFilter(lot)}
                className={cx(
                  "rounded-full border px-4 py-2 text-sm font-semibold",
                  photoLotFilter === lot
                    ? "border-sky-400/25 bg-sky-400/12 text-sky-100"
                    : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/8",
                )}
              >
                {lot}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className={`rounded-[24px] border border-white/8 bg-gradient-to-br ${photo.accent} p-[1px]`}
          >
            <div className="h-full rounded-[23px] bg-[#08111f]/90 p-4">
              <div className="flex items-center justify-between gap-3">
                <StatusBadge tone="primary">{photo.lot}</StatusBadge>
                <span className="font-mono text-xs text-slate-400">{photo.time}</span>
              </div>
              {photo.fileUrl ? (
                <div className="mt-4 overflow-hidden rounded-[18px] border border-white/8">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={photo.title}
                    className="h-40 w-full object-cover"
                    src={photo.fileUrl}
                  />
                </div>
              ) : (
                <div className="mt-16" />
              )}
              <div className={photo.fileUrl ? "mt-4" : ""}>
                <p className="text-sm font-semibold text-white">{photo.title}</p>
                <p className="mt-1 text-sm text-slate-300">
                  {photo.zone} - {photo.task}
                </p>
              </div>
              <div className="mt-4 space-y-2 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <MapPin className="size-3" />
                  {photo.geo}
                </div>
                <div>{photo.author}</div>
                {photo.fileName ? <div>{photo.fileName}</div> : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NcrTab({
  canCloseNcr,
  canCreateNcr,
  draftNcr,
  setDraftNcr,
  ncrs,
  responsibleOptions,
  createNcr,
  closeNcr,
}: {
  canCloseNcr: boolean;
  canCreateNcr: boolean;
  draftNcr: {
    title: string;
    owner: string;
    dueDate: string;
    severity: string;
    description: string;
    photoAttached: boolean;
  };
  setDraftNcr: React.Dispatch<
    React.SetStateAction<{
      title: string;
      owner: string;
      dueDate: string;
      severity: string;
      description: string;
      photoAttached: boolean;
    }>
  >;
  ncrs: NcrItem[];
  responsibleOptions: string[];
  createNcr: () => void;
  closeNcr: (ref: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <Field
            label="Titre de la non-conformite"
            value={draftNcr.title}
            onChange={(value) =>
              setDraftNcr((current) => ({ ...current, title: value }))
            }
          />
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Responsable"
              value={draftNcr.owner}
              options={responsibleOptions}
              onChange={(value) =>
                setDraftNcr((current) => ({ ...current, owner: value }))
              }
            />
            <Field
              label="Date de levee cible"
              value={draftNcr.dueDate}
              onChange={(value) =>
                setDraftNcr((current) => ({ ...current, dueDate: value }))
              }
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {["Mineure", "Majeure", "Critique"].map((severity) => (
              <button
                key={severity}
                onClick={() =>
                  setDraftNcr((current) => ({ ...current, severity }))
                }
                className={cx(
                  "rounded-full border px-4 py-2 text-sm font-semibold",
                  draftNcr.severity === severity
                    ? "border-sky-400/25 bg-sky-400/12 text-sky-100"
                    : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/8",
                )}
              >
                {severity}
              </button>
            ))}
          </div>

          <label className="block rounded-[22px] border border-white/8 bg-white/4 p-4">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Description
            </span>
            <textarea
              value={draftNcr.description}
              onChange={(event) =>
                setDraftNcr((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              className="mt-3 min-h-28 w-full resize-none bg-transparent text-sm leading-6 text-white outline-none"
            />
          </label>

          <button
            onClick={() =>
              setDraftNcr((current) => ({
                ...current,
                photoAttached: !current.photoAttached,
              }))
            }
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/8"
          >
            <Camera className="size-4" />
            {draftNcr.photoAttached ? "Photo jointe" : "Ajouter photo"}
          </button>

          <button
            onClick={() => (canCreateNcr ? createNcr() : null)}
            disabled={!canCreateNcr}
            className={cx(
              "flex w-full items-center justify-center gap-2 rounded-[22px] px-4 py-4 text-sm font-semibold",
              canCreateNcr
                ? "bg-sky-400 text-slate-950 hover:bg-sky-300"
                : "cursor-not-allowed bg-slate-700 text-slate-400",
            )}
          >
            <ShieldAlert className="size-4" />
            {canCreateNcr ? "Creer la fiche NC" : "Consultation des non-conformites"}
          </button>
        </div>

        <div className="space-y-3">
          {ncrs.map((item) => (
            <div
              key={item.ref}
              className="rounded-[22px] border border-white/8 bg-white/4 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-lg font-semibold text-white">
                      {item.ref}
                    </p>
                    <StatusBadge tone={item.tone}>{item.severity}</StatusBadge>
                    <StatusBadge tone={toneByStatus[item.status] ?? item.tone}>
                      {item.status}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-sm text-slate-200">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {item.description}
                  </p>
                </div>
                {item.status !== "Levee" ? (
                  <button
                    onClick={() => (canCloseNcr ? closeNcr(item.ref) : null)}
                    disabled={!canCloseNcr}
                    className={cx(
                      "rounded-2xl px-4 py-2 text-sm font-semibold",
                      canCloseNcr
                        ? "border border-white/10 bg-white/5 text-white hover:bg-white/8"
                        : "cursor-not-allowed border border-white/8 bg-white/5 text-slate-500",
                    )}
                  >
                    Cloturer
                  </button>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <InfoStat label="Responsable" value={item.owner} />
                <InfoStat label="Echeance" value={formatDate(item.dueDate)} />
                <InfoStat
                  label="Preuve photo"
                  value={item.photoAttached ? "Oui" : "Non"}
                />
              </div>
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

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-white">{value}</p>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
}: {
  icon: typeof Camera;
  label: string;
}) {
  return (
    <button className="flex items-center justify-between rounded-[22px] border border-dashed border-white/14 bg-white/4 px-4 py-4 text-left hover:bg-white/8">
      <span className="text-sm font-semibold text-white">{label}</span>
      <Icon className="size-4 text-slate-400" />
    </button>
  );
}
