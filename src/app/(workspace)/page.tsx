"use client";

import Link from "next/link";
import {
  Activity,
  BellDot,
  Camera,
  CircleDollarSign,
  FileCheck2,
  FolderClock,
  ReceiptText,
  ShieldAlert,
  SquarePen,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Panel, ProgressBar, SectionHeading, StatusBadge, type Tone } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-context";
import { formatCurrency, formatDate } from "@/lib/format";
import { apiFetch } from "@/lib/api";
import type { UserRole } from "@/lib/auth";
import type { DashboardPageData } from "@/lib/backend/types";

type DashboardAction = {
  badge: string;
  detail: string;
  href: string;
  icon: LucideIcon;
  label: string;
  tone: Tone;
};

type DashboardStat = {
  helper: string;
  label: string;
  tone: Tone;
  value: string;
};

type DashboardListItem = {
  badge?: string;
  detail: string;
  href?: string;
  meta?: string;
  progress?: number;
  title: string;
  tone: Tone;
};

type DashboardModel = {
  checklist: DashboardAction[];
  checklistDescription: string;
  detailDescription: string;
  detailItems: DashboardListItem[];
  detailTitle: string;
  eyebrow: string;
  intro: string;
  quickActions: DashboardAction[];
  sideDescription: string;
  sideItems: DashboardListItem[];
  sideTitle: string;
  spotlight: DashboardStat[];
  statusLabel: string;
  statusTone: Tone;
  title: string;
};

export default function DashboardPage() {
  const { activeProject, availableProjects, currentUser, tenant } = useWorkspace();
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

  const model = buildDashboardModel({
    activeProjectCode: activeProject.code,
    availableProjectsCount: availableProjects.length,
    data,
    role: currentUser.role,
    tenantActiveProjects: tenant.activeProjects,
    tenantUsers: tenant.users,
  });

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow={model.eyebrow}
        title={model.title}
        action={<StatusBadge tone={model.statusTone}>{model.statusLabel}</StatusBadge>}
      />

      <p className="max-w-4xl text-sm leading-7 text-stone-600">{model.intro}</p>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel
          title="Mes actions prioritaires"
          description="Trois entrees claires pour avancer tout de suite sans chercher dans plusieurs ecrans."
        >
          <div className="grid gap-3 md:grid-cols-3">
            {model.quickActions.map((action) => (
              <ActionCard key={`${action.href}-${action.label}`} action={action} />
            ))}
          </div>
        </Panel>

        <Panel
          title="Lecture rapide"
          description="Les reperes utiles pour savoir si le projet est en rythme ou s'il faut intervenir."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {model.spotlight.map((item) => (
              <div key={item.label} className="rounded-[22px] border border-stone-200 bg-stone-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-stone-500">{item.label}</p>
                  <StatusBadge tone={item.tone}>{spotlightToneLabel(item.tone)}</StatusBadge>
                </div>
                <p className="mt-3 font-display text-3xl font-semibold text-stone-950">{item.value}</p>
                <p className="mt-2 text-sm leading-6 text-stone-600">{item.helper}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <Panel title="File d'action" description={model.checklistDescription}>
          <div className="space-y-3">
            {model.checklist.map((item) => (
              <ActionListItem key={`${item.href}-${item.label}`} action={item} />
            ))}
          </div>
        </Panel>

        <Panel title={model.sideTitle} description={model.sideDescription}>
          <div className="space-y-3">
            {model.sideItems.map((item) => (
              <DashboardItemCard key={`${item.title}-${item.meta ?? item.detail}`} item={item} />
            ))}
          </div>
        </Panel>
      </div>

      <Panel title={model.detailTitle} description={model.detailDescription}>
        <div className="grid gap-3 xl:grid-cols-2">
          {model.detailItems.map((item) => (
            <DashboardItemCard key={`${item.title}-${item.meta ?? item.detail}`} item={item} />
          ))}
        </div>
      </Panel>
    </div>
  );
}

function ActionCard({ action }: { action: DashboardAction }) {
  return (
    <Link
      href={action.href}
      className="rounded-[22px] border border-stone-200 bg-stone-50 p-4 transition-colors hover:bg-white"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-stone-200 bg-white p-3 text-stone-700">
            <action.icon className="size-4" />
          </div>
          <p className="text-sm font-semibold text-stone-950">{action.label}</p>
        </div>
        <StatusBadge tone={action.tone}>{action.badge}</StatusBadge>
      </div>
      <p className="mt-3 text-sm leading-6 text-stone-600">{action.detail}</p>
    </Link>
  );
}

function ActionListItem({ action }: { action: DashboardAction }) {
  return (
    <Link
      href={action.href}
      className="flex flex-col gap-3 rounded-[22px] border border-stone-200 bg-stone-50 p-4 transition-colors hover:bg-white md:flex-row md:items-center md:justify-between"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-3 text-stone-700">
          <action.icon className="size-4" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-stone-950">{action.label}</p>
            <StatusBadge tone={action.tone}>{action.badge}</StatusBadge>
          </div>
          <p className="mt-2 text-sm leading-6 text-stone-600">{action.detail}</p>
        </div>
      </div>
      <span className="text-sm font-semibold text-stone-500">Ouvrir</span>
    </Link>
  );
}

function DashboardItemCard({ item }: { item: DashboardListItem }) {
  const content = (
    <div className="rounded-[22px] border border-stone-200 bg-stone-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-stone-950">{item.title}</p>
            {item.badge ? <StatusBadge tone={item.tone}>{item.badge}</StatusBadge> : null}
          </div>
          <p className="mt-2 text-sm leading-6 text-stone-600">{item.detail}</p>
        </div>
      </div>
      {item.meta ? <p className="mt-3 text-xs uppercase tracking-[0.14em] text-stone-500">{item.meta}</p> : null}
      {typeof item.progress === "number" ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.14em] text-stone-500">
            <span>Avancement</span>
            <span>{item.progress}%</span>
          </div>
          <ProgressBar value={item.progress} tone={item.tone} />
        </div>
      ) : null}
    </div>
  );

  if (!item.href) {
    return content;
  }

  return (
    <Link href={item.href} className="transition-transform hover:-translate-y-0.5">
      {content}
    </Link>
  );
}

