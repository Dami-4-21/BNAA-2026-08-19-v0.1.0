"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgePercent,
  CheckCheck,
  ChevronRight,
  CircleDollarSign,
  FileBadge2,
  FileText,
  FolderKanban,
  Landmark,
  Receipt,
  Search,
  Send,
  Wallet,
  X,
} from "lucide-react";

import { useWorkspace } from "@/components/workspace-context";
import {
  EmptyStateCard,
  InlineNotice,
  LoadingStateCard,
  MetricCard,
  Panel,
  ProgressBar,
  SectionHeading,
  StatusBadge,
  cx,
  type Tone,
} from "@/components/ui";
import { apiFetch } from "@/lib/api";
import type { FinanceModuleData as FinancePayload } from "@/lib/backend/types";
import { formatCompact, formatCurrency, formatDate, timeAgo } from "@/lib/format";
import { financeVatRegimes } from "@/lib/mock-data";

type FinanceTab = "dm" | "invoices" | "vat" | "cashflow";
type FinanceTone = "primary" | "success" | "warning" | "danger";
type FinanceSectionId =
  | "overview"
  | "billing"
  | "collections"
  | "treasury"
  | "vat"
  | "profitability"
  | "documents"
  | "archives";
type QueueFilter =
  | "all"
  | "collectible"
  | "draft"
  | "sent"
  | "project-validation"
  | "client-validation"
  | "partial"
  | "overdue"
  | "disputed"
  | "paid";
type DrawerTab = "summary" | "workflow" | "payments" | "documents";

type InvoiceItem = {
  id: string;
  projectId: string;
  invoiceNumber: string;
  project: string;
  periodMonth: string;
  amountHt: number;
  tvaRate: number;
  tvaAmount: number;
  amountTtc: number;
  dueDate: string;
  paidAt: string;
  status: string;
  tone: FinanceTone;
  retentionAmount: number;
  advanceDeduction: number;
  sourceProgress: number;
  validatedByMoe: boolean;
  validatedByMo: boolean;
  moValidatedAt?: string;
  moValidatedBy?: string;
  moeValidatedAt?: string;
  moeValidatedBy?: string;
  pdfUrl?: string;
};

type PaymentItem = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  method: string;
  reference: string;
  paidAt: string;
};

type WorkflowOwnerDisplay = {
  clientApproverId?: {
    id: string;
    name: string;
    role: string;
  };
  financeLeadId?: {
    id: string;
    name: string;
    role: string;
  };
  projectManagerId?: {
    id: string;
    name: string;
    role: string;
  };
};

type FinanceWorkflowStep = {
  badge: string;
  detail: string;
  state: "blocked" | "current" | "done" | "pending";
  title: string;
  tone: Tone;
};

type QueueRecord = InvoiceItem & {
  coverage: number;
  displayStatus: string;
  isOverdue: boolean;
  isPartial: boolean;
  overdueDays: number;
  paidAmount: number;
  remainingAmount: number;
};

type DrawerAction = {
  canRun: boolean;
  helper: string;
  label: string;
};

type ActionCenterCard = {
  count: number;
  helper: string;
  id: string;
  label: string;
  section: FinanceSectionId;
  tone: Tone;
  filter?: QueueFilter;
};

type LinkedFinanceDocument = {
  actionLabel: string;
  description: string;
  id: string;
  kind: string;
  status: string;
  url?: string;
};

type FinanceHealthSummary = {
  overdueAmount: number;
  profitabilityRisk: string;
  profitabilityTrend: string;
  remainingToCollect: number;
  vatStatus: string;
};

type CollectionFocus = {
  amountLabel: string;
  filter: QueueFilter;
  helper: string;
  invoiceNumber: string;
  project: string;
  tone: Tone;
};

type ProofSummary = {
  dmStatus: string;
  invoicePdfStatus: string;
  paymentProofStatus: string;
  signedReportsStatus: string;
};

const allManualInvoiceStatuses = [
  "Brouillon",
  "Envoyee",
  "Validation MO",
  "Validee",
  "Payee",
  "Litigieuse",
] as const;

const queueFilters: Array<{ key: QueueFilter; label: string }> = [
  { key: "all", label: "Tous" },
  { key: "collectible", label: "A encaisser" },
  { key: "draft", label: "Brouillon" },
  { key: "sent", label: "Envoyee" },
  { key: "project-validation", label: "Validation projet" },
  { key: "client-validation", label: "Validation client" },
  { key: "partial", label: "Partiel" },
  { key: "overdue", label: "Retard" },
  { key: "disputed", label: "Litigieuse" },
];

const sectionJumpLinks: Array<{ id: FinanceSectionId; label: string }> = [
  { id: "billing", label: "Facturation" },
  { id: "treasury", label: "Tresorerie" },
  { id: "collections", label: "Encaissements" },
  { id: "vat", label: "TVA" },
  { id: "profitability", label: "Rentabilite" },
  { id: "documents", label: "Documents" },
  { id: "archives", label: "Archives" },
];

const metricIcons = [Wallet, Receipt, CircleDollarSign, BadgePercent, AlertTriangle];

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

function toMonthInputValue(value: string) {
  const monthYearMatch = value.match(/^(\d{2})\/(\d{4})$/);
  if (monthYearMatch) {
    const [, month, year] = monthYearMatch;
    return `${year}-${month}`;
  }

  const isoMatch = value.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}`;
  }

  return value;
}

function toneLabel(tone: Tone) {
  switch (tone) {
    case "danger":
      return "Urgent";
    case "warning":
      return "A suivre";
    case "success":
      return "Valide";
    case "primary":
      return "En cours";
    default:
      return "Info";
  }
}

function getNow() {
  return new Date();
}

function getInvoicePaidAmount(invoiceId: string, payments: PaymentItem[]) {
  return payments
    .filter((payment) => payment.invoiceId === invoiceId)
    .reduce((sum, payment) => sum + payment.amount, 0);
}

function getInvoiceCoverage(invoice: InvoiceItem, payments: PaymentItem[]) {
  const paidAmount =
    invoice.status === "Payee" ? invoice.amountTtc : getInvoicePaidAmount(invoice.id, payments);
  return Math.round((paidAmount / Math.max(invoice.amountTtc, 1)) * 100);
}

function getInvoiceRemainingAmount(invoice: InvoiceItem, payments: PaymentItem[]) {
  const paidAmount =
    invoice.status === "Payee" ? invoice.amountTtc : getInvoicePaidAmount(invoice.id, payments);
  return Math.max(invoice.amountTtc - paidAmount, 0);
}

function getInvoiceOverdueDays(invoice: InvoiceItem, remainingAmount: number, now: Date) {
  if (!remainingAmount) {
    return 0;
  }

  const dueDate = new Date(invoice.dueDate);
  if (Number.isNaN(dueDate.getTime())) {
    return 0;
  }

  const delta = now.getTime() - dueDate.getTime();
  if (delta <= 0) {
    return 0;
  }

  return Math.floor(delta / (1000 * 60 * 60 * 24));
}

function getInvoiceDisplayStatus(
  invoice: InvoiceItem,
  coverage: number,
  overdueDays: number,
) {
  if (invoice.status === "Litigieuse") {
    return "Litigieuse";
  }

  if (coverage >= 100 || invoice.status === "Payee") {
    return "Payee";
  }

  if (invoice.validatedByMo && overdueDays > 0) {
    return "En retard";
  }

  if (coverage > 0) {
    return "Partiel";
  }

  if (invoice.validatedByMo) {
    return "Validee";
  }

  if (invoice.validatedByMoe) {
    return "Validation client";
  }

  if (invoice.status === "Envoyee" || invoice.status === "Validation MO") {
    return "Validation projet";
  }

  return "Brouillon";
}

function getQueueStatusTone(status: string): Tone {
  switch (status) {
    case "Payee":
    case "Validee":
      return "success";
    case "En retard":
    case "Litigieuse":
      return "danger";
    case "Validation projet":
    case "Validation client":
    case "Partiel":
      return "warning";
    case "Envoyee":
      return "primary";
    default:
      return "neutral";
  }
}

function matchesQueueFilter(record: QueueRecord, filter: QueueFilter) {
  switch (filter) {
    case "collectible":
      return record.validatedByMo && record.remainingAmount > 0 && record.status !== "Payee";
    case "draft":
      return record.status === "Brouillon";
    case "sent":
      return record.status === "Envoyee";
    case "project-validation":
      return record.status !== "Brouillon" && !record.validatedByMoe;
    case "client-validation":
      return record.validatedByMoe && !record.validatedByMo;
    case "partial":
      return record.isPartial;
    case "overdue":
      return record.isOverdue;
    case "disputed":
      return record.status === "Litigieuse";
    case "paid":
      return record.displayStatus === "Payee";
    case "all":
    default:
      return true;
  }
}

function buildFinanceWorkflowSteps({
  invoice,
  paymentCoverage,
  projectApproverName,
  clientApproverName,
}: {
  invoice?: InvoiceItem;
  paymentCoverage: number;
  projectApproverName: string;
  clientApproverName: string;
}): FinanceWorkflowStep[] {
  if (!invoice) {
    return [
      {
        badge: "A lancer",
        detail: "Le decompte du mois doit etre prepare avant toute facture.",
        state: "current",
        title: "1. Preparer le decompte",
        tone: "primary",
      },
      {
        badge: "Attente",
        detail: "La facture sera envoyee une fois le decompte genere.",
        state: "pending",
        title: "2. Envoyer",
        tone: "neutral",
      },
      {
        badge: "Attente",
        detail: `La validation projet sera demandee a ${projectApproverName}.`,
        state: "pending",
        title: "3. Validation projet",
        tone: "neutral",
      },
      {
        badge: "Attente",
        detail: `La validation client sera ensuite demandee a ${clientApproverName}.`,
        state: "pending",
        title: "4. Validation client",
        tone: "neutral",
      },
      {
        badge: "Attente",
        detail: "Le paiement pourra etre saisi uniquement apres les validations.",
        state: "pending",
        title: "5. Paiement recu",
        tone: "neutral",
      },
    ];
  }

  const sent = invoice.status !== "Brouillon";
  const projectValidated = invoice.validatedByMoe;
  const clientValidated = invoice.validatedByMo;
  const paid = invoice.status === "Payee" || Boolean(invoice.paidAt) || paymentCoverage >= 100;

  return [
    {
      badge: "Pret",
      detail: `${invoice.invoiceNumber} a ete prepare depuis l'avancement du projet.`,
      state: "done",
      title: "1. Preparer le decompte",
      tone: "success",
    },
    {
      badge: sent ? "Envoyee" : "A envoyer",
      detail: sent
        ? "La facture est sortie du brouillon et le PDF peut etre partage ou regenere."
        : "Le PDF doit etre genere puis envoye pour lancer le circuit de validation.",
      state: sent ? "done" : "current",
      title: "2. Envoyer",
      tone: sent ? "success" : "primary",
    },
    {
      badge: projectValidated ? "Validee" : sent ? "A traiter" : "Bloquee",
      detail: projectValidated
        ? `Validation projet recue par ${invoice.moeValidatedBy ?? projectApproverName}.`
        : sent
          ? `En attente de la validation projet par ${projectApproverName}.`
          : "La validation projet se debloque seulement apres l'envoi de la facture.",
      state: projectValidated ? "done" : sent ? "current" : "blocked",
      title: "3. Validation projet",
      tone: projectValidated ? "success" : sent ? "warning" : "neutral",
    },
    {
      badge: clientValidated ? "Validee" : projectValidated ? "A traiter" : "Bloquee",
      detail: clientValidated
        ? `Validation client recue par ${invoice.moValidatedBy ?? clientApproverName}.`
        : projectValidated
          ? `En attente de la validation client par ${clientApproverName}.`
          : "La validation client s'ouvre une fois la validation projet terminee.",
      state: clientValidated ? "done" : projectValidated ? "current" : "blocked",
      title: "4. Validation client",
      tone: clientValidated ? "success" : projectValidated ? "warning" : "neutral",
    },
    {
      badge: paid ? "Recu" : clientValidated ? `${paymentCoverage}% couvert` : "Bloque",
      detail: paid
        ? "Le paiement est enregistre et la facture est cloturee."
        : clientValidated
          ? "Le paiement peut maintenant etre saisi ou complete jusqu'au reglement total."
          : "Le paiement reste indisponible tant que la validation client n'est pas terminee.",
      state: paid ? "done" : clientValidated ? "current" : "blocked",
      title: "5. Paiement recu",
      tone: paid ? "success" : clientValidated ? "primary" : "neutral",
    },
  ];
}

