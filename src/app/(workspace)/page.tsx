"use client";

import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BellDot,
  CircleDollarSign,
  FileCheck2,
  FolderClock,
  ReceiptText,
  ShieldAlert,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  AvatarStack,
  MetricCard,
  Panel,
  ProgressBar,
  SectionHeading,
  StatusBadge,
  type Tone,
} from "@/components/ui";
import { useWorkspace } from "@/components/workspace-context";
import { formatCurrency, formatDate } from "@/lib/format";
import { apiFetch } from "@/lib/api";
import type { DashboardPageData } from "@/lib/backend/types";

const metricIcons = [Activity, FileCheck2, CircleDollarSign, ShieldAlert];

export default function DashboardPage() {
  const { activeProject, availableProjects, can, currentUser, tenant } = useWorkspace();
  const [data, setData] = useState<DashboardPageData | null>(null);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async (options?: { preserveData?: boolean }) => {
    try {
      setError("");
      if (!options?.preserveData) {
        setData(null);
      }
      const payload = await apiFetch<DashboardPageData>(
        `/api/projects/${activeProject.id}/dashboard`,
        { method: "GET" },
      );
      setData(payload);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Erreur tableau de bord.");
      if (!options?.preserveData) {
        setData(null);
      }
    }
  }, [activeProject.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  useEffect(() => {
    function refreshOnForeground() {
      if (document.visibilityState === "hidden") {
        return;
      }

      void loadDashboard({ preserveData: true });
    }

    window.addEventListener("focus", refreshOnForeground);
    document.addEventListener("visibilitychange", refreshOnForeground);

    return () => {
      window.removeEventListener("focus", refreshOnForeground);
      document.removeEventListener("visibilitychange", refreshOnForeground);
    };
  }, [loadDashboard]);

  if (!data && !error) {
    return (
      <div className="space-y-6">
        <SectionHeading
          eyebrow="Vue d'ensemble"
          title="Chargement du tableau de bord"
          action={<StatusBadge tone="neutral">Synchronisation</StatusBadge>}
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <SectionHeading
          eyebrow="Vue d'ensemble"
          title="Le tableau de bord n'est pas disponible"
          action={<StatusBadge tone="danger">Erreur</StatusBadge>}
        />
        <Panel>{error}</Panel>
      </div>
    );
  }

  const quickActions = [
    can("site.report.create")
      ? {
          href: "/site?tab=rjc",
          label: "Ouvrir le RJC",
          helper: "Renseigner ou mettre a jour le rapport du jour.",
          tone: data.hero.actionRequiredCount > 0 ? "warning" : "primary",
        }
      : null,
    can("documents.distribute") || can("documents.version.publish")
      ? {
          href: "/documents?tab=distribution",
          label: "Traiter la diffusion",
          helper: "Suivre les plans non lus et publier la revision attendue.",
          tone: "primary" as const,
        }
      : null,
    can("finance.invoice.create") || can("finance.invoice.validate")
      ? {
          href: "/finance?tab=invoices",
          label: "Verifier la facturation",
          helper: "Reprendre les validations client et les encaissements a debloquer.",
          tone: data.hero.invoicesDue > 0 ? "warning" : "success",
        }
      : null,
  ].filter(Boolean) as Array<{
    href: string;
    label: string;
    helper: string;
    tone: "primary" | "success" | "warning" | "danger";
  }>;

  const nextActions: Array<{ label: string; detail: string; tone: Tone }> = [
    {
      label: "Rapports terrain",
      detail: `${data.siteReports.length} rapport(s) disponible(s) sur ${activeProject.code}.`,
      tone: data.siteReports[0]?.tone ?? "primary",
    },
    {
      label: "Documents a lire",
      detail: `${data.distributionQueue.length} diffusion(s) en suivi sur la GED projet.`,
      tone: data.distributionQueue.length > 0 ? "warning" : "success",
    },
    {
      label: "Factures en attente",
      detail: `${data.hero.invoicesDue} validation(s) ou encaissement(s) a suivre aujourd'hui.`,
      tone: data.hero.invoicesDue > 0 ? "warning" : "success",
    },
  ];
  const actionChecklist = [
    latestSiteAction(data),
    documentAction(data),
    financeAction(data),
  ];
  const actionCounts = {
    approvals: data.siteReports.filter((report) => report.pdfReady && !report.signedByMoe).length,
    unreadDocs: data.distributionQueue.filter((item) => item.acknowledgedRate < 100).length,
    overdueInvoices: data.invoices.filter((invoice) => invoice.tone === "warning" || invoice.tone === "danger").length,
  };

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Vue d'ensemble"
        title="Operations fluides du terrain jusqu'a l'encaissement"
        action={
          <StatusBadge tone={data.hero.actionRequiredCount > 0 ? "warning" : "success"}>
            {data.hero.actionRequiredCount > 0
              ? `${data.hero.actionRequiredCount} action(s) en attente`
              : "Cycle projet fluide"}
          </StatusBadge>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Actions du jour" description="Les 3 points les plus utiles pour avancer sans naviguer a l'aveugle.">
          <div className="grid gap-3 md:grid-cols-3">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="rounded-[22px] border border-stone-200 bg-stone-50 p-4 transition-colors hover:bg-white"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-stone-950">{action.label}</p>
                  <StatusBadge tone={action.tone}>Ouvrir</StatusBadge>
                </div>
                <p className="mt-3 text-sm leading-6 text-stone-600">{action.helper}</p>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="Lecture rapide" description="Resume operationnel pour savoir ou reprendre tout de suite.">
          <div className="space-y-3">
            {nextActions.map((item) => (
              <div key={item.label} className="rounded-[22px] border border-stone-200 bg-stone-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-stone-950">{item.label}</p>
                  <StatusBadge tone={item.tone}>{item.tone === "warning" ? "Attention" : "OK"}</StatusBadge>
                </div>
                <p className="mt-2 text-sm leading-6 text-stone-600">{item.detail}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Checklist du jour" description="Les blocages concrets a traiter maintenant, avec un point d'entree direct par flux.">
          <div className="space-y-3">
            {actionChecklist.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex flex-col gap-3 rounded-[22px] border border-stone-200 bg-stone-50 p-4 transition-colors hover:bg-white md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl border border-stone-200 bg-white p-3 text-stone-700">
                    <item.icon className="size-4" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-stone-950">{item.label}</p>
                      <StatusBadge tone={item.tone}>{item.badge}</StatusBadge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-stone-600">{item.detail}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-stone-500">Ouvrir</span>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="Priorites de pilotage" description="Lecture ultra rapide pour savoir si le projet est en rythme ou s'il faut intervenir.">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Validations</p>
              <p className="mt-3 font-display text-3xl font-semibold text-stone-950">{actionCounts.approvals}</p>
              <p className="mt-2 text-sm leading-6 text-stone-600">RJC prets a faire signer cote projet.</p>
            </div>
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Plans non lus</p>
              <p className="mt-3 font-display text-3xl font-semibold text-stone-950">{actionCounts.unreadDocs}</p>
              <p className="mt-2 text-sm leading-6 text-stone-600">Diffusions qui demandent encore un accuse de lecture.</p>
            </div>
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Finance</p>
              <p className="mt-3 font-display text-3xl font-semibold text-stone-950">{actionCounts.overdueInvoices}</p>
              <p className="mt-2 text-sm leading-6 text-stone-600">Factures a reprendre avant impact sur la tresorerie.</p>
            </div>
          </div>
        </Panel>
      </div>

      <Panel className="overflow-hidden">
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone="primary">{data.hero.projectStatus}</StatusBadge>
              <StatusBadge tone="warning">
                {data.hero.invoicesDue} validations client en attente
              </StatusBadge>
              <StatusBadge tone={data.hero.nextCheckpointTone}>
                {data.hero.nextCheckpointDate}
              </StatusBadge>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Budget projet
                </p>
                <p className="mt-3 font-display text-2xl font-semibold text-white">
                  {formatCurrency(data.hero.budgetTnd)}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Depense a ce jour: {formatCurrency(data.hero.spentTnd)}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Prochaine echeance
                </p>
                <p className="mt-3 font-display text-2xl font-semibold text-white">
                  {data.hero.nextCheckpointDate}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  {data.hero.nextCheckpointDetail}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Focus du moment
                </p>
                <p className="mt-3 font-display text-2xl font-semibold text-white">
                  {data.hero.focusLabel}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  {data.hero.focusDetail}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Prochain jalon
                </p>
                <p className="mt-3 font-display text-2xl font-semibold text-white">
                  {data.hero.nextMilestone}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Cap maintenu par le resume projet et les dernieres saisies terrain.
                </p>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Equipe mobilisee
                </p>
                <p className="mt-3 font-display text-2xl font-semibold text-white">
                  {data.hero.teamSize}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Membres avec acces actif sur {activeProject.code}.
                </p>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Mon perimetre
                </p>
                <p className="mt-3 font-display text-2xl font-semibold text-white">
                  {currentUser.role}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  {availableProjects.length} projet(s) accessibles sur {tenant.activeProjects} dans le tenant.
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
                  {data.hero.cadenceTitle}
                </h3>
              </div>
              <ArrowUpRight className="size-5 text-slate-400" />
            </div>

            <div className="mt-6 space-y-4">
              {data.hero.cadenceSteps.map((item) => (
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
        {data.dashboardMetrics.map((metric, index) => (
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
        >
          <div className="space-y-4">
            {data.siteReports.map((report) => (
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
          >
            <div className="space-y-4">
              <AvatarStack
                people={data.teamMembers.map((member) => ({
                  initials: member.initials,
                  name: member.name,
                  role: member.role,
                }))}
              />
              <div className="space-y-3">
                {data.teamMembers.slice(0, 4).map((member) => (
                  <div
                    key={`${member.name}-${member.role}`}
                    className="rounded-[22px] border border-white/8 bg-white/4 p-4"
                  >
                    <p className="text-sm font-semibold text-white">
                      {member.name} - {member.role}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{member.state}</p>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel
            title="Alertes prioritaires"
          >
            <div className="space-y-3">
              {data.alerts.length > 0 ? (
                data.alerts.map((alert) => (
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
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-white/10 bg-white/4 px-4 py-8 text-center text-sm text-slate-300">
                  Aucune alerte prioritaire sur ce projet pour le moment.
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel
          title="Controle documentaire"
          action={<StatusBadge tone="success">{data.documentVersions.length} plans suivis</StatusBadge>}
        >
          <div className="space-y-4">
            {data.documentVersions.map((document) => (
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
              {data.distributionQueue.map((item) => (
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
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {data.invoiceMetrics.map((metric) => (
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
            {data.invoices.map((invoice) => (
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

function latestSiteAction(data: DashboardPageData) {
  const reportAwaitingValidation = data.siteReports.find(
    (report) => report.pdfReady && !report.signedByMoe,
  );

  if (reportAwaitingValidation) {
    return {
      badge: "Validation",
      detail: `${reportAwaitingValidation.id} est pret et attend encore la validation projet.`,
      href: `/site?tab=overview&report=${reportAwaitingValidation.id}`,
      icon: BellDot,
      label: "Faire signer le RJC du jour",
      tone: "warning" as Tone,
    };
  }

  const latestDraft = data.siteReports.find((report) => !report.pdfReady);
  return {
    badge: latestDraft ? "A finaliser" : "OK",
    detail: latestDraft
      ? `${latestDraft.id} reste a completer et preparer avant archivage quotidien.`
      : "Le flux terrain est a jour et aucun rapport n'attend d'action.",
    href: latestDraft ? `/site?tab=overview&report=${latestDraft.id}` : "/site?tab=overview",
    icon: Activity,
    label: latestDraft ? "Finaliser le rapport journalier" : "Suivi terrain a jour",
    tone: latestDraft ? ("primary" as Tone) : ("success" as Tone),
  };
}

function documentAction(data: DashboardPageData) {
  const pendingDistribution = data.distributionQueue
    .filter((item) => item.acknowledgedRate < 100)
    .sort((left, right) => left.acknowledgedRate - right.acknowledgedRate)[0];

  return {
    badge: pendingDistribution ? `${pendingDistribution.acknowledgedRate}% lus` : "OK",
    detail: pendingDistribution
      ? `${pendingDistribution.file} doit encore etre lu par ${pendingDistribution.audience}.`
      : "La diffusion documentaire est stable sur ce projet.",
    href: "/documents?tab=distribution",
    icon: FolderClock,
    label: pendingDistribution ? "Relancer la diffusion plan" : "Diffusion documentaire a jour",
    tone: pendingDistribution ? ("warning" as Tone) : ("success" as Tone),
  };
}

function financeAction(data: DashboardPageData) {
  const sensitiveInvoice = data.invoices.find(
    (invoice) => invoice.tone === "warning" || invoice.tone === "danger",
  );

  return {
    badge: sensitiveInvoice ? sensitiveInvoice.status : "OK",
    detail: sensitiveInvoice
      ? `${sensitiveInvoice.number} est a reprendre avant impact sur l'encaissement.`
      : "Aucune facture sensible ne demande une reprise immediate.",
    href: "/finance?tab=invoices",
    icon: ReceiptText,
    label: sensitiveInvoice ? "Debloquer la facturation" : "Facturation sous controle",
    tone: sensitiveInvoice ? sensitiveInvoice.tone : ("success" as Tone),
  };
}
