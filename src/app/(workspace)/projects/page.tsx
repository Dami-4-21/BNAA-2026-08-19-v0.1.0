"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Building2, ClipboardList, Landmark, Layers3 } from "lucide-react";

import { Panel, ProgressBar, SectionHeading, StatusBadge } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import { apiFetch } from "@/lib/api";
import type { ProjectsPageData } from "@/lib/backend/types";

const healthIcons = [Building2, Landmark, Layers3];

export default function ProjectsPage() {
  const [data, setData] = useState<ProjectsPageData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      const payload = await apiFetch<ProjectsPageData>("/api/projects", { method: "GET" });
      if (!cancelled) {
        setData(payload);
      }
    }

    void loadProjects();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Portfolio"
        title="Un portefeuille clair des projets actifs"
        action={
          <div className="flex gap-2">
            <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/8">
              Nouveau projet
            </button>
            <button className="rounded-2xl bg-sky-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-300">
              Importer un pilote
            </button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {(data?.projects ?? []).map((project, index) => {
          const Icon = healthIcons[index] ?? ClipboardList;

          return (
            <Panel key={project.code} className="overflow-hidden">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge tone={project.tone}>{project.health}</StatusBadge>
                    <StatusBadge tone="primary">{project.code}</StatusBadge>
                  </div>
                  <h2 className="font-display mt-4 text-2xl font-semibold text-white">
                    {project.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-300">{project.location}</p>
                </div>
                <div className="flex size-12 items-center justify-center rounded-2xl bg-white/5 text-slate-200">
                  <Icon className="size-5" />
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-slate-500">
                    <span>Progression</span>
                    <span>{project.progress}%</span>
                  </div>
                  <ProgressBar value={project.progress} tone={project.tone} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[20px] border border-white/8 bg-white/4 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                      Budget
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {formatCurrency(project.budget)}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-white/8 bg-white/4 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                      Prochain jalon
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {project.nextMilestone}
                    </p>
                  </div>
                </div>
                <button className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/8">
                  Ouvrir le projet
                  <ArrowUpRight className="size-4" />
                </button>
              </div>
            </Panel>
          );
        })}
      </div>

    </div>
  );
}