export function FinanceModule() {
  const {
    activeProject,
    availableProjects,
    can,
    currentUser,
    setActiveProjectId,
  } = useWorkspace();
  const [projectData, setProjectData] = useState<FinancePayload | null>(null);
  const [error, setError] = useState("");
  const canCreateInvoice = can("finance.invoice.create");
  const canSendInvoice = can("finance.invoice.send");
  const canValidateInvoice = can("finance.invoice.validate");
  const canRecordPayment = can("finance.payment.record");

  useEffect(() => {
    let cancelled = false;

    async function loadFinance() {
      try {
        setError("");
        setProjectData(null);
        const payload = await apiFetch<FinancePayload>(
          `/api/projects/${activeProject.id}/finance`,
          { method: "GET" },
        );

        if (!cancelled) {
          setProjectData(payload);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error ? nextError.message : "Impossible de charger la finance.",
          );
        }
      }
    }

    void loadFinance();

    return () => {
      cancelled = true;
    };
  }, [activeProject.id]);

  if (!projectData && !error) {
    return (
      <div className="space-y-6">
        <SectionHeading eyebrow="Finance" title="Chargement de la finance projet" />
        <LoadingStateCard
          title="La finance se synchronise"
          detail="Nous recuperons les decomptes, les validations, les paiements et la tresorerie du projet actif."
        />
      </div>
    );
  }

  if (!projectData) {
    return (
      <div className="space-y-6">
        <SectionHeading eyebrow="Finance" title="La finance est indisponible" />
        <InlineNotice tone="danger" title="Impossible de charger la finance">
          {error}
        </InlineNotice>
      </div>
    );
  }

  return (
    <FinanceModuleContent
      key={activeProject.id}
      activeProject={activeProject}
      activeProjectId={activeProject.id}
      availableProjects={availableProjects}
      canCreateInvoice={canCreateInvoice}
      canRecordPayment={canRecordPayment}
      canSendInvoice={canSendInvoice}
      canValidateInvoice={canValidateInvoice}
      currentUserId={currentUser.id}
      currentUserRole={currentUser.role}
      projectData={projectData}
      setActiveProjectId={setActiveProjectId}
    />
  );
}