function spotlightToneLabel(tone: Tone) {
  switch (tone) {
    case "danger":
      return "Urgent";
    case "warning":
      return "Suivi";
    case "success":
      return "Stable";
    case "primary":
      return "Actif";
    default:
      return "Info";
  }
}

function buildDashboardModel({
  activeProjectCode,
  availableProjectsCount,
  data,
  role,
  tenantActiveProjects,
  tenantUsers,
}: {
  activeProjectCode: string;
  availableProjectsCount: number;
  data: DashboardPageData;
  role: UserRole;
  tenantActiveProjects: number;
  tenantUsers: number;
}): DashboardModel {
  const siteAction = latestSiteAction(data);
  const docsAction = documentAction(data);
  const billingAction = financeAction(data);
  const unreadDiffusions = data.distributionQueue.filter((item) => item.acknowledgedRate < 100).length;
  const projectApprovals = data.siteReports.filter((report) => report.pdfReady && !report.signedByMoe).length;
  const sensitiveInvoices = data.invoices.filter(
    (invoice) => invoice.tone === "warning" || invoice.tone === "danger",
  ).length;
  const draftReports = data.siteReports.filter((report) => !report.pdfReady).length;

  const photosAction: DashboardAction = {
    badge: "Photos",
    detail: "Ajoutez les preuves du jour pour garder le journal terrain complet et exploitable.",
    href: "/site?tab=photos",
    icon: Camera,
    label: "Completer le journal photo",
    tone: "primary",
  };

  const ncrAction: DashboardAction = {
    badge: data.alerts.length > 0 ? `${data.alerts.length} alerte(s)` : "Stable",
    detail:
      data.alerts.length > 0
        ? "Reprenez les ecarts ouverts avant qu'ils ne bloquent la validation du chantier."
        : "Aucune alerte critique n'est remontee sur ce chantier pour le moment.",
    href: "/site?tab=ncr",
    icon: ShieldAlert,
    label: "Suivre les non-conformites",
    tone: data.alerts.length > 0 ? "warning" : "success",
  };

  const versionsAction: DashboardAction = {
    badge: `${data.documentVersions.length} plan(s)`,
    detail: "Publiez la revision utile et gardez une seule version de reference pour le terrain.",
    href: "/documents?tab=versions",
    icon: FileCheck2,
    label: "Publier une revision",
    tone: "primary",
  };

  const distributionAction: DashboardAction = {
    badge: unreadDiffusions > 0 ? `${unreadDiffusions} a relancer` : "A jour",
    detail:
      unreadDiffusions > 0
        ? "Certaines diffusions attendent encore une lecture ou un accuse de reception."
        : "Toutes les diffusions recentes sont lues ou accusees.",
    href: "/documents?tab=distribution",
    icon: FolderClock,
    label: "Suivre les lectures",
    tone: unreadDiffusions > 0 ? "warning" : "success",
  };

  const newInvoiceAction: DashboardAction = {
    badge: "Decompte",
    detail: "Lancez la preparation du decompte mensuel puis la facture sans ressaisie inutile.",
    href: "/finance?tab=dm",
    icon: CircleDollarSign,
    label: "Nouveau decompte",
    tone: "primary",
  };

  const paymentsAction: DashboardAction = {
    badge: sensitiveInvoices > 0 ? `${sensitiveInvoices} a suivre` : "Encaissements",
    detail:
      sensitiveInvoices > 0
        ? "Des factures doivent etre reprises ou encaissees avant tension de tresorerie."
        : "Enregistrez les paiements recus et gardez la tresorerie a jour.",
    href: "/finance?tab=cashflow",
    icon: ReceiptText,
    label: "Suivre les paiements",
    tone: sensitiveInvoices > 0 ? "warning" : "success",
  };

  const validationsAction: DashboardAction = {
    badge: projectApprovals > 0 ? `${projectApprovals} a signer` : "Valider",
    detail:
      projectApprovals > 0
        ? "Des rapports ou factures attendent encore votre validation pour avancer."
        : "Les validations principales du projet sont a jour pour le moment.",
    href: "/notifications?view=validations",
    icon: BellDot,
    label: "Traiter les validations",
    tone: projectApprovals > 0 || sensitiveInvoices > 0 ? "warning" : "success",
  };

  const alertsAction: DashboardAction = {
    badge: data.alerts.length > 0 ? `${data.alerts.length} alerte(s)` : "Calme",
    detail:
      data.alerts.length > 0
        ? "Reprenez les alertes projet sans attendre pour eviter les blocages cote terrain ou finance."
        : "Aucune alerte prioritaire n'est ouverte sur ce projet.",
    href: "/notifications?view=alerts",
    icon: ShieldAlert,
    label: "Traiter les alertes",
    tone: data.alerts.length > 0 ? "warning" : "success",
  };

  switch (role) {
    case "Conductrice travaux":
      return {
        checklist: [siteAction, photosAction, ncrAction],
        checklistDescription:
          "Le plus utile pour une conductrice: finaliser le rapport, garder le journal photo complet et lever les ecarts chantier.",
        detailDescription:
          "Les derniers rapports restent visibles ici pour reprendre vite le bon jour, le bon lot et le bon niveau d'avancement.",
        detailItems: buildSiteReportItems(data),
        detailTitle: "Rapports recents",
        eyebrow: "Vue terrain",
        intro:
          "Cette page doit rester simple: un rapport a finaliser, des photos a ajouter, des ecarts a traiter. Tout le reste passe au second plan.",
        quickActions: [siteAction, photosAction, ncrAction],
        sideDescription:
          "Les alertes chantier meritent une lecture rapide avant de repartir sur le terrain ou de cloturer la journee.",
        sideItems: buildAlertItems(data),
        sideTitle: "Alertes chantier",
        spotlight: [
          {
            helper:
              draftReports > 0
                ? `${draftReports} rapport(s) restent a completer avant validation.`
                : "Le rapport du jour est a niveau ou pret pour la suite.",
            label: "RJC",
            tone: draftReports > 0 ? "warning" : "success",
            value: draftReports > 0 ? `${draftReports}` : "OK",
          },
          {
            helper:
              projectApprovals > 0
                ? `${projectApprovals} rapport(s) attendent encore une validation projet.`
                : "Aucune validation projet ne bloque le cycle terrain.",
            label: "Validations",
            tone: projectApprovals > 0 ? "warning" : "success",
            value: projectApprovals > 0 ? `${projectApprovals}` : "0",
          },
          {
            helper: `Projet actif ${activeProjectCode}. Vous restez concentree sur un seul chantier a la fois.`,
            label: "Projet",
            tone: "primary",
            value: activeProjectCode,
          },
        ],
        statusLabel:
          draftReports > 0 || data.alerts.length > 0
            ? `${draftReports + data.alerts.length} sujet(s) terrain a suivre`
            : "Terrain sous controle",
        statusTone: draftReports > 0 || data.alerts.length > 0 ? "warning" : "success",
        title: "Priorites terrain du jour",
      };

    case "Bureau d'etudes":
      return {
        checklist: [versionsAction, docsAction, distributionAction],
        checklistDescription:
          "Le bureau d'etudes doit surtout garder la bonne revision en circulation et confirmer que les bons destinataires l'ont bien recue.",
        detailDescription:
          "Les plans suivis et les revisions recentes restent regroupes ici pour limiter les allers-retours inutiles dans la GED.",
        detailItems: buildDocumentVersionItems(data),
        detailTitle: "Versions sous controle",
        eyebrow: "Controle documentaire",
        intro:
          "Votre priorite est simple: publier la bonne revision, diffuser vite et ne laisser aucun doute sur la version en vigueur.",
        quickActions: [versionsAction, docsAction, distributionAction],
        sideDescription:
          "La diffusion controlee doit permettre de savoir tout de suite qui a lu, qui manque encore et quel plan doit etre relance.",
        sideItems: buildDistributionItems(data),
        sideTitle: "Diffusions a suivre",
        spotlight: [
          {
            helper: "Plans actuellement suivis et exposes dans la bibliotheque active du projet.",
            label: "Plans suivis",
            tone: "primary",
            value: `${data.documentVersions.length}`,
          },
          {
            helper:
              unreadDiffusions > 0
                ? `${unreadDiffusions} diffusion(s) demandent encore une lecture.`
                : "Toutes les diffusions recentes sont accusees ou lues.",
            label: "Lectures en attente",
            tone: unreadDiffusions > 0 ? "warning" : "success",
            value: `${unreadDiffusions}`,
          },
          {
            helper:
              data.documentVersions[0]
                ? `${data.documentVersions[0].name} est la revision la plus recente suivie sur le projet.`
                : "Aucune revision n'est encore publiee sur ce projet.",
            label: "Derniere revision",
            tone: data.documentVersions[0] ? data.documentVersions[0].tone : "neutral",
            value: data.documentVersions[0]?.revision ?? "-",
          },
        ],
        statusLabel: unreadDiffusions > 0 ? `${unreadDiffusions} diffusion(s) a relancer` : "GED a jour",
        statusTone: unreadDiffusions > 0 ? "warning" : "success",
        title: "Pilotage documentaire du projet",
      };

    case "Comptable":
      return {
        checklist: [newInvoiceAction, billingAction, paymentsAction],
        checklistDescription:
          "Le parcours comptable doit rester lineaire: preparer, envoyer, faire valider puis enregistrer le reglement sans ambiguite.",
        detailDescription:
          "Les factures ouvertes restent ici avec leur statut et leur echeance pour reprendre rapidement le bon dossier.",
        detailItems: buildInvoiceItems(data),
        detailTitle: "Factures a suivre",
        eyebrow: "Pilotage finance",
        intro:
          "Cette vue doit aider la comptabilite a travailler en sequence: decompte, facture, validation, encaissement. Pas besoin de parcourir toute l'application.",
        quickActions: [newInvoiceAction, billingAction, paymentsAction],
        sideDescription:
          "Trois repers simples pour savoir si la facturation du projet avance, se bloque ou commence a peser sur la tresorerie.",
        sideItems: buildInvoiceMetricItems(data),
        sideTitle: "Repers de tresorerie",
        spotlight: [
          {
            helper:
              data.hero.invoicesDue > 0
                ? `${data.hero.invoicesDue} etape(s) de validation ou d'encaissement sont encore ouvertes.`
                : "Aucune validation ou relance immediate ne bloque la facturation.",
            label: "Actions finance",
            tone: data.hero.invoicesDue > 0 ? "warning" : "success",
            value: `${data.hero.invoicesDue}`,
          },
          {
            helper:
              data.invoices[0]
                ? `Derniere facture suivie: ${data.invoices[0].number}.`
                : "Aucune facture n'est encore ouverte sur ce projet.",
            label: "Derniere facture",
            tone: data.invoices[0]?.tone ?? "neutral",
            value: data.invoices[0]?.number ?? "-",
          },
          {
            helper: "Montant facture sur la ligne la plus recente du projet.",
            label: "Montant recent",
            tone: "primary",
            value: data.invoices[0] ? formatCurrency(data.invoices[0].amount) : formatCurrency(0),
          },
        ],
        statusLabel:
          sensitiveInvoices > 0
            ? `${sensitiveInvoices} facture(s) sensible(s)`
            : "Facturation sous controle",
        statusTone: sensitiveInvoices > 0 ? "warning" : "success",
        title: "Facturation et encaissement",
      };

    case "Chef de projet":
    case "Maitre d'ouvrage":
      return {
        checklist: [validationsAction, siteAction, docsAction, billingAction].slice(0, 3),
        checklistDescription:
          "Vous devez surtout savoir quoi valider, quoi relancer et ce qui peut ralentir le projet aujourd'hui.",
        detailDescription:
          "Les alertes et les validations ouvertes restent visibles ici pour piloter sans entrer dans tous les modules un par un.",
        detailItems: buildAlertItems(data),
        detailTitle: "Alertes et points de blocage",
        eyebrow: "Pilotage projet",
        intro:
          "Le tableau de bord devient une file d'action: validations a traiter, documents a relancer, factures a debloquer et alertes a contenir.",
        quickActions: [validationsAction, siteAction, docsAction],
        sideDescription:
          "La mobilisaton projet reste lisible en un coup d'oeil, avec les principaux roles et leur situation actuelle.",
        sideItems: buildTeamItems(data),
        sideTitle: "Equipe mobilisee",
        spotlight: [
          {
            helper:
              projectApprovals > 0
                ? `${projectApprovals} rapport(s) chantier attendent encore une validation.`
                : "Aucune validation chantier n'est en retard.",
            label: "Validations RJC",
            tone: projectApprovals > 0 ? "warning" : "success",
            value: `${projectApprovals}`,
          },
          {
            helper:
              unreadDiffusions > 0
                ? `${unreadDiffusions} diffusion(s) documentaires doivent encore etre relancees.`
                : "Les plans critiques sont bien relayes dans l'equipe projet.",
            label: "Plans non lus",
            tone: unreadDiffusions > 0 ? "warning" : "success",
            value: `${unreadDiffusions}`,
          },
          {
            helper:
              sensitiveInvoices > 0
                ? `${sensitiveInvoices} facture(s) menacent la cadence d'encaissement.`
                : "La chaine facture -> paiement reste stable sur le projet.",
            label: "Finance",
            tone: sensitiveInvoices > 0 ? "warning" : "success",
            value: `${sensitiveInvoices}`,
          },
        ],
        statusLabel:
          data.hero.actionRequiredCount > 0
            ? `${data.hero.actionRequiredCount} action(s) de pilotage`
            : "Projet sous controle",
        statusTone: data.hero.actionRequiredCount > 0 ? "warning" : "success",
        title: "Validations et alertes du projet",
      };

    case "Super Admin":
    default:
      return {
        checklist: [
          {
            badge: `${availableProjectsCount} projet(s)`,
            detail: "Verifier le portefeuille actif et le niveau de preparation de chaque projet.",
            href: "/projects",
            icon: SquarePen,
            label: "Reprendre les projets",
            tone: "primary",
          },
          {
            badge: `${tenantUsers} utilisateurs`,
            detail: "Ajuster les acces, les roles et les affectations projet sans ouvrir plusieurs ecrans.",
            href: "/admin",
            icon: Users,
            label: "Gerer les acces",
            tone: "primary",
          },
          alertsAction,
        ],
        checklistDescription:
          "Le super admin a surtout besoin d'un point d'entree rapide vers le portefeuille, les acces et les alertes globales.",
        detailDescription:
          "Les membres les plus exposes restent visibles pour verifier rapidement l'organisation active du projet selectionne.",
        detailItems: buildTeamItems(data),
        detailTitle: "Equipe active",
        eyebrow: "Pilotage admin",
        intro:
          "Cette vue sert a reprendre vite l'organisation: acces, projets, equipe et alertes. Le detail operationnel reste dans chaque module specialise.",
        quickActions: [
          {
            badge: `${tenantActiveProjects} projet(s)`,
            detail: "Accedez au portefeuille et reprenez tout de suite le bon projet ou la bonne equipe.",
            href: "/projects",
            icon: SquarePen,
            label: "Ouvrir le portefeuille",
            tone: "primary",
          },
          {
            badge: `${tenantUsers} utilisateurs`,
            detail: "Configurez les roles, les acces et les responsables de workflow depuis l'admin.",
            href: "/admin",
            icon: Users,
            label: "Gerer les utilisateurs",
            tone: "primary",
          },
          alertsAction,
        ],
        sideDescription:
          "Les alertes recentes donnent une lecture rapide de ce qui merite un suivi transversal sur le tenant.",
        sideItems: buildAlertItems(data),
        sideTitle: "Alertes recentes",
        spotlight: [
          {
            helper: "Nombre de projets actuellement accessibles dans votre perimetre admin.",
            label: "Projets visibles",
            tone: "primary",
            value: `${availableProjectsCount}`,
          },
          {
            helper: "Volume utilisateur actif sur le tenant pour piloter les acces et les responsabilites.",
            label: "Utilisateurs",
            tone: "primary",
            value: `${tenantUsers}`,
          },
          {
            helper:
              data.hero.actionRequiredCount > 0
                ? "Des signaux demandent encore une reprise transversale."
                : "Aucun point chaud n'est remonte a l'instant.",
            label: "Actions ouvertes",
            tone: data.hero.actionRequiredCount > 0 ? "warning" : "success",
            value: `${data.hero.actionRequiredCount}`,
          },
        ],
        statusLabel:
          data.hero.actionRequiredCount > 0
            ? `${data.hero.actionRequiredCount} action(s) transverses`
            : "Tenant stable",
        statusTone: data.hero.actionRequiredCount > 0 ? "warning" : "success",
        title: "Portefeuille et gouvernance",
      };
  }
}

