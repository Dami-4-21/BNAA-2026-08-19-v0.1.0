"use client";

import {
  Activity,
  ArrowUpRight,
  CircleDollarSign,
  FileCheck2,
  ShieldAlert,
} from "lucide-react";

import {
  AvatarStack,
  MetricCard,
  Panel,
  ProgressBar,
  SectionHeading,
  StatusBadge,
} from "@/components/ui";
import {
  alerts,
  dashboardMetrics,
  distributionQueue,
  documentVersions,
  invoiceMetrics,
  invoices,
  siteReports,
  tenant,
  teamMembers,
} from "@/lib/mock-data";
import { useWorkspace } from "@/components/workspace-context";
import { formatCurrency, formatDate } from "@/lib/format";

const metricIcons = [Activity, FileCheck2, CircleDollarSign, ShieldAlert];

export default function DashboardPage() {
  const { activeProject, availableProjects, currentUser } = useWorkspace();

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Vue d'ensemble"
        title="Operations fluides du terrain jusqu'a l'encaissement"
        description="Le tableau de bord rassemble le terrain, les documents et la finance dans une vue unique pour une prise en main rapide sur desktop comme sur mobile."
        action={<StatusBadge tone="success">Plateforme active</StatusBadge>}
      />

      <Panel className="overflow-hidden">
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone="primary">{activeProject.status}</StatusBadge>
              <StatusBadge tone="warning">
                {activeProject.invoicesDue} validations client en attente
              </StatusBadge>
              <StatusBadge tone="success">
                Site reporting en direct
              </StatusBadge>
            </div>
            <div className="space-y-3">
              <h2 className="font-display max-w-3xl text-3xl font-semibold text-white md:text-4xl">
                Un cockpit concu pour que le chef de projet voie tout en moins de 30 secondes.
              </h2>
              <p className="max-w-2xl text-base leading-7 text-slate-300">
                La home priorise les actions utiles : rapport du jour, dernier plan en
                vigueur, encaissements critiques et alertes terrain. On evite les ecrans
                vides en ramenant le contexte directement sur la vue principale.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Budget projet
                </p>
                <p className="mt-3 font-display text-2xl font-semibold text-white">
                  {formatCurrency(activeProject.budgetTnd)}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Depense a ce jour: {formatCurrency(activeProject.spentTnd)}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Prochain jalon
                </p>
                <p className="mt-3 font-display text-2xl font-semibold text-white">
                  03/05
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  {activeProject.nextMilestone}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Vue prioritaire
                </p>
                <p className="mt-3 font-display text-2xl font-semibold text-white">
                  Terrain - Docs - Cash
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Terrain, documents et encaissements reunis dans le meme flux de travail.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Mon role
                </p>
                <p className="mt-3 font-display text-2xl font-semibold text-white">
                  {currentUser.role}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Navigation et projets filtres selon les permissions.
                </p>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Projets accessibles
                </p>
                <p className="mt-3 font-display text-2xl font-semibold text-white">
                  {availableProjects.length}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Sur {tenant.activeProjects} projets du tenant.
                </p>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Utilisateurs du tenant
                </p>
                <p className="mt-3 font-display text-2xl font-semibold text-white">
                  {tenant.users}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Vision utile pour l&apos;administration et le pilotage multi-equipes.
                </p>
              </div>
            </div>
          </div>

          <div className="glass-panel-soft rounded-[28px] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Cadence du jour
                </p>
                <h3 className="mt-2 font-display text-2xl font-semibold text-white">
                  07:42 - rapport terrain soumis
                </h3>
              </div>
              <ArrowUpRight className="size-5 text-slate-400" />
            </div>

            <div className="mt-6 space-y-4">
              {[
                {
                  step: "Rapport journalier",
                  detail: "Soumis avec 12 photos et 1 incident mineur.",
                  tone: "success" as const,
                },
                {
                  step: "Diffusion plan structure",
                  detail: "Rev.C lue par 15/18 destinataires.",
                  tone: "primary" as const,
                },
                {
                  step: "Validation facture",
                  detail: "Maitre d'ouvrage relance automatique dans 3 h.",
                  tone: "warning" as const,
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="rounded-[22px] border border-white/8 bg-white/4 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{item.step}</p>
                    <StatusBadge tone={item.tone}>Actif</StatusBadge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-4">
        {dashboardMetrics.map((metric, index) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            delta={metric.delta}
            helper={metric.helper}
            tone={metric.tone}
            icon={metricIcons[index]}
          />
        ))}
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1.2fr_0.8fr]">
        <Panel
          title="Rythme chantier"
          description="Les rapports recents sont presentes dans un format scannable pour limiter les clics. Chaque carte remonte la progression, la meteo et l'auteur."
        >
          <div className="space-y-4">
            {siteReports.map((report) => (
              <div
                key={report.date}
                className="rounded-[24px] border border-white/8 bg-white/4 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-xl font-semibold text-white">
                        {formatDate(report.date)}
                      </p>
                      <StatusBadge tone={report.tone}>{report.status}</StatusBadge>
                    </div>
                    <p className="mt-1 text-sm text-slate-300">{report.summary}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm text-slate-300">
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                        Meteo
                      </p>
                      <p className="mt-1 text-white">{report.weather}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                        Effectif
                      </p>
                      <p className="mt-1 text-white">{report.workforce}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                        Auteur
                      </p>
                      <p className="mt-1 text-white">{report.author}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.14em] text-slate-500">
                    <span>Avancement lot du jour</span>
                    <span>{report.progress}%</span>
                  </div>
                  <ProgressBar value={report.progress} tone={report.tone} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel
            title="Equipe projet"
            description="Les roles visibles ici servent aussi de reference pour la future gestion fine des permissions."
          >
            <AvatarStack
              people={teamMembers.map((member) => ({
                initials: member.initials,
                name: member.name,
                role: member.role,
              }))}
            />
          </Panel>

          <Panel
            title="Alertes prioritaires"
            description="Notifications courtes, ton direct, et contexte actionnable."
          >
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.title}
                  className="rounded-[22px] border border-white/8 bg-white/4 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{alert.title}</p>
                    <StatusBadge tone={alert.tone}>{alert.time}</StatusBadge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {alert.detail}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel
          title="Controle documentaire"
          description="Les revisions en vigueur et la progression de lecture sont au meme endroit pour limiter les erreurs de version sur chantier."
          action={<StatusBadge tone="success">24 plans courants</StatusBadge>}
        >
          <div className="space-y-4">
            {documentVersions.map((document) => (
              <div
                key={`${document.name}-${document.revision}`}
                className="rounded-[24px] border border-white/8 bg-white/4 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-xl font-semibold text-white">
                        {document.name}
                      </p>
                      <StatusBadge tone={document.tone}>{document.status}</StatusBadge>
                    </div>
                    <p className="mt-1 text-sm text-slate-300">
                      {document.discipline} - {document.revision} - publie par{" "}
                      {document.publishedBy}
                    </p>
                  </div>
                  <p className="text-sm text-slate-300">{document.acknowledged}</p>
                </div>
              </div>
            ))}

            <div className="grid gap-3 md:grid-cols-3">
              {distributionQueue.map((item) => (
                <div
                  key={item.file}
                  className="rounded-[22px] border border-white/8 bg-white/4 p-4"
                >
                  <p className="text-sm font-semibold text-white">{item.file}</p>
                  <p className="mt-1 text-sm text-slate-300">{item.audience}</p>
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.14em] text-slate-500">
                      <span>Lecture</span>
                      <span>{item.acknowledgedRate}%</span>
                    </div>
                    <ProgressBar value={item.acknowledgedRate} tone="primary" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel
          title="Point finance"
          description="La finance reste reliee au terrain : l'avancement saisi nourrit les decomptes et les relances restent visibles immediatement."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {invoiceMetrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-[22px] border border-white/8 bg-white/4 p-4"
              >
                <p className="text-sm text-slate-300">{metric.label}</p>
                <p className="mt-3 font-display text-2xl font-semibold text-white">
                  {formatCurrency(metric.value)}
                </p>
                <p className="mt-2 text-sm text-slate-400">{metric.helper}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            {invoices.slice(0, 3).map((invoice) => (
              <div
                key={invoice.number}
                className="rounded-[22px] border border-white/8 bg-white/4 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-lg font-semibold text-white">
                        {invoice.number}
                      </p>
                      <StatusBadge tone={invoice.tone}>{invoice.status}</StatusBadge>
                    </div>
                    <p className="mt-1 text-sm text-slate-300">{invoice.project}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-white">
                      {formatCurrency(invoice.amount)}
                    </p>
                    <p className="text-sm text-slate-400">
                      Echeance {formatDate(invoice.dueDate)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