function FinanceModuleContent({
  activeProject,
  activeProjectId,
  availableProjects,
  canCreateInvoice,
  canRecordPayment,
  canSendInvoice,
  canValidateInvoice,
  currentUserId,
  currentUserRole,
  projectData,
  setActiveProjectId,
}: {
  activeProject: {
    id: string;
    name: string;
    code: string;
    client: string;
    location: string;
    budgetTnd: number;
    spentTnd: number;
    invoicesDue: number;
  };
  activeProjectId: string;
  availableProjects: Array<{
    id: string;
    name: string;
    code: string;
  }>;
  canCreateInvoice: boolean;
  canRecordPayment: boolean;
  canSendInvoice: boolean;
  canValidateInvoice: boolean;
  currentUserId: string;
  currentUserRole: string;
  projectData: FinancePayload;
  setActiveProjectId: (projectId: string) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<FinanceTab>("dm");
  const [activeSection, setActiveSection] = useState<FinanceSectionId>("overview");
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [overview, setOverview] = useState(projectData.overview);
  const [invoices, setInvoices] = useState<InvoiceItem[]>(projectData.invoices);
  const [payments, setPayments] = useState<PaymentItem[]>(projectData.payments);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(
    projectData.invoices[0]?.id ?? "",
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("summary");
  const [searchValue, setSearchValue] = useState("");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [vatRegime, setVatRegime] = useState(
    financeVatRegimes.find((regime) => regime.id === projectData.defaultVatRegimeId) ??
      financeVatRegimes[0],
  );
  const [dmDraft, setDmDraft] = useState(projectData.dmDraft);
  const [paymentDraft, setPaymentDraft] = useState(projectData.paymentDraft);
  const [statusDraft, setStatusDraft] = useState(projectData.invoices[0]?.status ?? "Brouillon");
  const [cashflowData, setCashflowData] = useState(projectData.cashflow);
  const [declaration, setDeclaration] = useState(projectData.declaration);
  const [mutationError, setMutationError] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const invoicesRef = useRef(invoices);

  const draftValues = useMemo(() => {
    const retentionAmount = Math.round((dmDraft.baseAmountHt * dmDraft.retentionPct) / 100);
    const amountAfterRetention = dmDraft.baseAmountHt - retentionAmount - dmDraft.advanceDeduction;
    const tvaAmount = Math.round((amountAfterRetention * vatRegime.rate) / 100);
    const amountTtc = amountAfterRetention + tvaAmount;

    return {
      retentionAmount,
      amountAfterRetention,
      tvaAmount,
      amountTtc,
    };
  }, [dmDraft, vatRegime]);

  const workflowOwners = useMemo(() => {
    const membersById = new Map(projectData.projectMembers.map((member) => [member.id, member]));

    return {
      clientApproverId: membersById.get(projectData.projectSetup.workflowOwners.clientApproverId),
      financeLeadId: membersById.get(projectData.projectSetup.workflowOwners.financeLeadId),
      projectManagerId: membersById.get(projectData.projectSetup.workflowOwners.projectManagerId),
    } satisfies WorkflowOwnerDisplay;
  }, [projectData.projectMembers, projectData.projectSetup.workflowOwners]);

  const canManageManualStatus = useMemo(() => {
    if (currentUserRole === "Super Admin") {
      return true;
    }

    if (workflowOwners.financeLeadId?.id) {
      return workflowOwners.financeLeadId.id === currentUserId;
    }

    return currentUserRole === "Comptable";
  }, [currentUserId, currentUserRole, workflowOwners.financeLeadId]);

  const manualStatusOptions = useMemo(
    () =>
      currentUserRole === "Super Admin"
        ? [...allManualInvoiceStatuses]
        : (["Brouillon", "Envoyee", "Litigieuse"] as string[]),
    [currentUserRole],
  );

  const now = useMemo(() => getNow(), []);

  const queueRecords = useMemo<QueueRecord[]>(
    () =>
      invoices.map((invoice) => {
        const paidAmount = getInvoicePaidAmount(invoice.id, payments);
        const coverage = getInvoiceCoverage(invoice, payments);
        const remainingAmount = getInvoiceRemainingAmount(invoice, payments);
        const overdueDays = getInvoiceOverdueDays(invoice, remainingAmount, now);

        return {
          ...invoice,
          coverage,
          displayStatus: getInvoiceDisplayStatus(invoice, coverage, overdueDays),
          isOverdue: overdueDays > 0,
          isPartial: paidAmount > 0 && coverage < 100,
          overdueDays,
          paidAmount,
          remainingAmount,
        };
      }),
    [invoices, now, payments],
  );

  const draftInvoices = useMemo(
    () => queueRecords.filter((invoice) => invoice.status === "Brouillon"),
    [queueRecords],
  );

  const projectValidationInvoices = useMemo(
    () =>
      queueRecords.filter(
        (invoice) => invoice.status !== "Brouillon" && !invoice.validatedByMoe,
      ),
    [queueRecords],
  );

  const clientValidationInvoices = useMemo(
    () => queueRecords.filter((invoice) => invoice.validatedByMoe && !invoice.validatedByMo),
    [queueRecords],
  );

  const collectibleInvoices = useMemo(
    () =>
      queueRecords.filter(
        (invoice) =>
          invoice.validatedByMo && invoice.remainingAmount > 0 && invoice.status !== "Payee",
      ),
    [queueRecords],
  );

  const overdueInvoices = useMemo(
    () => queueRecords.filter((invoice) => invoice.isOverdue),
    [queueRecords],
  );

  const overdueCollectibleInvoices = useMemo(
    () =>
      collectibleInvoices.filter(
        (invoice) => invoice.isOverdue || invoice.displayStatus === "En retard",
      ),
    [collectibleInvoices],
  );

  const hasCurrentPeriodCycle = useMemo(
    () => queueRecords.some((invoice) => invoice.periodMonth === dmDraft.periodMonth),
    [dmDraft.periodMonth, queueRecords],
  );

  const selectedInvoice =
    invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? invoices[0];
  const selectedQueueRecord =
    queueRecords.find((invoice) => invoice.id === selectedInvoice?.id) ?? null;
  const paymentDraftInvoiceRef = useRef("");

  const projectApproverName = workflowOwners.projectManagerId?.name ?? "le chef de projet";
  const clientApproverName = workflowOwners.clientApproverId?.name ?? "le maitre d'ouvrage";
  const financeLeadName = workflowOwners.financeLeadId?.name ?? "le referent finance";

  const selectedStatusValue = manualStatusOptions.includes(statusDraft)
    ? statusDraft
    : (manualStatusOptions[0] ?? statusDraft);
  const canApplyStatusUpdate =
    canManageManualStatus && manualStatusOptions.includes(selectedStatusValue) && !pendingAction;

  const canRegisterPaymentForSelectedInvoice = Boolean(
    canRecordPayment &&
      selectedInvoice &&
      selectedInvoice.validatedByMo &&
      selectedInvoice.status !== "Payee" &&
      !pendingAction,
  );

  const createInvoiceHelper = canCreateInvoice
    ? "Preparez d'abord le decompte mensuel. La facture sera creee sans ressaisie."
    : "Votre role peut consulter la finance, mais pas creer de facture.";

  const statusActionHelper = !canManageManualStatus
    ? `Seul ${financeLeadName} peut ajuster le statut manuel.`
    : !selectedInvoice
      ? "Selectionnez une facture pour mettre a jour son statut."
      : "Utilisez ce champ seulement pour brouillon, envoi ou litige. Les validations restent pilotees par le circuit.";

  const sendInvoiceHelper = canSendInvoice
    ? !selectedInvoice
      ? "Selectionnez une facture pour lancer son envoi."
      : selectedInvoice.status === "Brouillon"
        ? "Genere le PDF et lance le circuit d'envoi de la facture selectionnee."
        : "Regenerer le PDF si besoin sans perdre l'historique de validation."
    : "Votre role ne peut pas generer ni envoyer les factures.";

  const paymentActionHelper = !canRecordPayment
    ? "Votre role ne peut pas enregistrer les paiements."
    : !selectedInvoice
      ? "Selectionnez une facture pour enregistrer un paiement."
      : selectedInvoice.status === "Payee"
        ? "Cette facture est deja reglee en totalite."
      : selectedInvoice.validatedByMo
        ? "Le paiement peut etre saisi des que l'encaissement est confirme par la comptabilite."
        : `Le paiement restera bloque jusqu'a la validation client par ${clientApproverName}.`;

  const paymentCoverage = selectedQueueRecord?.coverage ?? 0;
  const workflowSteps = useMemo(
    () =>
      buildFinanceWorkflowSteps({
        clientApproverName,
        invoice: selectedInvoice,
        paymentCoverage,
        projectApproverName,
      }),
    [clientApproverName, paymentCoverage, projectApproverName, selectedInvoice],
  );

  useEffect(() => {
    if (!selectedInvoice) {
      paymentDraftInvoiceRef.current = "";
      return;
    }

    if (paymentDraftInvoiceRef.current === selectedInvoice.id) {
      return;
    }

    paymentDraftInvoiceRef.current = selectedInvoice.id;
    const remainingAmount = getInvoiceRemainingAmount(selectedInvoice, payments);

    setPaymentDraft((current) => ({
      amount: remainingAmount > 0 ? String(remainingAmount) : "",
      method: current.method || "Virement",
      reference: "",
    }));
  }, [payments, selectedInvoice]);

  const validationAction = useMemo<DrawerAction>(() => {
    if (!selectedInvoice) {
      return {
        canRun: false,
        helper: "Selectionnez une facture pour lancer la validation.",
        label: "Valider la facture",
      };
    }

    const isSuperAdmin = currentUserRole === "Super Admin";
    const projectApprover =
      canValidateInvoice &&
      (isSuperAdmin ||
        (workflowOwners.projectManagerId?.id
          ? workflowOwners.projectManagerId.id === currentUserId
          : currentUserRole === "Chef de projet"));
    const clientApprover =
      canValidateInvoice &&
      (isSuperAdmin ||
        (workflowOwners.clientApproverId?.id
          ? workflowOwners.clientApproverId.id === currentUserId
          : currentUserRole === "Maitre d'ouvrage"));

    if (!selectedInvoice.validatedByMoe) {
      return {
        canRun: projectApprover,
        helper: projectApprover
          ? `Validation projet requise avant validation client. Responsable cible: ${projectApproverName}.`
          : `En attente de la validation projet par ${projectApproverName}.`,
        label: "Valider cote projet",
      };
    }

    if (!selectedInvoice.validatedByMo) {
      return {
        canRun: clientApprover,
        helper: clientApprover
          ? `Validation finale client requise pour cloturer le circuit. Responsable cible: ${clientApproverName}.`
          : `En attente de la validation finale par ${clientApproverName}.`,
        label: "Valider cote client",
      };
    }

    return {
      canRun: false,
      helper: "Facture deja validee sur l'ensemble du circuit.",
      label: "Facture validee",
    };
  }, [
    canValidateInvoice,
    clientApproverName,
    currentUserId,
    currentUserRole,
    projectApproverName,
    selectedInvoice,
    workflowOwners.clientApproverId,
    workflowOwners.projectManagerId,
  ]);

  const topMetrics = useMemo<
    Array<{ helper: string; label: string; tone: Tone; value: string }>
  >(() => {
    const overdueAmount = overdueInvoices.reduce(
      (sum, invoice) => sum + invoice.remainingAmount,
      0,
    );

    return [
      ...overview.kpis,
      {
        helper:
          overdueAmount > 0
            ? `${formatCompact(overdueAmount)} TND restent a encaisser hors echeance.`
            : "Aucun encaissement en retard sur le projet actif.",
        label: "Encaissement en retard",
        tone: overdueAmount > 0 ? "danger" : "success",
        value: formatCurrency(overdueAmount),
      },
    ];
  }, [overdueInvoices, overview.kpis]);

  const periodOptions = useMemo(() => {
    const values = new Set<string>();
    values.add(dmDraft.periodMonth);
    invoices.forEach((invoice) => values.add(invoice.periodMonth));
    return Array.from(values);
  }, [dmDraft.periodMonth, invoices]);

  const filteredInvoices = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    return queueRecords
      .filter((invoice) => {
        if (periodFilter !== "all" && invoice.periodMonth !== periodFilter) {
          return false;
        }

        if (!matchesQueueFilter(invoice, queueFilter)) {
          return false;
        }

        if (!query) {
          return true;
        }

        const paymentReferences = payments
          .filter((payment) => payment.invoiceId === invoice.id)
          .map((payment) => payment.reference.toLowerCase());

        return [
          invoice.invoiceNumber,
          invoice.project,
          invoice.status,
          invoice.displayStatus,
          invoice.periodMonth,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query) || paymentReferences.some((reference) => reference.includes(query));
      })
      .sort((left, right) => {
        const priorityDelta = getQueuePriority(left) - getQueuePriority(right);
        if (priorityDelta !== 0) {
          return priorityDelta;
        }

        if (left.isOverdue !== right.isOverdue) {
          return left.isOverdue ? -1 : 1;
        }

        if (left.remainingAmount !== right.remainingAmount) {
          return right.remainingAmount - left.remainingAmount;
        }

        return new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime();
      });
  }, [payments, periodFilter, queueFilter, queueRecords, searchValue]);

  const actionCenterCards = useMemo<ActionCenterCard[]>(() => {
    const dmCount = hasCurrentPeriodCycle ? 0 : 1;
    const draftCount = draftInvoices.length;
    const projectValidationCount = projectValidationInvoices.length;
    const clientValidationCount = clientValidationInvoices.length;
    const paymentsToChase = overdueCollectibleInvoices.length;

    return [
      {
        count: dmCount,
        helper:
          dmCount > 0
            ? "Le cycle mensuel n'est pas encore lance pour la periode selectionnee."
            : "Le cycle de la periode selectionnee est deja lance et visible dans la file active.",
        id: "dm",
        label: "DM a preparer",
        section: "overview",
        tone: dmCount > 0 ? "primary" : "success",
      },
      {
        count: draftCount,
        helper:
          draftCount > 0
            ? `${draftCount} facture(s) restent en brouillon avant envoi.`
            : "Aucune facture en brouillon n'attend un envoi.",
        id: "send",
        label: "Factures a envoyer",
        section: "billing",
        tone: draftCount > 0 ? "warning" : "neutral",
        filter: "draft",
      },
      {
        count: projectValidationCount,
        helper:
          projectValidationCount > 0
            ? `Demandes en attente cote ${projectApproverName}.`
            : "Aucune validation projet n'est en attente.",
        id: "project-validation",
        label: "Validations projet en attente",
        section: "billing",
        tone: projectValidationCount > 0 ? "warning" : "neutral",
        filter: "project-validation",
      },
      {
        count: clientValidationCount,
        helper:
          clientValidationCount > 0
            ? `Demandes en attente cote ${clientApproverName}.`
            : "Aucune validation client n'est en attente.",
        id: "client-validation",
        label: "Validations client en attente",
        section: "billing",
        tone: clientValidationCount > 0 ? "warning" : "neutral",
        filter: "client-validation",
      },
      {
        count: paymentsToChase,
        helper:
          paymentsToChase > 0
            ? "Factures validees avec encaissement en retard a relancer."
            : "Aucune relance d'encaissement urgente n'est en attente.",
        id: "collections",
        label: "Paiements a relancer",
        section: "collections",
        tone: paymentsToChase > 0 ? "danger" : "neutral",
        filter: "overdue",
      },
    ];
  }, [
    clientApproverName,
    clientValidationInvoices.length,
    draftInvoices.length,
    hasCurrentPeriodCycle,
    overdueCollectibleInvoices.length,
    projectApproverName,
    projectValidationInvoices.length,
  ]);

  const agingBuckets = useMemo(() => {
    const buckets = {
      current: 0,
      d1to30: 0,
      d31to60: 0,
      d60plus: 0,
    };

    queueRecords.forEach((invoice) => {
      if (!invoice.remainingAmount) {
        return;
      }

      if (!invoice.overdueDays) {
        buckets.current += invoice.remainingAmount;
        return;
      }

      if (invoice.overdueDays <= 30) {
        buckets.d1to30 += invoice.remainingAmount;
        return;
      }

      if (invoice.overdueDays <= 60) {
        buckets.d31to60 += invoice.remainingAmount;
        return;
      }

      buckets.d60plus += invoice.remainingAmount;
    });

    return [
      { key: "current", label: "Courant", value: buckets.current, tone: "primary" as Tone },
      { key: "1-30", label: "1-30 jours", value: buckets.d1to30, tone: "warning" as Tone },
      { key: "31-60", label: "31-60 jours", value: buckets.d31to60, tone: "warning" as Tone },
      { key: "60+", label: "60+ jours", value: buckets.d60plus, tone: "danger" as Tone },
    ];
  }, [queueRecords]);

  const collectionsSummary = useMemo(() => {
    const totalInvoiced = invoices.reduce((sum, invoice) => sum + invoice.amountTtc, 0);
    const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const totalRemaining = queueRecords.reduce((sum, invoice) => sum + invoice.remainingAmount, 0);

    return {
      totalInvoiced,
      totalPaid,
      totalRemaining,
    };
  }, [invoices, payments, queueRecords]);

  const treasurySummary = useMemo(() => {
    const planned = cashflowData.reduce((sum, item) => sum + item.plannedReceipts, 0);
    const actual = cashflowData.reduce((sum, item) => sum + item.actualReceipts, 0);
    const costs = cashflowData.reduce((sum, item) => sum + item.actualCosts, 0);
    const delta = actual - costs;
    return { planned, actual, costs, delta };
  }, [cashflowData]);

  const chartData = useMemo(
    () =>
      cashflowData.map((item) => ({
        actual: item.actualReceipts,
        costs: item.actualCosts,
        label: item.label,
        planned: item.plannedReceipts,
      })),
    [cashflowData],
  );

  const profitabilitySummary = useMemo(() => {
    const budget = activeProject.budgetTnd;
    const realCosts = activeProject.spentTnd;
    const gap = budget - realCosts;
    const spentRatio = budget > 0 ? Math.round((realCosts / budget) * 100) : 0;
    const risk =
      spentRatio >= 95 ? "Risque eleve" : spentRatio >= 80 ? "Sous tension" : "Sous controle";

    return {
      budget,
      gap,
      realCosts,
      risk,
      spentRatio,
      trend: treasurySummary.delta >= 0 ? "Positive" : "A surveiller",
    };
  }, [activeProject.budgetTnd, activeProject.spentTnd, treasurySummary.delta]);

  const linkedDocuments = useMemo<LinkedFinanceDocument[]>(() => {
    const invoice = selectedInvoice;
    const invoicePayments = invoice
      ? payments.filter((payment) => payment.invoiceId === invoice.id)
      : [];

    return [
      {
        actionLabel: invoice?.pdfUrl ? "Ouvrir le PDF" : "A generer",
        description: invoice?.pdfUrl
          ? "Facture PDF disponible pour partage et audit."
          : "Le PDF sera disponible apres l'envoi de la facture.",
        id: "invoice-pdf",
        kind: "Facture PDF",
        status: invoice?.pdfUrl ? "Disponible" : "En attente",
        url: invoice?.pdfUrl,
      },
      {
        actionLabel: invoice?.pdfUrl ? "Voir le DM" : "A preparer",
        description:
          "Le decompte mensuel reste la base de calcul et la trace de l'avancement facture.",
        id: "dm-pdf",
        kind: "DM PDF",
        status: invoice ? "Genere avec la facture" : "A lancer",
        url: invoice?.pdfUrl,
      },
      {
        actionLabel: invoicePayments.length > 0 ? "Voir les references" : "En attente",
        description:
          "Justificatifs de paiement relies a l'encaissement en cours ou complet.",
        id: "payment-proof",
        kind: "Justificatifs paiement",
        status:
          invoicePayments.length > 0
            ? `${invoicePayments.length} preuve(s)`
            : "Aucune preuve",
      },
      {
        actionLabel: "Ouvrir Module 6",
        description:
          "Rapports signes et preuves relies au decompte pour la piste d'audit finance.",
        id: "linked-reports",
        kind: "Rapports signes",
        status: selectedInvoice ? `${selectedInvoice.sourceProgress}% d'avancement` : "A definir",
      },
    ];
  }, [payments, selectedInvoice]);

  const proofSummary = useMemo<ProofSummary>(() => {
    const paymentProofCount = selectedInvoice
      ? payments.filter((payment) => payment.invoiceId === selectedInvoice.id).length
      : 0;

    return {
      dmStatus: selectedInvoice ? "Pret pour audit" : "A lancer",
      invoicePdfStatus: selectedInvoice?.pdfUrl ? "Disponible" : "En attente",
      paymentProofStatus: paymentProofCount > 0 ? `${paymentProofCount} preuve(s)` : "Aucune preuve",
      signedReportsStatus: selectedInvoice ? `${selectedInvoice.sourceProgress}% d'avancement` : "A definir",
    };
  }, [payments, selectedInvoice]);

  const collectionsFocus = useMemo<CollectionFocus | null>(() => {
    const priorityInvoice = overdueCollectibleInvoices[0] ?? collectibleInvoices[0] ?? null;

    if (!priorityInvoice) {
      return null;
    }

    return {
      amountLabel: formatCurrency(priorityInvoice.remainingAmount),
      filter: priorityInvoice.isOverdue ? "overdue" : "collectible",
      helper: priorityInvoice.isOverdue
        ? `${priorityInvoice.overdueDays} jour(s) de retard. Relance a lancer en priorite.`
        : "Facture validee prete pour enregistrement ou suivi d'encaissement.",
      invoiceNumber: priorityInvoice.invoiceNumber,
      project: priorityInvoice.project,
      tone: priorityInvoice.isOverdue ? "danger" : "primary",
    };
  }, [collectibleInvoices, overdueCollectibleInvoices]);

  const myActions = (() => {
    const items: Array<{
      cta: string;
      detail: string;
      label: string;
      onClick: () => void;
      tone: Tone;
    }> = [];

    const projectValidations = projectValidationInvoices.length;
    const clientValidations = clientValidationInvoices.length;
    const myPayments = collectibleInvoices.length;
    const myOverdues = overdueInvoices.length;

    if (["Chef de projet", "Super Admin"].includes(currentUserRole) && projectValidations > 0) {
      items.push({
        cta: "Ouvrir les validations",
        detail: `${projectValidations} facture(s) attendent une validation projet.`,
        label: "Mes validations projet",
        onClick: () => {
          setQueueFilter("project-validation");
          focusSection("billing");
        },
        tone: "warning",
      });
    }

    if (["Maitre d'ouvrage", "Super Admin"].includes(currentUserRole) && clientValidations > 0) {
      items.push({
        cta: "Voir la file client",
        detail: `${clientValidations} validation(s) client restent a traiter.`,
        label: "Mes validations client",
        onClick: () => {
          setQueueFilter("client-validation");
          focusSection("billing");
        },
        tone: "warning",
      });
    }

    if (["Comptable", "Super Admin"].includes(currentUserRole) && myPayments > 0) {
      items.push({
        cta: "Ouvrir les encaissements",
        detail: `${myPayments} facture(s) peuvent recevoir un paiement.`,
        label: "Mes paiements",
        onClick: () => {
          setQueueFilter("collectible");
          focusSection("collections");
        },
        tone: "primary",
      });
    }

    if (myOverdues > 0) {
      items.push({
        cta: "Relancer maintenant",
        detail: `${myOverdues} facture(s) depassent l'echeance contractuelle.`,
        label: "Mes retards",
        onClick: () => {
          setQueueFilter("overdue");
          focusSection("collections");
        },
        tone: "danger",
      });
    }

    if (!items.length) {
      items.push({
        cta: "Rester en veille",
        detail: "Aucune action personnelle urgente n'est detectee pour le moment.",
        label: "Mes actions",
        onClick: () => focusSection("overview"),
        tone: "success",
      });
    }

    return items.slice(0, 3);
  })();

  const nextPaymentInvoice = useMemo(
    () => overdueCollectibleInvoices[0] ?? collectibleInvoices[0] ?? null,
    [collectibleInvoices, overdueCollectibleInvoices],
  );

  useEffect(() => {
    invoicesRef.current = invoices;
  }, [invoices]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    const section = searchParams.get("section");
    const invoiceId = searchParams.get("invoice");
    const nextInvoice =
      invoiceId && invoicesRef.current.some((invoice) => invoice.id === invoiceId)
        ? invoicesRef.current.find((invoice) => invoice.id === invoiceId)
        : undefined;

    startTransition(() => {
      const mappedTab = isFinanceTab(tab) ? tab : null;
      const mappedSection = isFinanceSection(section)
        ? section
        : mappedTab
          ? mapTabToSection(mappedTab)
          : null;

      if (mappedSection) {
        setActiveTab(mappedTab ?? mapSectionToTab(mappedSection));
        setActiveSection(mappedSection);
        requestAnimationFrame(() => {
          document.getElementById(`finance-section-${mappedSection}`)?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        });
      } else if (mappedTab) {
        setActiveTab(mappedTab);
      }

      if (invoiceId && nextInvoice) {
        setSelectedInvoiceId(invoiceId);
        setStatusDraft(nextInvoice.status);
        setDrawerOpen(true);
      } else {
        setDrawerOpen(false);
      }
    });
  }, [searchParams]);

  function replaceModuleUrl(
    nextTab: FinanceTab,
    invoiceId?: string,
    nextSection?: FinanceSectionId,
  ) {
    const params = new URLSearchParams(searchParams.toString());
    const resolvedSection = nextSection ?? activeSection;
    params.set("tab", nextTab);
    if (resolvedSection && resolvedSection !== mapTabToSection(nextTab)) {
      params.set("section", resolvedSection);
    } else {
      params.delete("section");
    }
    if (invoiceId) {
      params.set("invoice", invoiceId);
    } else {
      params.delete("invoice");
    }

    const query = params.toString();
    const nextUrl = query ? `${pathname}?${query}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }

  function focusSection(section: FinanceSectionId, tab?: FinanceTab) {
    const nextTab = tab ?? mapSectionToTab(section);
    setActiveTab(nextTab);
    setActiveSection(section);
    replaceModuleUrl(nextTab, drawerOpen ? selectedInvoice?.id : undefined, section);

    requestAnimationFrame(() => {
      document.getElementById(`finance-section-${section}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function applyProjectData(nextData: FinancePayload) {
    startTransition(() => {
      setOverview(nextData.overview);
      setInvoices(nextData.invoices);
      setPayments(nextData.payments);
      setCashflowData(nextData.cashflow);
      setDeclaration(nextData.declaration);
      setDmDraft(nextData.dmDraft);
      setPaymentDraft(nextData.paymentDraft);
      const nextSelectedInvoice =
        nextData.invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? nextData.invoices[0];
      setStatusDraft(nextSelectedInvoice?.status ?? "Brouillon");
      setSelectedInvoiceId((current) =>
        nextData.invoices.some((invoice) => invoice.id === current)
          ? current
          : (nextData.invoices[0]?.id ?? ""),
      );
    });
  }

  async function runFinanceAction(
    action: string,
    payload: Record<string, unknown>,
    pendingKey = action,
  ) {
    setPendingAction(pendingKey);
    try {
      const nextData = await apiFetch<FinancePayload>(`/api/projects/${activeProjectId}/finance`, {
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

  async function generateMonthlyStatement() {
    try {
      const nextData = await runFinanceAction(
        "create-invoice",
        {
          dmDraft,
          vatRegimeId: vatRegime.id,
        },
        "create-invoice",
      );
      const nextInvoiceId = nextData.invoices[0]?.id ?? "";
      setSelectedInvoiceId(nextInvoiceId);
      if (nextData.invoices[0]) {
        setStatusDraft(nextData.invoices[0].status);
      }
      openInvoiceDrawer(nextInvoiceId, "summary", "overview");
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Generation impossible.");
    }
  }

  async function validateInvoice(invoiceId: string) {
    try {
      await runFinanceAction("validate-invoice", { invoiceId }, "validate-invoice");
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Validation impossible.");
    }
  }

  async function sendInvoice(invoiceId: string) {
    try {
      const nextData = await runFinanceAction("send-invoice", { invoiceId }, "send-invoice");
      const nextInvoice = nextData.invoices.find((invoice) => invoice.id === invoiceId);
      openPdf(nextInvoice?.pdfUrl);
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Envoi impossible.");
    }
  }

  async function registerPayment(invoiceId: string) {
    if (!selectedInvoice) {
      return;
    }
    try {
      await runFinanceAction(
        "register-payment",
        {
          invoiceId,
          paymentDraft,
        },
        "register-payment",
      );
      focusSection("collections");
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Paiement impossible.");
    }
  }

  async function updateInvoiceStatus(invoiceId: string) {
    try {
      await runFinanceAction(
        "update-invoice-status",
        {
          invoiceId,
          status: statusDraft,
        },
        "update-invoice-status",
      );
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Statut impossible.");
    }
  }

  function openInvoiceDrawer(
    invoiceId: string,
    nextDrawerTab: DrawerTab = "summary",
    originSection: FinanceSectionId = activeSection,
  ) {
    const nextInvoice = invoices.find((invoice) => invoice.id === invoiceId);
    setSelectedInvoiceId(invoiceId);
    if (nextInvoice) {
      setStatusDraft(nextInvoice.status);
    }
    setDrawerTab(nextDrawerTab);
    setDrawerOpen(true);
    setActiveTab("invoices");
    setActiveSection(originSection);
    replaceModuleUrl("invoices", invoiceId, originSection);
  }

  function closeInvoiceDrawer() {
    setDrawerOpen(false);
    replaceModuleUrl(activeTab, undefined, activeSection);
  }

  function handleTopPaymentAction() {
    if (!nextPaymentInvoice) {
      return;
    }

    openInvoiceDrawer(nextPaymentInvoice.id, "payments", "collections");
  }

  function handleSelectInvoice(invoiceId: string) {
    openInvoiceDrawer(invoiceId, "summary", "billing");
  }

  function downloadInvoicePdf(invoice: InvoiceItem) {
    openPdf(invoice.pdfUrl);
  }

  function openDocumentsHub() {
    router.push("/documents");
  }

  const financeActionCard = !selectedInvoice
    ? {
        action: () => (canCreateInvoice ? focusSection("overview") : null),
        canRun: canCreateInvoice && !pendingAction,
        helper: createInvoiceHelper,
        label: "Preparer le decompte",
        tone: "primary" as Tone,
      }
    : !selectedInvoice.status || selectedInvoice.status === "Brouillon"
      ? {
          action: () => (canSendInvoice ? sendInvoice(selectedInvoice.id) : null),
          canRun: canSendInvoice && !pendingAction,
          helper: sendInvoiceHelper,
          label: "Envoyer la facture",
          tone: "primary" as Tone,
        }
      : !selectedInvoice.validatedByMoe || !selectedInvoice.validatedByMo
        ? {
            action: () =>
              validationAction.canRun ? validateInvoice(selectedInvoice.id) : null,
            canRun: validationAction.canRun && !pendingAction,
            helper: validationAction.helper,
            label: validationAction.label,
            tone: validationAction.canRun ? ("warning" as Tone) : ("neutral" as Tone),
          }
        : selectedInvoice.status !== "Payee"
          ? {
              action: () =>
                canRegisterPaymentForSelectedInvoice ? registerPayment(selectedInvoice.id) : null,
              canRun: canRegisterPaymentForSelectedInvoice && !pendingAction,
              helper: paymentActionHelper,
              label: "Enregistrer le paiement recu",
              tone: canRegisterPaymentForSelectedInvoice
                ? ("success" as Tone)
                : ("neutral" as Tone),
            }
          : {
              action: () => {
                if (selectedInvoice.id) {
                  openInvoiceDrawer(selectedInvoice.id, "payments", "collections");
                }
              },
              canRun: true,
              helper:
                "La facture est cloturee. Ouvrez l'onglet paiements pour revoir l'encaissement.",
              label: "Voir le paiement",
              tone: "success" as Tone,
            };

  const topPeriodLabel =
    periodFilter === "all"
      ? "Toutes periodes"
      : formatDate(`${periodFilter}-01`);

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Finance cockpit"
        title="Module 9 - Facturation & Finance"
        description={`${activeProject.name} - Operations financieres du projet: decompte, validations, encaissements, TVA et rentabilite.`}
        action={
          <button
            type="button"
            onClick={() => focusSection("overview")}
            disabled={!canCreateInvoice || Boolean(pendingAction)}
            title={createInvoiceHelper}
            className={cx(
              "rounded-2xl px-4 py-3 text-sm font-semibold",
              canCreateInvoice && !pendingAction
                ? "bg-black text-white hover:bg-stone-800"
                : "cursor-not-allowed bg-stone-200 text-stone-500",
            )}
          >
            Nouveau DM
          </button>
        }
      />

      <Panel className="space-y-4">
        <div className="grid gap-3 xl:grid-cols-[220px_220px_minmax(0,1fr)_auto]">
          <label className="rounded-[20px] border border-stone-200 bg-white px-4 py-3">
            <span className="text-xs uppercase tracking-[0.16em] text-stone-500">Projet</span>
            <select
              value={activeProject.id}
              onChange={(event) => setActiveProjectId(event.target.value)}
              className="mt-2 w-full bg-transparent text-sm font-semibold text-stone-950 outline-none"
            >
              {availableProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} - {project.code}
                </option>
              ))}
            </select>
          </label>

          <label className="rounded-[20px] border border-stone-200 bg-white px-4 py-3">
            <span className="text-xs uppercase tracking-[0.16em] text-stone-500">Periode</span>
            <select
              value={periodFilter}
              onChange={(event) => setPeriodFilter(event.target.value)}
              className="mt-2 w-full bg-transparent text-sm font-semibold text-stone-950 outline-none"
            >
              <option value="all">Toutes periodes</option>
              {periodOptions.map((value) => (
                <option key={value} value={value}>
                  {formatDate(`${toMonthInputValue(value)}-01`)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-3 rounded-[20px] border border-stone-200 bg-white px-4 py-3">
            <Search className="size-4 text-stone-500" />
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Rechercher facture, projet, reference, statut"
              className="w-full bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-400"
            />
          </label>

          <button
            type="button"
            onClick={handleTopPaymentAction}
            disabled={!nextPaymentInvoice || !canRecordPayment || Boolean(pendingAction)}
            title={
              nextPaymentInvoice
                ? "Ouvrir la prochaine facture prete pour encaissement."
                : "Aucune facture eligible au paiement pour le moment."
            }
            className={cx(
              "rounded-[20px] border px-4 py-3 text-sm font-semibold",
              nextPaymentInvoice && canRecordPayment && !pendingAction
                ? "border-stone-200 bg-white text-stone-950 hover:bg-stone-50"
                : "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400",
            )}
          >
            Paiement recu
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-stone-500">
            <span>{activeProject.code}</span>
            <span>-</span>
            <span>{topPeriodLabel}</span>
          </div>
          <div className="text-sm text-stone-600">
            {filteredInvoices.length} element(s) visibles dans la file active
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-5">
        {topMetrics.map((metric, index) => (
          <button
            key={metric.label}
            type="button"
            onClick={() => {
              if (metric.label === "DSO") {
                setQueueFilter("overdue");
                focusSection("collections");
                return;
              }

              if (metric.label.includes("Facturation")) {
                setQueueFilter("sent");
                focusSection("billing");
                return;
              }

              if (metric.label.includes("budget")) {
                focusSection("profitability");
                return;
              }

              if (metric.label.includes("TVA")) {
                focusSection("vat");
                return;
              }

              setQueueFilter("overdue");
              focusSection("collections");
            }}
            className="text-left"
          >
            <MetricCard
              label={metric.label}
              value={metric.value}
              helper={metric.helper}
              tone={metric.tone}
              icon={metricIcons[index]}
            />
          </button>
        ))}
      </div>

      {!canCreateInvoice || !canSendInvoice || !canValidateInvoice || !canRecordPayment ? (
        <InlineNotice tone="neutral" title="Finance adaptee a votre role">
          Votre role <span className="font-semibold text-stone-950">{currentUserRole}</span> peut
          consulter la finance, avec des droits adaptes pour creer, valider par etapes ou enregistrer les paiements.
        </InlineNotice>
      ) : null}

      {mutationError ? (
        <InlineNotice tone="danger" title="Action finance interrompue">
          {mutationError}
        </InlineNotice>
      ) : null}

      {pendingAction ? (
        <InlineNotice tone="primary" title="Traitement finance en cours">
          Mise a jour en cours. Les actions critiques se reactiveront une fois le traitement termine.
        </InlineNotice>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_248px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-[18px] border border-stone-200 bg-white px-3.5 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              Aller a
            </span>
            {sectionJumpLinks.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => focusSection(link.id)}
                className={cx(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold text-stone-700 transition-colors",
                  activeSection === link.id
                    ? "border-black bg-black text-white"
                    : "border-stone-200 bg-stone-50 hover:bg-stone-100",
                )}
              >
                {link.label}
              </button>
            ))}
          </div>

          <section
            id="finance-section-overview"
            className="space-y-4"
          >
            <FinanceActionCenter
              activeFilter={queueFilter}
              actionCards={actionCenterCards}
              financeActionCard={financeActionCard}
              onCardSelect={(card) => {
                if (card.filter) {
                  setQueueFilter(card.filter);
                }
                focusSection(card.section);
              }}
            />
            <FinanceDecompteComposer
              canCreateInvoice={canCreateInvoice}
              dmDraft={dmDraft}
              draftValues={draftValues}
              pendingAction={pendingAction}
              projectLots={projectData.projectSetup.lots}
              setDmDraft={setDmDraft}
              vatRegime={vatRegime}
              onGenerate={generateMonthlyStatement}
            />
          </section>

          <section id="finance-section-billing">
            <FinanceBillingQueue
              activeFilter={queueFilter}
              invoices={filteredInvoices}
              onAction={(invoice, nextTab) => {
                openInvoiceDrawer(invoice.id, nextTab, "billing");
              }}
              onFilterChange={setQueueFilter}
              onRowClick={handleSelectInvoice}
            />
          </section>

          <section id="finance-section-treasury">
            <FinanceTreasuryPulse
              chartData={chartData}
              summary={treasurySummary}
              treasuryAlert={overview.treasuryAlert}
            />
          </section>

          <section id="finance-section-collections">
            <FinanceCollectionsSection
              agingBuckets={agingBuckets}
              collectibleCount={collectibleInvoices.length}
              focus={collectionsFocus}
              overdueCount={overdueCollectibleInvoices.length}
              onOpenQueue={(filter) => {
                setQueueFilter(filter);
                focusSection("billing");
              }}
              summary={collectionsSummary}
            />
          </section>

          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <section id="finance-section-vat">
              <FinanceVatSection
                declaration={declaration}
                selectedInvoice={selectedInvoice}
                setVatRegime={setVatRegime}
                vatRegime={vatRegime}
              />
            </section>

            <section id="finance-section-profitability">
              <FinanceProfitabilitySection summary={profitabilitySummary} />
            </section>
          </div>

          <section id="finance-section-documents">
            <FinanceDocumentsProofs
              documents={linkedDocuments}
              onOpenDocumentsHub={openDocumentsHub}
              proofSummary={proofSummary}
            />
          </section>

          <section id="finance-section-archives">
            <FinanceArchivesSection
              invoices={queueRecords.filter((invoice) => invoice.displayStatus === "Payee" || invoice.status === "Litigieuse")}
              onSelectInvoice={(invoiceId) => openInvoiceDrawer(invoiceId, "workflow", "archives")}
            />
          </section>
        </div>

        <FinanceRightRail
          alerts={buildFinanceAlerts(queueRecords, overview.treasuryAlert)}
          healthSummary={{
            overdueAmount: overdueCollectibleInvoices.reduce(
              (sum, invoice) => sum + invoice.remainingAmount,
              0,
            ),
            profitabilityRisk: profitabilitySummary.risk,
            profitabilityTrend: profitabilitySummary.trend,
            remainingToCollect: collectionsSummary.totalRemaining,
            vatStatus: declaration.status,
          }}
          myActions={myActions}
        />
      </div>

      <FinanceInvoiceDrawer
        canRecordPayment={canRegisterPaymentForSelectedInvoice}
        canSendInvoice={canSendInvoice}
        canUpdateStatus={canApplyStatusUpdate}
        downloadInvoicePdf={downloadInvoicePdf}
        drawerTab={drawerTab}
        isOpen={drawerOpen}
        linkedDocuments={linkedDocuments}
        manualStatusOptions={manualStatusOptions}
        onClose={closeInvoiceDrawer}
        onOpenDocumentsHub={openDocumentsHub}
        onRegisterPayment={registerPayment}
        onSendInvoice={sendInvoice}
        onSetDrawerTab={setDrawerTab}
        onStatusChange={setStatusDraft}
        onUpdateStatus={updateInvoiceStatus}
        onValidateInvoice={validateInvoice}
        paymentActionHelper={paymentActionHelper}
        paymentCoverage={paymentCoverage}
        paymentDraft={paymentDraft}
        payments={payments.filter((payment) => payment.invoiceId === selectedInvoice?.id)}
        pendingAction={pendingAction}
        proofSummary={proofSummary}
        selectedInvoice={selectedInvoice}
        selectedQueueRecord={selectedQueueRecord}
        sendInvoiceHelper={sendInvoiceHelper}
        setPaymentDraft={setPaymentDraft}
        statusActionHelper={statusActionHelper}
        statusValue={selectedStatusValue}
        validationAction={validationAction}
        workflowOwners={workflowOwners}
        workflowSteps={workflowSteps}
      />
    </div>
  );
}

function FinanceActionCenter({
  activeFilter,
  actionCards,
  financeActionCard,
  onCardSelect,
}: {
  activeFilter: QueueFilter;
  actionCards: ActionCenterCard[];
  financeActionCard: {
    action: () => void;
    canRun: boolean;
    helper: string;
    label: string;
    tone: Tone;
  };
  onCardSelect: (card: ActionCenterCard) => void;
}) {
  return (
    <Panel
      title="Centre d'action"
      description="Les urgences finance remontent ici en premier pour limiter les allers-retours dans la file active."
      action={<StatusBadge tone={financeActionCard.tone}>{toneLabel(financeActionCard.tone)}</StatusBadge>}
    >
      <div className="grid gap-3 lg:grid-cols-2">
        {actionCards.map((card, index) => (
          <button
            key={card.id}
            type="button"
            onClick={() => onCardSelect(card)}
            className={cx(
              "flex h-full min-h-[124px] flex-col rounded-[18px] border px-4 py-3.5 text-left transition-colors",
              index === actionCards.length - 1 ? "lg:col-span-2" : "",
              activeFilter === card.filter
                ? "border-black bg-black text-white"
                : "border-stone-200 bg-white text-stone-900 hover:bg-stone-50",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={cx("text-xs uppercase tracking-[0.16em]", activeFilter === card.filter ? "text-white/65" : "text-stone-500")}>
                  {card.label}
                </p>
                <p className="mt-2.5 font-display text-[1.7rem] font-semibold leading-none">
                  {card.count}
                </p>
              </div>
              <StatusBadge tone={card.tone}>{toneLabel(card.tone)}</StatusBadge>
            </div>
            <p
              className={cx(
                "mt-3 flex-1 text-sm leading-5",
                activeFilter === card.filter ? "text-white/75" : "text-stone-600",
              )}
            >
              {card.helper}
            </p>
            <div className="mt-3 inline-flex items-center gap-2 text-sm font-semibold">
              Voir la file
              <ChevronRight className="size-4" />
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Prochaine action</p>
            <p className="mt-1.5 text-base font-semibold text-stone-950">{financeActionCard.label}</p>
            <p className="mt-1.5 text-sm leading-5 text-stone-600">{financeActionCard.helper}</p>
          </div>
          <button
            type="button"
            onClick={financeActionCard.action}
            disabled={!financeActionCard.canRun}
            className={cx(
              "inline-flex items-center justify-center gap-2 rounded-[16px] px-4 py-2.5 text-sm font-semibold",
              financeActionCard.canRun
                ? "bg-black text-white hover:bg-stone-800"
                : "cursor-not-allowed bg-stone-200 text-stone-500",
            )}
          >
            {financeActionCard.label}
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </Panel>
  );
}

function FinanceDecompteComposer({
  canCreateInvoice,
  dmDraft,
  draftValues,
  pendingAction,
  projectLots,
  setDmDraft,
  vatRegime,
  onGenerate,
}: {
  canCreateInvoice: boolean;
  dmDraft: {
    periodMonth: string;
    progressPct: number;
    baseAmountHt: number;
    retentionPct: number;
    advanceDeduction: number;
  };
  draftValues: {
    retentionAmount: number;
    amountAfterRetention: number;
    tvaAmount: number;
    amountTtc: number;
  };
  pendingAction: string;
  projectLots: string[];
  setDmDraft: React.Dispatch<
    React.SetStateAction<{
      periodMonth: string;
      progressPct: number;
      baseAmountHt: number;
      retentionPct: number;
      advanceDeduction: number;
    }>
  >;
  vatRegime: { id: string; label: string; rate: number; helper: string };
  onGenerate: () => void;
}) {
  return (
    <Panel
      title="Preparer le decompte du mois"
      description="Le DM lance le cycle mensuel. Verifiez les montants avant generation."
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_252px]">
        <div className="space-y-4">
          <label className="rounded-[20px] border border-stone-200 bg-white px-4 py-3">
            <span className="text-xs uppercase tracking-[0.16em] text-stone-500">Periode de facturation</span>
            <input
              type="month"
              value={toMonthInputValue(dmDraft.periodMonth)}
              onChange={(event) =>
                setDmDraft((current) => ({ ...current, periodMonth: event.target.value }))
              }
              className="mt-2 w-full bg-transparent text-sm font-semibold text-stone-950 outline-none"
            />
          </label>

          <div className="rounded-[20px] border border-stone-200 bg-white px-4 py-3">
            <span className="text-xs uppercase tracking-[0.16em] text-stone-500">Lots relies au decompte</span>
            <div className="mt-3 flex flex-wrap gap-2">
              {projectLots.map((lot) => (
                <span
                  key={lot}
                  className="rounded-full border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700"
                >
                  {lot}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <NumberField
              label="Avancement saisi (%)"
              value={dmDraft.progressPct}
              onChange={(value) => setDmDraft((current) => ({ ...current, progressPct: value }))}
            />
            <NumberField
              label="Base HT"
              value={dmDraft.baseAmountHt}
              onChange={(value) => setDmDraft((current) => ({ ...current, baseAmountHt: value }))}
            />
            <NumberField
              label="Retenue (%)"
              value={dmDraft.retentionPct}
              onChange={(value) => setDmDraft((current) => ({ ...current, retentionPct: value }))}
            />
            <NumberField
              label="Deduction avance"
              value={dmDraft.advanceDeduction}
              onChange={(value) =>
                setDmDraft((current) => ({ ...current, advanceDeduction: value }))
              }
            />
          </div>

          <button
            type="button"
            onClick={() => (canCreateInvoice ? onGenerate() : null)}
            disabled={!canCreateInvoice || pendingAction === "create-invoice"}
            className={cx(
              "flex w-full items-center justify-center gap-2 rounded-[20px] px-4 py-4 text-sm font-semibold",
              canCreateInvoice && pendingAction !== "create-invoice"
                ? "bg-black text-white hover:bg-stone-800"
                : "cursor-not-allowed bg-stone-200 text-stone-500",
            )}
          >
            <Receipt className="size-4" />
            {pendingAction === "create-invoice" ? "Generation en cours..." : "Generer la facture"}
          </button>
        </div>

        <div className="rounded-[22px] border border-stone-200 bg-stone-50 p-4">
          <p className="text-sm font-semibold text-stone-950">Synthese de calcul</p>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Controle rapide avant envoi vers le circuit de validation.
          </p>
          <div className="mt-4 space-y-3">
            <LineItem label="Base HT" value={formatCurrency(dmDraft.baseAmountHt)} />
            <LineItem
              label={`Retenue (${dmDraft.retentionPct}%)`}
              value={`- ${formatCurrency(draftValues.retentionAmount)}`}
            />
            <LineItem
              label="Deduction avance"
              value={`- ${formatCurrency(dmDraft.advanceDeduction)}`}
            />
            <LineItem
              label="HT apres deductions"
              value={formatCurrency(draftValues.amountAfterRetention)}
            />
            <LineItem
              label={`${vatRegime.label}`}
              value={formatCurrency(draftValues.tvaAmount)}
            />
            <div className="border-t border-stone-200 pt-3">
              <LineItem label="TTC" value={formatCurrency(draftValues.amountTtc)} emphasize />
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function FinanceTreasuryPulse({
  chartData,
  summary,
  treasuryAlert,
}: {
  chartData: Array<{ actual: number; costs: number; label: string; planned: number }>;
  summary: { actual: number; costs: number; delta: number; planned: number };
  treasuryAlert: string;
}) {
  const max = Math.max(
    ...chartData.flatMap((item) => [item.planned, item.actual, item.costs]),
    1,
  );

  return (
    <Panel
      title="Pulse tresorerie"
      description="Recettes prevues, recettes encaissees et couts reels restent visibles au meme endroit pour anticiper la tension."
    >
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="flex items-center gap-4 text-xs uppercase tracking-[0.16em] text-stone-500">
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-stone-300" />
              Prevues
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-sky-500" />
              Encaissees
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-amber-400" />
              Couts reels
            </span>
          </div>

          <div className="mt-4 grid grid-cols-5 gap-3">
            {chartData.map((item) => (
              <div key={item.label} className="space-y-3">
                <div className="flex h-48 items-end justify-center gap-2 rounded-[20px] border border-stone-200 bg-stone-50 px-3 pb-3 pt-5">
                  <div className="flex w-full items-end gap-2">
                    <div className="flex-1">
                      <div
                        className="w-full rounded-t-full bg-stone-300"
                        style={{ height: `${(item.planned / max) * 140}px` }}
                      />
                    </div>
                    <div className="flex-1">
                      <div
                        className="w-full rounded-t-full bg-sky-500"
                        style={{ height: `${(item.actual / max) * 140}px` }}
                      />
                    </div>
                    <div className="flex-1">
                      <div
                        className="w-full rounded-t-full bg-amber-400"
                        style={{ height: `${(item.costs / max) * 140}px` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-stone-950">{item.label}</p>
                  <p className="text-xs text-stone-500">
                    {item.actual}k encaisses / {item.costs}k couts
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <CompactSummaryCard label="Recettes prevues" value={`${summary.planned}k`} />
          <CompactSummaryCard label="Recettes encaissees" value={`${summary.actual}k`} />
          <CompactSummaryCard label="Couts reels" value={`${summary.costs}k`} />
          <CompactSummaryCard
            label="Balance nette"
            tone={summary.delta >= 0 ? "success" : "danger"}
            value={`${summary.delta >= 0 ? "+" : ""}${summary.delta}k`}
          />
          <InlineNotice tone={summary.delta >= 0 ? "neutral" : "warning"} title="Lecture tresorerie">
            {treasuryAlert}
          </InlineNotice>
        </div>
      </div>
    </Panel>
  );
}

function FinanceBillingQueue({
  activeFilter,
  invoices,
  onAction,
  onFilterChange,
  onRowClick,
}: {
  activeFilter: QueueFilter;
  invoices: QueueRecord[];
  onAction: (invoice: QueueRecord, nextTab: DrawerTab) => void;
  onFilterChange: (value: QueueFilter) => void;
  onRowClick: (invoiceId: string) => void;
}) {
  return (
    <Panel
      title="File active de facturation"
      description="La file devient la surface operationnelle centrale: on y voit la situation, le blocage, le reste a encaisser et l'action suivante."
    >
      <div className="flex flex-wrap gap-2">
        {queueFilters.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => onFilterChange(filter.key)}
            className={cx(
              "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition-colors",
              activeFilter === filter.key
                ? "border-black bg-black text-white"
                : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50",
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {invoices.length === 0 ? (
        <div className="mt-4">
          <EmptyStateCard
            title="Aucune facture dans cette vue"
            detail="Changez le filtre ou la periode pour retrouver la file active correspondante."
          />
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-[20px] border border-stone-200">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-stone-100 text-left text-[11px] uppercase tracking-[0.16em] text-stone-500">
                <tr>
                  <th className="px-3.5 py-2.5 font-semibold">Periode</th>
                  <th className="px-3.5 py-2.5 font-semibold">Projet</th>
                  <th className="px-3.5 py-2.5 font-semibold">Avancement</th>
                  <th className="px-3.5 py-2.5 font-semibold">Facture</th>
                  <th className="px-3.5 py-2.5 font-semibold">Statut</th>
                  <th className="px-3.5 py-2.5 font-semibold">Echeance</th>
                  <th className="px-3.5 py-2.5 font-semibold">Restant</th>
                  <th className="px-3.5 py-2.5 font-semibold">Paiement</th>
                  <th className="px-3.5 py-2.5 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {invoices.map((invoice) => {
                  const action = deriveQueueAction(invoice);
                  return (
                    <tr
                      key={invoice.id}
                      onClick={() => onRowClick(invoice.id)}
                      className="cursor-pointer border-t border-stone-100 align-top transition-colors hover:bg-stone-50"
                    >
                      <td className="px-3.5 py-3.5 text-sm text-stone-700">{formatDate(invoice.periodMonth)}</td>
                      <td className="px-3.5 py-3.5">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-stone-950">{invoice.project}</p>
                        </div>
                      </td>
                      <td className="px-3.5 py-3.5">
                        <div className="space-y-1.5">
                          <p className="text-sm font-semibold text-stone-950">{invoice.sourceProgress}%</p>
                          <ProgressBar value={invoice.sourceProgress} tone="primary" />
                        </div>
                      </td>
                      <td className="px-3.5 py-3.5">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-stone-950">{invoice.invoiceNumber}</p>
                          <p className="text-xs text-stone-500">{formatCurrency(invoice.amountTtc)} TTC</p>
                        </div>
                      </td>
                      <td className="px-3.5 py-3.5">
                        <div className="space-y-1.5">
                          <StatusBadge tone={getQueueStatusTone(invoice.displayStatus)}>
                            {invoice.displayStatus}
                          </StatusBadge>
                          <p className="max-w-[180px] text-xs leading-5 text-stone-500">{action.helper}</p>
                        </div>
                      </td>
                      <td className="px-3.5 py-3.5">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-stone-950">{formatDate(invoice.dueDate)}</p>
                          <p className={cx("text-xs", invoice.isOverdue ? "text-rose-600" : "text-stone-500")}>
                            {invoice.isOverdue ? `${invoice.overdueDays} j de retard` : timeAgo(invoice.dueDate)}
                          </p>
                        </div>
                      </td>
                      <td className="px-3.5 py-3.5">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-stone-950">
                            {formatCurrency(invoice.remainingAmount)}
                          </p>
                          <p className="text-xs text-stone-500">
                            HT {formatCurrency(invoice.amountHt)}
                          </p>
                        </div>
                      </td>
                      <td className="px-3.5 py-3.5">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-stone-500">
                            <span>{invoice.coverage}%</span>
                            <span>{formatCurrency(invoice.paidAmount)}</span>
                          </div>
                          <ProgressBar
                            value={invoice.coverage}
                            tone={invoice.coverage >= 100 ? "success" : invoice.isOverdue ? "danger" : "warning"}
                          />
                        </div>
                      </td>
                      <td className="px-3.5 py-3.5">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onAction(invoice, action.drawerTab);
                          }}
                          className="inline-flex items-center gap-2 rounded-[14px] border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-900 hover:bg-stone-100"
                        >
                          {action.label}
                          <ChevronRight className="size-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Panel>
  );
}

function FinanceCollectionsSection({
  agingBuckets,
  collectibleCount,
  focus,
  onOpenQueue,
  overdueCount,
  summary,
}: {
  agingBuckets: Array<{ key: string; label: string; tone: Tone; value: number }>;
  collectibleCount: number;
  focus: CollectionFocus | null;
  onOpenQueue: (filter: QueueFilter) => void;
  overdueCount: number;
  summary: { totalInvoiced: number; totalPaid: number; totalRemaining: number };
}) {
  return (
    <Panel
      title="Encaissements"
      description="Les encaissements sont resumes par anciennete et volume. Le detail operatoire reste dans la file active."
    >
      <div className="grid gap-3 md:grid-cols-4">
        {agingBuckets.map((bucket) => (
          <div key={bucket.key} className="rounded-[18px] border border-stone-200 bg-white p-3.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.16em] text-stone-500">{bucket.label}</p>
              <StatusBadge tone={bucket.tone}>{toneLabel(bucket.tone)}</StatusBadge>
            </div>
            <p className="mt-2.5 font-display text-[1.65rem] font-semibold leading-none text-stone-950">
              {formatCurrency(bucket.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <CompactSummaryCard label="Facture TTC" value={formatCurrency(summary.totalInvoiced)} />
        <CompactSummaryCard label="Encaisse" value={formatCurrency(summary.totalPaid)} tone="success" />
        <CompactSummaryCard label="Restant" value={formatCurrency(summary.totalRemaining)} tone="warning" />
      </div>

      {focus ? (
        <div className="mt-4 rounded-[18px] border border-stone-200 bg-white px-4 py-3.5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-stone-950">Priorite de relance</p>
                <StatusBadge tone={focus.tone}>
                  {focus.tone === "danger" ? "A traiter" : "A encaisser"}
                </StatusBadge>
              </div>
              <p className="mt-2 text-sm font-semibold text-stone-950">
                {focus.invoiceNumber} · {focus.project}
              </p>
              <p className="mt-1.5 text-sm leading-5 text-stone-600">{focus.helper}</p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold text-stone-950">{focus.amountLabel}</p>
              <button
                type="button"
                onClick={() => onOpenQueue(focus.filter)}
                className="rounded-[14px] border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm font-semibold text-stone-900 hover:bg-stone-100"
              >
                Ouvrir la file
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-[18px] border border-stone-200 bg-stone-50 px-4 py-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-stone-950">Lecture encaissements</p>
            <p className="mt-1.5 text-sm leading-5 text-stone-600">
              {overdueCount > 0
                ? `${overdueCount} retard(s) restent a relancer. Le detail des factures se traite dans la file active.`
                : "Les factures encaissables et les relances se traitent dans la file active pour eviter une seconde file de travail."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onOpenQueue("collectible")}
              className="rounded-[14px] border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-900 hover:bg-stone-100"
            >
              Voir les encaissements ({collectibleCount})
            </button>
            <button
              type="button"
              onClick={() => onOpenQueue("overdue")}
              className="rounded-[14px] border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-900 hover:bg-stone-100"
            >
              Voir les retards ({overdueCount})
            </button>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function FinanceDocumentsProofs({
  documents,
  onOpenDocumentsHub,
  proofSummary,
}: {
  documents: LinkedFinanceDocument[];
  onOpenDocumentsHub: () => void;
  proofSummary: ProofSummary;
}) {
  return (
    <Panel
      title="Documents & preuves"
      description="Les pieces finance restent visibles ici pour garder le cockpit pret a l'automatisation, sans transformer la page en GED."
      action={
        <button
          type="button"
          onClick={onOpenDocumentsHub}
          className="inline-flex items-center gap-2 rounded-[18px] border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-900 hover:bg-stone-50"
        >
          Ouvrir Module 6
          <FolderKanban className="size-4" />
        </button>
      }
    >
      <div className="mb-4 rounded-[18px] border border-stone-200 bg-stone-50 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-stone-950">Piste d&apos;audit</p>
            <p className="mt-1 text-xs leading-5 text-stone-600">
              Les preuves cle restent lisibles avant d&apos;ouvrir le detail facture.
            </p>
          </div>
          <StatusBadge
            tone={proofSummary.invoicePdfStatus === "Disponible" ? "success" : "warning"}
          >
            {proofSummary.invoicePdfStatus === "Disponible" ? "Pret" : "A completer"}
          </StatusBadge>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MiniStat label="Facture PDF" value={proofSummary.invoicePdfStatus} />
          <MiniStat label="DM" value={proofSummary.dmStatus} />
          <MiniStat label="Justificatifs" value={proofSummary.paymentProofStatus} />
          <MiniStat label="Rapports signes" value={proofSummary.signedReportsStatus} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {documents.map((document) => (
          <div key={document.id} className="rounded-[20px] border border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-stone-950">{document.kind}</p>
              <StatusBadge tone={document.status.includes("Disponible") ? "success" : "neutral"}>
                {document.status}
              </StatusBadge>
            </div>
            <p className="mt-3 text-sm leading-6 text-stone-600">{document.description}</p>
            <div className="mt-4">
              {document.url ? (
                <button
                  type="button"
                  onClick={() => openPdf(document.url)}
                  className="inline-flex items-center gap-2 rounded-[16px] border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-900 hover:bg-stone-100"
                >
                  {document.actionLabel}
                  <FileText className="size-4" />
                </button>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-[16px] border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-500">
                  {document.actionLabel}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function FinanceVatSection({
  declaration,
  selectedInvoice,
  setVatRegime,
  vatRegime,
}: {
  declaration: {
    month: string;
    collectedTva: number;
    declaredTva: number;
    variance: number;
    status: string;
  };
  selectedInvoice: InvoiceItem | undefined;
  setVatRegime: React.Dispatch<
    React.SetStateAction<{ id: string; label: string; rate: number; helper: string }>
  >;
  vatRegime: { id: string; label: string; rate: number; helper: string };
}) {
  return (
    <Panel title="TVA & declarations" description="La TVA reste visible et parametrable sans casser le flux principal de facturation.">
      <div className="flex flex-wrap gap-2">
        {financeVatRegimes.map((regime) => (
          <button
            key={regime.id}
            type="button"
            onClick={() => setVatRegime(regime)}
            className={cx(
              "rounded-full border px-3 py-2 text-sm font-semibold",
              vatRegime.id === regime.id
                ? "border-black bg-black text-white"
                : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50",
            )}
          >
            {regime.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[20px] border border-stone-200 bg-stone-50 p-4">
          <p className="text-sm font-semibold text-stone-950">Regime actif</p>
          <p className="mt-2 text-sm leading-6 text-stone-600">{vatRegime.helper}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MiniStat label="Taux" value={`${vatRegime.rate}%`} />
            <MiniStat
              label="Sur la facture suivie"
              value={
                selectedInvoice
                  ? formatCurrency(Math.round((selectedInvoice.amountHt * vatRegime.rate) / 100))
                  : "-"
              }
            />
          </div>
        </div>

        <div className="rounded-[20px] border border-stone-200 bg-white p-4">
          <div className="space-y-3">
            <LineItem label="Periode" value={declaration.month} />
            <LineItem label="TVA collectee" value={formatCurrency(declaration.collectedTva)} />
            <LineItem label="TVA declaree" value={formatCurrency(declaration.declaredTva)} />
            <LineItem label="Ecart" value={formatCurrency(declaration.variance)} />
            <div className="border-t border-stone-200 pt-3">
              <LineItem label="Statut" value={declaration.status} emphasize />
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function FinanceProfitabilitySection({
  summary,
}: {
  summary: {
    budget: number;
    gap: number;
    realCosts: number;
    risk: string;
    spentRatio: number;
    trend: string;
  };
}) {
  return (
    <Panel title="Rentabilite" description="Le cockpit garde la rentabilite visible pour arbitrer les relances, la TVA et la pression tresorerie.">
      <div className="grid gap-3 sm:grid-cols-2">
        <CompactSummaryCard label="Budget initial" value={formatCurrency(summary.budget)} />
        <CompactSummaryCard label="Cout reel" value={formatCurrency(summary.realCosts)} />
        <CompactSummaryCard
          label="Ecart budget / reel"
          tone={summary.gap >= 0 ? "success" : "danger"}
          value={formatCurrency(summary.gap)}
        />
        <CompactSummaryCard label="Tendance" value={summary.trend} tone={summary.trend === "Positive" ? "success" : "warning"} />
      </div>
      <div className="mt-4 rounded-[20px] border border-stone-200 bg-stone-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-stone-950">Couverture budget</p>
            <p className="mt-1 text-sm text-stone-600">{summary.risk}</p>
          </div>
          <StatusBadge tone={summary.spentRatio >= 95 ? "danger" : summary.spentRatio >= 80 ? "warning" : "success"}>
            {summary.spentRatio}%
          </StatusBadge>
        </div>
        <div className="mt-3">
          <ProgressBar
            value={Math.min(summary.spentRatio, 100)}
            tone={summary.spentRatio >= 95 ? "danger" : summary.spentRatio >= 80 ? "warning" : "success"}
          />
        </div>
      </div>
    </Panel>
  );
}

function FinanceArchivesSection({
  invoices,
  onSelectInvoice,
}: {
  invoices: QueueRecord[];
  onSelectInvoice: (invoiceId: string) => void;
}) {
  return (
    <Panel title="Archives" description="Les dossiers clos et litigieux restent consultables sans polluer la file active.">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {invoices.slice(0, 6).map((invoice) => (
          <button
            key={invoice.id}
            type="button"
            onClick={() => onSelectInvoice(invoice.id)}
            className="rounded-[20px] border border-stone-200 bg-white p-4 text-left transition-colors hover:bg-stone-50"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-stone-950">{invoice.invoiceNumber}</p>
              <StatusBadge tone={getQueueStatusTone(invoice.displayStatus)}>{invoice.displayStatus}</StatusBadge>
            </div>
            <p className="mt-2 text-sm text-stone-600">{invoice.project}</p>
            <p className="mt-3 text-xs text-stone-500">
              {formatCurrency(invoice.amountTtc)} · {formatDate(invoice.periodMonth)}
            </p>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function FinanceRightRail({
  alerts,
  healthSummary,
  myActions,
}: {
  alerts: Array<{ detail: string; label: string; tone: Tone }>;
  healthSummary: FinanceHealthSummary;
  myActions: Array<{ cta: string; detail: string; label: string; onClick: () => void; tone: Tone }>;
}) {
  return (
    <Panel
      title="Pilotage personnel"
      description="Vos actions, alertes et indicateurs de sante finance sont regroupes dans un rail plus compact."
      className="h-fit xl:sticky xl:top-24"
    >
      <div className="space-y-4">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-stone-950">Mes actions</p>
              <p className="mt-1 text-xs leading-5 text-stone-600">
                Validations, relances et paiements prioritaires.
              </p>
            </div>
            <StatusBadge tone="primary">{myActions.length} actives</StatusBadge>
          </div>
          <div className="space-y-3">
            {myActions.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                className="w-full rounded-[18px] border border-stone-200 bg-white p-3 text-left transition-colors hover:bg-stone-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-stone-950">{item.label}</p>
                  <StatusBadge tone={item.tone}>{toneLabel(item.tone)}</StatusBadge>
                </div>
                <p className="mt-2 text-xs leading-5 text-stone-600">{item.detail}</p>
                <p className="mt-3 text-sm font-semibold text-stone-900">{item.cta}</p>
              </button>
            ))}
          </div>
        </section>

        <div className="border-t border-stone-200" />

        <section className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-stone-950">Alertes</p>
            <p className="mt-1 text-xs leading-5 text-stone-600">
              Les exceptions sont isolees pour accelerer les arbitrages.
            </p>
          </div>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.label} className="rounded-[18px] border border-stone-200 bg-white p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className={cx("size-4", alert.tone === "danger" ? "text-rose-500" : "text-amber-500")} />
                  <p className="text-sm font-semibold text-stone-950">{alert.label}</p>
                </div>
                <p className="mt-2 text-xs leading-5 text-stone-600">{alert.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="border-t border-stone-200" />

        <section className="rounded-[18px] border border-stone-200 bg-stone-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-stone-950">Sante financiere</p>
              <p className="mt-1 text-xs leading-5 text-stone-600">
                Lecture synthese pour savoir quoi relancer et quel niveau de pression garder en tete.
              </p>
            </div>
            <StatusBadge tone={healthSummary.overdueAmount > 0 ? "warning" : "success"}>
              {healthSummary.overdueAmount > 0 ? "Sous tension" : "Stable"}
            </StatusBadge>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <CompactSummaryCard label="A encaisser" value={formatCurrency(healthSummary.remainingToCollect)} tone={healthSummary.remainingToCollect > 0 ? "warning" : "success"} />
            <CompactSummaryCard label="Montant en retard" value={formatCurrency(healthSummary.overdueAmount)} tone={healthSummary.overdueAmount > 0 ? "danger" : "success"} />
            <CompactSummaryCard label="TVA" value={healthSummary.vatStatus} />
            <CompactSummaryCard label="Rentabilite" value={healthSummary.profitabilityTrend} tone={healthSummary.profitabilityRisk === "Risque eleve" ? "danger" : healthSummary.profitabilityRisk === "Sous tension" ? "warning" : "success"} />
          </div>
        </section>
      </div>
    </Panel>
  );
}

function FinanceInvoiceDrawer({
  canRecordPayment,
  canSendInvoice,
  canUpdateStatus,
  downloadInvoicePdf,
  drawerTab,
  isOpen,
  linkedDocuments,
  manualStatusOptions,
  onClose,
  onOpenDocumentsHub,
  onRegisterPayment,
  onSendInvoice,
  onSetDrawerTab,
  onStatusChange,
  onUpdateStatus,
  onValidateInvoice,
  paymentActionHelper,
  paymentCoverage,
  paymentDraft,
  payments,
  pendingAction,
  proofSummary,
  selectedInvoice,
  selectedQueueRecord,
  sendInvoiceHelper,
  setPaymentDraft,
  statusActionHelper,
  statusValue,
  validationAction,
  workflowOwners,
  workflowSteps,
}: {
  canRecordPayment: boolean;
  canSendInvoice: boolean;
  canUpdateStatus: boolean;
  downloadInvoicePdf: (invoice: InvoiceItem) => void;
  drawerTab: DrawerTab;
  isOpen: boolean;
  linkedDocuments: LinkedFinanceDocument[];
  manualStatusOptions: string[];
  onClose: () => void;
  onOpenDocumentsHub: () => void;
  onRegisterPayment: (invoiceId: string) => void;
  onSendInvoice: (invoiceId: string) => void;
  onSetDrawerTab: (tab: DrawerTab) => void;
  onStatusChange: React.Dispatch<React.SetStateAction<string>>;
  onUpdateStatus: (invoiceId: string) => void;
  onValidateInvoice: (invoiceId: string) => void;
  paymentActionHelper: string;
  paymentCoverage: number;
  paymentDraft: {
    amount: string;
    method: string;
    reference: string;
  };
  payments: PaymentItem[];
  pendingAction: string;
  proofSummary: ProofSummary;
  selectedInvoice: InvoiceItem | undefined;
  selectedQueueRecord: QueueRecord | null;
  sendInvoiceHelper: string;
  setPaymentDraft: React.Dispatch<
    React.SetStateAction<{
      amount: string;
      method: string;
      reference: string;
    }>
  >;
  statusActionHelper: string;
  statusValue: string;
  validationAction: DrawerAction;
  workflowOwners: WorkflowOwnerDisplay;
  workflowSteps: FinanceWorkflowStep[];
}) {
  if (!isOpen || !selectedInvoice) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/25 backdrop-blur-sm">
      <button type="button" aria-label="Fermer" className="flex-1" onClick={onClose} />
      <div className="h-full w-full max-w-[560px] overflow-y-auto border-l border-stone-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-2xl font-semibold text-stone-950">
                  {selectedInvoice.invoiceNumber}
                </h3>
                <StatusBadge tone={selectedQueueRecord ? getQueueStatusTone(selectedQueueRecord.displayStatus) : selectedInvoice.tone}>
                  {selectedQueueRecord?.displayStatus ?? selectedInvoice.status}
                </StatusBadge>
              </div>
              <p className="mt-2 text-sm text-stone-600">{selectedInvoice.project}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-stone-500">
                Couverture paiement {paymentCoverage}%
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-stone-200 p-2 text-stone-500 hover:bg-stone-50"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { key: "summary", label: "Resume" },
              { key: "workflow", label: "Workflow" },
              { key: "payments", label: "Paiements" },
              { key: "documents", label: "Documents" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => onSetDrawerTab(tab.key as DrawerTab)}
                className={cx(
                  "rounded-full border px-3 py-2 text-sm font-semibold",
                  drawerTab === tab.key
                    ? "border-black bg-black text-white"
                    : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          {drawerTab === "summary" ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <CompactSummaryCard label="HT" value={formatCurrency(selectedInvoice.amountHt)} />
                <CompactSummaryCard label="Retenue" value={formatCurrency(selectedInvoice.retentionAmount)} />
                <CompactSummaryCard label="Deduction avance" value={formatCurrency(selectedInvoice.advanceDeduction)} />
                <CompactSummaryCard label="TVA" value={formatCurrency(selectedInvoice.tvaAmount)} />
                <CompactSummaryCard label="TTC" value={formatCurrency(selectedInvoice.amountTtc)} />
                <CompactSummaryCard label="Restant du" value={formatCurrency(selectedQueueRecord?.remainingAmount ?? 0)} tone={selectedQueueRecord?.remainingAmount ? "warning" : "success"} />
              </div>
              <div className="rounded-[20px] border border-stone-200 bg-stone-50 p-4">
                <p className="text-sm font-semibold text-stone-950">Lecture rapide</p>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  {selectedQueueRecord?.displayStatus === "En retard"
                    ? `Cette facture est en retard de ${selectedQueueRecord.overdueDays} jour(s).`
                    : "Le parcours financier est visible ci-dessous avec un suivi clair du restant a encaisser."}
                </p>
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.14em] text-stone-500">
                    <span>Couverture de paiement</span>
                    <span>{paymentCoverage}%</span>
                  </div>
                  <ProgressBar
                    value={paymentCoverage}
                    tone={paymentCoverage >= 100 ? "success" : selectedQueueRecord?.isOverdue ? "danger" : "warning"}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {drawerTab === "workflow" ? (
            <div className="space-y-4">
              <div className="space-y-3">
                {workflowSteps.map((step) => (
                  <div
                    key={step.title}
                    className={cx(
                      "rounded-[18px] border p-4",
                      step.state === "current"
                        ? "border-sky-200 bg-sky-50"
                        : step.state === "done"
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-stone-200 bg-stone-50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-stone-950">{step.title}</p>
                      <StatusBadge tone={step.tone}>{step.badge}</StatusBadge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-stone-600">{step.detail}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-[20px] border border-stone-200 bg-white p-4">
                <p className="text-sm font-semibold text-stone-950">Responsables affectes</p>
                <div className="mt-3 space-y-2 text-sm text-stone-600">
                  <p>Projet · {workflowOwners.projectManagerId?.name ?? "Non affecte"}</p>
                  <p>Finance · {workflowOwners.financeLeadId?.name ?? "Non affecte"}</p>
                  <p>Client · {workflowOwners.clientApproverId?.name ?? "Non affecte"}</p>
                </div>
              </div>

              <div className="rounded-[20px] border border-stone-200 bg-stone-50 p-4">
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.14em] text-stone-500">Ajustement manuel</span>
                  <select
                    value={statusValue}
                    onChange={(event) => onStatusChange(event.target.value)}
                    disabled={!manualStatusOptions.length || !canUpdateStatus || pendingAction === "update-invoice-status"}
                    title={statusActionHelper}
                    className="mt-3 w-full rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-900 outline-none"
                  >
                    {manualStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="mt-3 text-xs leading-5 text-stone-500">{statusActionHelper}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => (canUpdateStatus ? onUpdateStatus(selectedInvoice.id) : null)}
                    disabled={!canUpdateStatus || pendingAction === "update-invoice-status"}
                    className={cx(
                      "rounded-[16px] px-4 py-3 text-sm font-semibold",
                      canUpdateStatus && pendingAction !== "update-invoice-status"
                        ? "border border-stone-200 bg-white text-stone-900 hover:bg-stone-50"
                        : "cursor-not-allowed border border-stone-200 bg-stone-100 text-stone-400",
                    )}
                  >
                    {pendingAction === "update-invoice-status" ? "Mise a jour..." : "Mettre a jour"}
                  </button>
                  <button
                    type="button"
                    onClick={() => (canSendInvoice ? onSendInvoice(selectedInvoice.id) : null)}
                    disabled={!canSendInvoice || pendingAction === "send-invoice"}
                    title={sendInvoiceHelper}
                    className={cx(
                      "inline-flex items-center gap-2 rounded-[16px] px-4 py-3 text-sm font-semibold",
                      canSendInvoice && pendingAction !== "send-invoice"
                        ? "border border-stone-200 bg-white text-stone-900 hover:bg-stone-50"
                        : "cursor-not-allowed border border-stone-200 bg-stone-100 text-stone-400",
                    )}
                  >
                    <Send className="size-4" />
                    {pendingAction === "send-invoice" ? "Envoi..." : "Envoyer la facture"}
                  </button>
                  <button
                    type="button"
                    onClick={() => (validationAction.canRun ? onValidateInvoice(selectedInvoice.id) : null)}
                    disabled={!validationAction.canRun || pendingAction === "validate-invoice"}
                    title={validationAction.helper}
                    className={cx(
                      "inline-flex items-center gap-2 rounded-[16px] px-4 py-3 text-sm font-semibold",
                      validationAction.canRun && pendingAction !== "validate-invoice"
                        ? "bg-black text-white hover:bg-stone-800"
                        : "cursor-not-allowed bg-stone-200 text-stone-500",
                    )}
                  >
                    <CheckCheck className="size-4" />
                    {pendingAction === "validate-invoice" ? "Validation..." : validationAction.label}
                  </button>
                  {selectedInvoice.pdfUrl ? (
                    <button
                      type="button"
                      onClick={() => downloadInvoicePdf(selectedInvoice)}
                      className="inline-flex items-center gap-2 rounded-[16px] border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-900 hover:bg-stone-50"
                    >
                      <FileText className="size-4" />
                      Telecharger le PDF
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {drawerTab === "payments" ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <CompactSummaryCard label="Paiements saisis" value={String(payments.length)} />
                <CompactSummaryCard
                  label="Restant"
                  value={formatCurrency(selectedQueueRecord?.remainingAmount ?? 0)}
                  tone={selectedQueueRecord?.remainingAmount ? "warning" : "success"}
                />
              </div>

              <div className="space-y-3">
                {payments.length ? (
                  payments.map((payment) => (
                    <div key={payment.id} className="rounded-[18px] border border-stone-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-stone-950">{formatCurrency(payment.amount)}</p>
                        <p className="text-xs text-stone-500">{formatDate(payment.paidAt)}</p>
                      </div>
                      <p className="mt-2 text-sm text-stone-600">
                        {payment.method} · {payment.reference}
                      </p>
                    </div>
                  ))
                ) : (
                  <EmptyStateCard
                    title="Aucun paiement enregistre"
                    detail="Le paiement sera visible ici des qu'un encaissement sera saisi sur cette facture."
                  />
                )}
              </div>

              <div className="rounded-[20px] border border-stone-200 bg-stone-50 p-4">
                <div className="space-y-4">
                  <Field
                    label="Montant recu"
                    value={paymentDraft.amount}
                    onChange={(value) =>
                      setPaymentDraft((current) => ({ ...current, amount: value }))
                    }
                  />
                  <Field
                    label="Mode"
                    value={paymentDraft.method}
                    onChange={(value) =>
                      setPaymentDraft((current) => ({ ...current, method: value }))
                    }
                  />
                  <Field
                    label="Reference paiement"
                    value={paymentDraft.reference}
                    onChange={(value) =>
                      setPaymentDraft((current) => ({ ...current, reference: value }))
                    }
                  />
                </div>
                <button
                  type="button"
                  onClick={() => (canRecordPayment ? onRegisterPayment(selectedInvoice.id) : null)}
                  disabled={!canRecordPayment || pendingAction === "register-payment"}
                  title={paymentActionHelper}
                  className={cx(
                    "mt-4 flex w-full items-center justify-center gap-2 rounded-[20px] px-4 py-4 text-sm font-semibold",
                    canRecordPayment && pendingAction !== "register-payment"
                      ? "bg-black text-white hover:bg-stone-800"
                      : "cursor-not-allowed bg-stone-200 text-stone-500",
                  )}
                >
                  <Landmark className="size-4" />
                  {pendingAction === "register-payment" ? "Enregistrement..." : "Enregistrer le paiement"}
                </button>
                <p className="mt-3 text-xs leading-5 text-stone-500">{paymentActionHelper}</p>
              </div>
            </div>
          ) : null}

          {drawerTab === "documents" ? (
            <div className="space-y-4">
              <div className="rounded-[18px] border border-stone-200 bg-stone-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-stone-950">Piste d&apos;audit facture</p>
                    <p className="mt-1 text-xs leading-5 text-stone-600">
                      Verifiez rapidement si le dossier est complet avant partage ou controle.
                    </p>
                  </div>
                  <StatusBadge
                    tone={proofSummary.invoicePdfStatus === "Disponible" ? "success" : "warning"}
                  >
                    {proofSummary.invoicePdfStatus === "Disponible" ? "Pret" : "A completer"}
                  </StatusBadge>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <CompactSummaryCard label="Facture PDF" value={proofSummary.invoicePdfStatus} />
                  <CompactSummaryCard label="DM" value={proofSummary.dmStatus} />
                  <CompactSummaryCard label="Justificatifs" value={proofSummary.paymentProofStatus} />
                  <CompactSummaryCard label="Rapports signes" value={proofSummary.signedReportsStatus} />
                </div>
              </div>

              <div className="grid gap-3">
                {linkedDocuments.map((document) => (
                  <div key={document.id} className="rounded-[18px] border border-stone-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-stone-950">{document.kind}</p>
                        <p className="mt-2 text-sm leading-6 text-stone-600">{document.description}</p>
                      </div>
                      <StatusBadge tone={document.status.includes("Disponible") ? "success" : "neutral"}>
                        {document.status}
                      </StatusBadge>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {document.url ? (
                        <button
                          type="button"
                          onClick={() => openPdf(document.url)}
                          className="inline-flex items-center gap-2 rounded-[16px] border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-900 hover:bg-stone-100"
                        >
                          {document.actionLabel}
                          <FileBadge2 className="size-4" />
                        </button>
                      ) : null}
                      {document.kind === "Rapports signes" ? (
                        <button
                          type="button"
                          onClick={onOpenDocumentsHub}
                          className="inline-flex items-center gap-2 rounded-[16px] border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-900 hover:bg-stone-50"
                        >
                          Ouvrir Module 6
                          <FolderKanban className="size-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CompactSummaryCard({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: Tone;
  value: string;
}) {
  return (
    <div className="rounded-[16px] border border-stone-200 bg-white px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.14em] text-stone-500">{label}</p>
        {tone !== "neutral" ? <StatusBadge tone={tone}>{toneLabel(tone)}</StatusBadge> : null}
      </div>
      <p className="mt-2 text-base font-semibold text-stone-950">{value}</p>
    </div>
  );
}

function isFinanceTab(value: string | null): value is FinanceTab {
  return value === "dm" || value === "invoices" || value === "vat" || value === "cashflow";
}

function isFinanceSection(value: string | null): value is FinanceSectionId {
  return (
    value === "overview" ||
    value === "billing" ||
    value === "collections" ||
    value === "treasury" ||
    value === "vat" ||
    value === "profitability" ||
    value === "documents" ||
    value === "archives"
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
    <label className="block rounded-[18px] border border-stone-200 bg-white px-4 py-3">
      <span className="text-xs uppercase tracking-[0.16em] text-stone-500">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full bg-transparent text-sm text-stone-900 outline-none"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded-[18px] border border-stone-200 bg-white px-4 py-3">
      <span className="text-xs uppercase tracking-[0.16em] text-stone-500">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full bg-transparent text-sm font-semibold text-stone-950 outline-none"
      />
    </label>
  );
}

function LineItem({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className={cx("text-sm text-stone-600", emphasize && "font-semibold text-stone-950")}>
        {label}
      </p>
      <p className={cx("text-sm text-stone-950", emphasize && "font-semibold")}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.14em] text-stone-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-stone-950">{value}</p>
    </div>
  );
}

function mapTabToSection(tab: FinanceTab): FinanceSectionId {
  switch (tab) {
    case "cashflow":
      return "treasury";
    case "vat":
      return "vat";
    case "invoices":
      return "billing";
    case "dm":
    default:
      return "overview";
  }
}

function mapSectionToTab(section: FinanceSectionId): FinanceTab {
  switch (section) {
    case "billing":
    case "documents":
    case "archives":
      return "invoices";
    case "vat":
      return "vat";
    case "collections":
    case "treasury":
    case "profitability":
      return "cashflow";
    case "overview":
    default:
      return "dm";
  }
}

function deriveQueueAction(invoice: QueueRecord) {
  if (invoice.displayStatus === "Litigieuse") {
    return {
      drawerTab: "workflow" as DrawerTab,
      helper: "Litige ouvert: verifier les validations, les preuves et la prochaine relance a engager.",
      label: "Suivre le litige",
    };
  }

  if (invoice.displayStatus === "En retard") {
    return {
      drawerTab: "payments" as DrawerTab,
      helper: `Encaissement depasse de ${invoice.overdueDays} jour(s). Relance a prioriser.`,
      label: "Relancer",
    };
  }

  if (invoice.status === "Brouillon") {
    return {
      drawerTab: "workflow" as DrawerTab,
      helper: "Brouillon non envoye: le PDF doit partir avant toute validation.",
      label: "Envoyer",
    };
  }

  if (!invoice.validatedByMoe) {
    return {
      drawerTab: "workflow" as DrawerTab,
      helper: "Bloquee cote projet tant que la validation interne n'est pas recue.",
      label: "Validation projet",
    };
  }

  if (!invoice.validatedByMo) {
    return {
      drawerTab: "workflow" as DrawerTab,
      helper: "Bloquee cote client tant que la validation finale n'est pas recue.",
      label: "Validation client",
    };
  }

  if (invoice.remainingAmount > 0) {
    return {
      drawerTab: "payments" as DrawerTab,
      helper:
        invoice.coverage > 0
          ? `Paiement partiel saisi. ${formatCurrency(invoice.remainingAmount)} restent a encaisser.`
          : "Facture validee prete pour saisie ou suivi d'encaissement.",
      label: "Paiement recu",
    };
  }

  return {
    drawerTab: "summary" as DrawerTab,
    helper: "La facture est cloturee et archivable.",
    label: "Voir le dossier",
  };
}

function getQueuePriority(invoice: QueueRecord) {
  if (invoice.displayStatus === "Litigieuse") {
    return 0;
  }

  if (invoice.isOverdue) {
    return 1;
  }

  if (invoice.displayStatus === "Validation client") {
    return 2;
  }

  if (invoice.displayStatus === "Validation projet") {
    return 3;
  }

  if (invoice.status === "Brouillon") {
    return 4;
  }

  if (invoice.isPartial) {
    return 5;
  }

  if (invoice.remainingAmount > 0) {
    return 6;
  }

  return 7;
}

function buildFinanceAlerts(queueRecords: QueueRecord[], treasuryAlert: string) {
  const alerts: Array<{ detail: string; label: string; tone: Tone }> = [];
  const overdueInvoices = queueRecords.filter((invoice) => invoice.isOverdue);
  const overdueAmount = overdueInvoices.reduce((sum, invoice) => sum + invoice.remainingAmount, 0);

  if (overdueInvoices.length > 0) {
    alerts.push({
      detail: `${overdueInvoices.length} facture(s) depassent l'echeance pour ${formatCurrency(overdueAmount)} a relancer.`,
      label: "Retard d'encaissement",
      tone: "danger",
    });
  }

  alerts.push({
    detail: treasuryAlert,
    label: "Tension tresorerie",
    tone: overdueInvoices.length > 0 ? "warning" : "primary",
  });

  const disputedInvoices = queueRecords.filter((invoice) => invoice.status === "Litigieuse");
  if (disputedInvoices.length > 0) {
    alerts.push({
      detail: `${disputedInvoices.length} facture(s) sont en litige et bloquent la collecte.`,
      label: "Factures litigieuses",
      tone: "danger",
    });
  }

  return alerts.slice(0, 3);
}