function buildSiteReportItems(data: DashboardPageData): DashboardListItem[] {
  return data.siteReports.map((report) => ({
    badge: report.status,
    detail: report.summary,
    href: `/site?tab=overview&report=${report.id}`,
    meta: `${report.weather} - ${report.workforce} pers. - ${report.author}`,
    progress: report.progress,
    title: formatDate(report.date),
    tone: report.tone,
  }));
}

function buildDocumentVersionItems(data: DashboardPageData): DashboardListItem[] {
  if (data.documentVersions.length === 0) {
    return [
      {
        detail: "Publiez une premiere revision pour lancer la diffusion controlee sur ce projet.",
        href: "/documents?tab=versions",
        title: "Aucune revision publiee",
        tone: "neutral",
      },
    ];
  }

  return data.documentVersions.map((document) => ({
    badge: document.status,
    detail: `${document.discipline} - ${document.revision} - publie par ${document.publishedBy}.`,
    href: "/documents?tab=versions",
    meta: document.acknowledged,
    title: document.name,
    tone: document.tone,
  }));
}

function buildDistributionItems(data: DashboardPageData): DashboardListItem[] {
  if (data.distributionQueue.length === 0) {
    return [
      {
        detail: "Aucune diffusion recente ne demande d'accuse de lecture sur ce projet.",
        href: "/documents?tab=distribution",
        title: "Diffusion a jour",
        tone: "success",
      },
    ];
  }

  return data.distributionQueue.map((item) => ({
    badge: `${item.acknowledgedRate}% lus`,
    detail: `${item.file} - destinataires ${item.audience}.`,
    href: "/documents?tab=distribution",
    meta: `Relance ciblee avant ${formatDate(item.dueDate)}`,
    progress: item.acknowledgedRate,
    title: "Lecture des plans",
    tone: item.acknowledgedRate < 100 ? "warning" : "success",
  }));
}

