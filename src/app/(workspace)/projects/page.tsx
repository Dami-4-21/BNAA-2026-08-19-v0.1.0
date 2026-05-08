"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Building2,
  ClipboardList,
  Landmark,
  Layers3,
  Settings2,
  Users,
} from "lucide-react";

import { formatTND } from "@/lib/format";
import {
  EmptyStateCard,
  InlineNotice,
  LoadingStateCard,
  Panel,
  ProgressBar,
  SectionHeading,
  StatusBadge,
} from "@/components/ui";
import { useWorkspace } from "@/components/workspace-context";
import { fetchProjects, projectsQueryKey } from "@/lib/queries/projects";

const healthIcons = [Building2, Landmark, Layers3];

function getProjectTone(status: string) {
  if (status.toLowerCase().includes("clot")) {
    return "neutral" as const;
  }
  if (status.toLowerCase().includes("encaissement")) {
    return "warning" as const;
  }
  if (status.toLowerCase().includes("config")) {
    return "primary" as const;
  }
  return "success" as const;
}

export default function ProjectsPage() {
  const router = useRouter();
  const { currentUser, setActiveProjectId } = useWorkspace();
  const [pendingNavigation, setPendingNavigation] = useState("");
  const projectsQuery = useQuery({
    queryKey: projectsQueryKey,
    queryFn: fetchProjects,
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
  const data = projectsQuery.data ?? null;
  const error =
    projectsQuery.error instanceof Error
      ? projectsQuery.error.message
      : projectsQuery.isError
        ? "Chargement portefeuille impossible."
        : "";

  if (!data && projectsQuery.isPending) {
    return (
      <div className="space-y-6">
        <SectionHeading eyebrow="Portfolio" title="Chargement des projets" />
        <LoadingStateCard
          title="Le portefeuille se charge"
          detail="Les projets visibles pour votre role et votre perimetre sont en cours de synchronisation."
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <SectionHeading eyebrow="Portfolio" title="Le portefeuille n'est pas disponible" />
        <InlineNotice tone="danger" title="Impossible de charger le portefeuille">
          {error}
        </InlineNotice>
      </div>
    );
  }

  function openProject(projectId: string) {
    setPendingNavigation(`project:${projectId}`);
    setActiveProjectId(projectId);
    router.push("/");
  }

  function openProjectAdmin(projectId: string) {
    setPendingNavigation(`admin:${projectId}`);
    router.push(`/admin?project=${projectId}`);
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Portfolio"
        title="Un portefeuille clair des projets actifs"
        action={
          <div className="flex gap-2">
            {currentUser.role === "Super Admin" ? (
              <button
                onClick={() => router.push("/admin")}
                className="rounded-2xl bg-sky-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-300"
              >
                Creer un projet
              </button>
            ) : null}
          </div>
        }
      />

      {projectsQuery.isFetching ? (
        <InlineNotice tone="neutral" title="Rafraichissement en cours">
          Les projets et leurs indicateurs se mettent a jour sans bloquer la navigation.
        </InlineNotice>
      ) : null}

      {data.projects.length === 0 ? (
        <EmptyStateCard
          title="Aucun projet accessible"
          detail="Ce role n'a encore aucun projet visible. L'administration peut affecter un perimetre projet pour debloquer l'exploitation."
        />
      ) : (
      <div className="grid gap-4 lg:grid-cols-3">
        {data.projects.map((project, index) => {
          const Icon = healthIcons[index] ?? ClipboardList;
          const summary = project.summary;
          const tone = getProjectTone(summary.status);
          const isOpeningProject = pendingNavigation === `project:${summary.id}`;
          const isOpeningAdmin = pendingNavigation === `admin:${summary.id}`;

          return (
            <Panel key={summary.id} className="overflow-hidden">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge tone={tone}>{summary.status}</StatusBadge>
                    <StatusBadge tone="primary">{summary.code}</StatusBadge>
                  </div>
                  <h2 className="font-display mt-4 text-2xl font-semibold text-white">
                    {summary.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-300">{summary.location}</p>
                </div>
                <div className="flex size-12 items-center justify-center rounded-2xl bg-white/5 text-slate-200">
                  <Icon className="size-5" />
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-slate-500">
                    <span>Progression</span>
                    <span>{summary.progress}%</span>
                  </div>
                  <ProgressBar value={summary.progress} tone={tone} />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[20px] border border-white/8 bg-white/4 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Budget</p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {formatTND(summary.budgetTnd)}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-white/8 bg-white/4 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                      Prochain jalon
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {summary.nextMilestone}
                    </p>
                  </div>
                </div>

                <div className="rounded-[20px] border border-white/8 bg-white/4 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                      Equipe projet
                    </p>
                    <span className="inline-flex items-center gap-2 text-sm text-white">
                      <Users className="size-4 text-slate-400" />
                      {project.memberCount} membre(s)
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {project.workflowOwners.length ? (
                      project.workflowOwners.map((owner) => (
                        <span
                          key={`${summary.id}-${owner.label}-${owner.id}`}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                        >
                          {owner.label} : {owner.name}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
                        Responsables a affecter
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => openProject(summary.id)}
                    disabled={pendingNavigation.length > 0}
                    title={
                      isOpeningProject
                        ? "Ouverture du projet en cours."
                        : "Basculer vers ce projet et ouvrir son tableau de bord."
                    }
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isOpeningProject ? "Ouverture..." : "Ouvrir le projet"}
                    <ArrowUpRight className="size-4" />
                  </button>

                  {currentUser.role === "Super Admin" ? (
                    <button
                      type="button"
                      onClick={() => openProjectAdmin(summary.id)}
                      disabled={pendingNavigation.length > 0}
                      title={
                        isOpeningAdmin
                          ? "Ouverture de la configuration en cours."
                          : "Ouvrir ce projet directement dans l'administration."
                      }
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Settings2 className="size-4" />
                      {isOpeningAdmin ? "Chargement..." : "Gerer l&apos;equipe"}
                    </button>
                  ) : null}
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
      )}
    </div>
  );
}
