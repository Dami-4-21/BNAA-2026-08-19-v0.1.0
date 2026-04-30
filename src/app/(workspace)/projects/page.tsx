import { ArrowUpRight, Building2, ClipboardList, Landmark, Layers3 } from "lucide-react";

import { Panel, ProgressBar, SectionHeading, StatusBadge } from "@/components/ui";
import { projects } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/format";

const healthIcons = [Building2, Landmark, Layers3];

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Portfolio"
        title="Un portefeuille clair des projets actifs"
        description="Les cartes projet condensent sante, progression, budget et prochain jalon. Cette page sert de hub pour que la direction et les chefs de projet basculent rapidement vers le bon chantier."
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
        {projects.map((project, index) => {
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

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel
          title="Ce que la page doit permettre"
          description="Le design vise un arbitrage rapide entre priorites terrain, diffusion documentaire et cash. Chaque bloc repond a une question operationnelle concrete."
        >
          <div className="grid gap-3 md:grid-cols-3">
            {[
              {
                title: "Quel projet appelle une action immediate ?",
                text: "Les statuts de sante sont exposes sans ouvrir le detail.",
              },
              {
                title: "Ou en est le budget ?",
                text: "Le cout global reste visible des la carte projet.",
              },
              {
                title: "Quel jalon arrive ensuite ?",
                text: "Le prochain point dur est mis en avant pour rythmer les relances.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-[22px] border border-white/8 bg-white/4 p-4"
              >
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{item.text}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Pipeline d'onboarding MVP"
          description="Un nouveau client doit pouvoir comprendre la valeur en une semaine."
        >
          <div className="space-y-3">
            {[
              "Jour 1 - creation du tenant et import du projet pilote",
              "Jour 2 - activation des roles conducteur, BE, compta",
              "Jour 3 - diffusion du premier jeu de plans",
              "Jour 4 - premier RJC avec photos terrain",
              "Jour 5 - generation de la premiere facture PDF",
            ].map((step) => (
              <div
                key={step}
                className="rounded-[20px] border border-white/8 bg-white/4 px-4 py-3 text-sm text-slate-200"
              >
                {step}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