function buildInvoiceItems(data: DashboardPageData): DashboardListItem[] {
  if (data.invoices.length === 0) {
    return [
      {
        detail: "Aucune facture n'est encore ouverte. Lancez un decompte pour initier la chaine finance.",
        href: "/finance?tab=dm",
        title: "Aucune facture en cours",
        tone: "neutral",
      },
    ];
  }

  return data.invoices.map((invoice) => ({
    badge: invoice.status,
    detail: `${invoice.project} - echeance ${formatDate(invoice.dueDate)}.`,
    href: "/finance?tab=invoices",
    meta: formatCurrency(invoice.amount),
    title: invoice.number,
    tone: invoice.tone,
  }));
}

function buildInvoiceMetricItems(data: DashboardPageData): DashboardListItem[] {
  return data.invoiceMetrics.map((metric) => ({
    badge: formatCurrency(metric.value),
    detail: metric.helper,
    href: "/finance?tab=cashflow",
    title: metric.label,
    tone: metric.tone,
  }));
}

function buildAlertItems(data: DashboardPageData): DashboardListItem[] {
  if (data.alerts.length === 0) {
    return [
      {
        detail: "Aucune alerte prioritaire n'est remontee sur ce projet pour le moment.",
        href: "/notifications?view=alerts",
        title: "Aucune alerte ouverte",
        tone: "success",
      },
    ];
  }

  return data.alerts.map((alert) => ({
    badge: alert.time,
    detail: alert.detail,
    href: "/notifications?view=alerts",
    title: alert.title,
    tone: alert.tone,
  }));
}

function buildTeamItems(data: DashboardPageData): DashboardListItem[] {
  return data.teamMembers.slice(0, 4).map((member) => ({
    badge: member.role,
    detail: member.state,
    href: "/projects",
    title: member.name,
    tone: "primary",
  }));
}

function latestSiteAction(data: DashboardPageData): DashboardAction {
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
      tone: "warning",
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
    tone: latestDraft ? "primary" : "success",
  };
}

function documentAction(data: DashboardPageData): DashboardAction {
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
    tone: pendingDistribution ? "warning" : "success",
  };
}

function financeAction(data: DashboardPageData): DashboardAction {
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
    tone: sensitiveInvoice ? sensitiveInvoice.tone : "success",
  };
}
