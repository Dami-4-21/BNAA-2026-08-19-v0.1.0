"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  BadgePercent,
  CheckCheck,
  CircleDollarSign,
  FileText,
  Landmark,
  Receipt,
  Send,
  Wallet,
} from "lucide-react";

import {
  MetricCard,
  Panel,
  ProgressBar,
  SectionHeading,
  SimpleBarChart,
  StatusBadge,
  type Tone,
  cx,
} from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  financeVatRegimes,
} from "@/lib/mock-data";
import { apiFetch } from "@/lib/api";
import type { FinanceModuleData as FinancePayload } from "@/lib/backend/types";
import { useWorkspace } from "@/components/workspace-context";

type FinanceTab = "dm" | "invoices" | "vat" | "cashflow";
type ActiveTone = "primary" | "success" | "warning" | "danger";

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
  tone: ActiveTone;
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
  targetTab: FinanceTab;
  title: string;
  tone: Tone;
};

const allManualInvoiceStatuses = [
  "Brouillon",
  "Envoyee",
  "Validation MO",
  "Validee",
  "Payee",
  "Litigieuse",
] as const;

const tabs: Array<{ key: FinanceTab; label: string; helper: string }> = [
  {
    key: "dm",
    label: "Decompte",
    helper: "Preparation du mois",
  },
  {
    key: "invoices",
    label: "Validation",
    helper: "Envoi, circuit et PDF",
  },
  {
    key: "vat",
    label: "TVA",
    helper: "Regime et declaration",
  },
  {
    key: "cashflow",
    label: "Paiement",
    helper: "Encaissement et tresorerie",
  },
];

const metricIcons = [Wallet, Receipt, CircleDollarSign, BadgePercent];

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
        targetTab: "dm",
        title: "1. Preparer le decompte",
        tone: "primary",
      },
      {
        badge: "Attente",
        detail: "La facture sera envoyee une fois le decompte genere.",
        state: "pending",
        targetTab: "invoices",
        title: "2. Envoyer",
        tone: "neutral" as ActiveTone,
      },
      {
        badge: "Attente",
        detail: `La validation projet sera demandee a ${projectApproverName}.`,
        state: "pending",
        targetTab: "invoices",
        title: "3. Validation projet",
        tone: "neutral" as ActiveTone,
      },
      {
        badge: "Attente",
        detail: `La validation client sera ensuite demandee a ${clientApproverName}.`,
        state: "pending",
        targetTab: "invoices",
        title: "4. Validation client",
        tone: "neutral" as ActiveTone,
      },
      {
        badge: "Attente",
        detail: "Le paiement pourra etre saisi uniquement apres les validations.",
        state: "pending",
        targetTab: "cashflow",
        title: "5. Paiement recu",
        tone: "neutral" as ActiveTone,
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
      targetTab: "dm",
      title: "1. Preparer le decompte",
      tone: "success",
    },
    {
      badge: sent ? "Envoyee" : "A envoyer",
      detail: sent
        ? "La facture est sortie du brouillon et le PDF peut etre partage ou regenere."
        : "Le PDF doit etre genere puis envoye pour lancer le circuit de validation.",
      state: sent ? "done" : "current",
      targetTab: "invoices",
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
      targetTab: "invoices",
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
      targetTab: "invoices",
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
      targetTab: "cashflow",
      title: "5. Paiement recu",
      tone: paid ? "success" : clientValidated ? "primary" : "neutral",
    },
  ];
}

export function FinanceModule() {
  const { activeProject, can, currentUser } = useWorkspace();
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
      </div>
    );
  }

  if (!projectData) {
    return (
      <div className="space-y-6">
        <SectionHeading eyebrow="Finance" title="La finance est indisponible" />
        <Panel>{error}</Panel>
      </div>
    );
  }

  return (
    <FinanceModuleContent
      key={activeProject.id}
      activeProjectId={activeProject.id}
      canCreateInvoice={canCreateInvoice}
      canRecordPayment={canRecordPayment}
      canSendInvoice={canSendInvoice}
      currentUserId={currentUser.id}
      canValidateInvoice={canValidateInvoice}
      currentUserRole={currentUser.role}
      projectData={projectData}
    />
  );
}

function FinanceModuleContent({
  activeProjectId,
  canCreateInvoice,
  canRecordPayment,
  canSendInvoice,
  currentUserId,
  canValidateInvoice,
  currentUserRole,
  projectData,
}: {
  activeProjectId: string;
  canCreateInvoice: boolean;
  canRecordPayment: boolean;
  canSendInvoice: boolean;
  currentUserId: string;
  canValidateInvoice: boolean;
  currentUserRole: string;
  projectData: FinancePayload;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<FinanceTab>("dm");
  const [overview, setOverview] = useState(projectData.overview);
  const [invoices, setInvoices] = useState<InvoiceItem[]>(projectData.invoices);
  const [payments, setPayments] = useState<PaymentItem[]>(projectData.payments);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(
    projectData.invoices[0]?.id ?? "",
  );
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
  const selectedInvoice =
    invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? invoices[0];
  const paymentDraftInvoiceRef = useRef("");
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
  const projectApproverName = workflowOwners.projectManagerId?.name ?? "le chef de projet";
  const clientApproverName = workflowOwners.clientApproverId?.name ?? "le maitre d'ouvrage";
  const financeLeadName = workflowOwners.financeLeadId?.name ?? "le referent finance";
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
  const paymentCoverage = selectedInvoice
    ? Math.round(
        ((selectedInvoice.status === "Payee"
          ? selectedInvoice.amountTtc
          : payments
              .filter((payment) => payment.invoiceId === selectedInvoice.id)
              .reduce((sum, payment) => sum + payment.amount, 0)) /
          Math.max(selectedInvoice.amountTtc, 1)) *
          100,
      )
    : 0;
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
  const currentWorkflowStep =
    workflowSteps.find((step) => step.state === "current") ??
    workflowSteps.find((step) => step.state === "blocked") ??
    workflowSteps[0];

  useEffect(() => {
    if (!selectedInvoice) {
      paymentDraftInvoiceRef.current = "";
      return;
    }

    if (paymentDraftInvoiceRef.current === selectedInvoice.id) {
      return;
    }

    paymentDraftInvoiceRef.current = selectedInvoice.id;
    const paidAmount = payments
      .filter((payment) => payment.invoiceId === selectedInvoice.id)
      .reduce((total, payment) => total + payment.amount, 0);
    const remainingAmount = Math.max(selectedInvoice.amountTtc - paidAmount, 0);

    setPaymentDraft((current) => ({
      amount: remainingAmount > 0 ? String(remainingAmount) : "",
      method: current.method || "Virement",
      reference: "",
    }));
  }, [payments, selectedInvoice]);

  const validationAction = useMemo(() => {
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
  const financeActionCard = !selectedInvoice
    ? {
        action: () => (canCreateInvoice ? selectTab("dm") : null),
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
              tone: canRegisterPaymentForSelectedInvoice ? ("success" as Tone) : ("neutral" as Tone),
            }
          : {
              action: () => selectTab("cashflow", selectedInvoice.id),
              canRun: true,
              helper: "La facture est cloturee. Ouvrez le suivi de tresorerie pour l'historique.",
              label: "Voir le paiement",
              tone: "success" as Tone,
            };

  function replaceModuleUrl(nextTab: FinanceTab, invoiceId?: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    if (invoiceId) {
      params.set("invoice", invoiceId);
    } else {
      params.delete("invoice");
    }

    const query = params.toString();
    const nextUrl = query ? `${pathname}?${query}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }

  function selectTab(nextTab: FinanceTab, invoiceId?: string) {
    setActiveTab(nextTab);
    replaceModuleUrl(
      nextTab,
      nextTab === "invoices" || nextTab === "vat" || nextTab === "cashflow"
        ? (invoiceId ?? selectedInvoice?.id)
        : undefined,
    );
  }

  useEffect(() => {
    invoicesRef.current = invoices;
  }, [invoices]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    const invoiceId = searchParams.get("invoice");
    const nextInvoice =
      invoiceId && invoicesRef.current.some((invoice) => invoice.id === invoiceId)
        ? invoicesRef.current.find((invoice) => invoice.id === invoiceId)
        : undefined;

    startTransition(() => {
      if (tab && tabs.some((item) => item.key === tab)) {
        setActiveTab(tab as FinanceTab);
      }

      if (invoiceId && nextInvoice) {
        setSelectedInvoiceId(invoiceId);
        setStatusDraft(nextInvoice.status);
      }
    });
  }, [searchParams]);

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
      const nextData = await runFinanceAction("create-invoice", {
        dmDraft,
        vatRegimeId: vatRegime.id,
      }, "create-invoice");
      const nextInvoiceId = nextData.invoices[0]?.id ?? "";
      setSelectedInvoiceId(nextInvoiceId);
      if (nextData.invoices[0]) {
        setStatusDraft(nextData.invoices[0].status);
      }
      selectTab("invoices", nextInvoiceId);
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
      const nextInvoice = nextData.invoices.find((invoice) => invoice.id === invoiceId) as
        | InvoiceItem
        | undefined;
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
      await runFinanceAction("register-payment", {
        invoiceId,
        paymentDraft,
      }, "register-payment");
      selectTab("cashflow");
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Paiement impossible.");
    }
  }

  async function updateInvoiceStatus(invoiceId: string) {
    try {
      await runFinanceAction("update-invoice-status", {
        invoiceId,
        status: statusDraft,
      }, "update-invoice-status");
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Statut impossible.");
    }
  }

  function handleSelectInvoice(invoiceId: string) {
    const nextInvoice = invoices.find((invoice) => invoice.id === invoiceId);
    setSelectedInvoiceId(invoiceId);
    if (nextInvoice) {
      setStatusDraft(nextInvoice.status);
    }
    replaceModuleUrl(activeTab, invoiceId);
  }

  function downloadInvoicePdf(invoice: InvoiceItem) {
    openPdf(invoice.pdfUrl);
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Finance"
        title="Facturation, encaissements et tresorerie"
        action={
          <button
            onClick={() => (canCreateInvoice ? selectTab("dm") : null)}
            disabled={!canCreateInvoice || Boolean(pendingAction)}
            title={createInvoiceHelper}
            className={cx(
              "rounded-2xl px-4 py-3 text-sm font-semibold",
              canCreateInvoice && !pendingAction
                ? "bg-black text-white hover:bg-stone-800"
                : "cursor-not-allowed bg-stone-200 text-stone-500",
            )}
          >
            Nouveau decompte
          </button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-4">
        {overview.kpis.map((metric, index) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            helper={metric.helper}
            tone={metric.tone}
            icon={metricIcons[index]}
          />
        ))}
      </div>

      {!canCreateInvoice || !canSendInvoice || !canValidateInvoice || !canRecordPayment ? (
        <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm leading-6 text-stone-600">
          Votre role <span className="font-semibold text-stone-950">{currentUserRole}</span> peut
          consulter la finance, avec des droits adaptes pour creer, valider par etapes ou enregistrer les paiements.
        </div>
      ) : null}

      {mutationError ? (
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-6 text-rose-700">
          {mutationError}
        </div>
      ) : null}

      {pendingAction ? (
        <div className="rounded-[22px] border border-sky-200 bg-sky-50 px-4 py-4 text-sm leading-6 text-sky-800">
          Mise a jour finance en cours. Les actions critiques se reactiveront une fois le traitement termine.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <Panel
          title="Parcours facture"
          description="Une lecture simple pour savoir ou en est la facture et quelle etape reste a traiter."
        >
          <div className="space-y-3">
            {workflowSteps.map((step) => (
              <button
                key={step.title}
                type="button"
                onClick={() => selectTab(step.targetTab, selectedInvoice?.id)}
                className={cx(
                  "flex w-full flex-col gap-3 rounded-[22px] border p-4 text-left transition-colors md:flex-row md:items-center md:justify-between",
                  step.state === "current"
                    ? "border-sky-200 bg-sky-50 text-sky-950"
                    : step.state === "done"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                      : "border-stone-200 bg-stone-50 text-stone-900 hover:bg-white",
                )}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{step.title}</p>
                    <StatusBadge tone={step.tone}>{step.badge}</StatusBadge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-current/80">{step.detail}</p>
                </div>
                <span className="text-sm font-semibold text-current/70">Ouvrir</span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel
          title="Prochaine etape"
          description="L'action principale reste seule au premier plan pour eviter les allers-retours dans le circuit finance."
        >
          <div className="rounded-[24px] border border-stone-200 bg-black p-5 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-white/60">Etape active</p>
                <p className="mt-2 font-display text-2xl font-semibold">{currentWorkflowStep?.title ?? "Parcours finance"}</p>
              </div>
              <StatusBadge tone={financeActionCard.tone}>{toneLabel(financeActionCard.tone)}</StatusBadge>
            </div>
            <p className="mt-4 text-sm leading-6 text-white/75">{financeActionCard.helper}</p>
            <button
              type="button"
              onClick={financeActionCard.action}
              disabled={!financeActionCard.canRun}
              title={financeActionCard.helper}
              className={cx(
                "mt-5 flex w-full items-center justify-center gap-2 rounded-[20px] px-4 py-4 text-sm font-semibold",
                financeActionCard.canRun
                  ? "bg-white text-stone-950 hover:bg-stone-100"
                  : "cursor-not-allowed bg-white/10 text-white/45",
              )}
            >
              {financeActionCard.label}
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Facture suivie</p>
              <p className="mt-3 text-sm font-semibold text-stone-950">
                {selectedInvoice?.invoiceNumber ?? "Aucune facture"}
              </p>
              <p className="mt-2 text-xs leading-5 text-stone-600">
                {selectedInvoice
                  ? `${selectedInvoice.status} - ${formatCurrency(selectedInvoice.amountTtc)} TTC`
                  : "Commencez par preparer un decompte pour ouvrir le circuit."}
              </p>
            </div>
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Bloquant actuel</p>
              <p className="mt-3 text-sm font-semibold text-stone-950">{currentWorkflowStep?.badge ?? "Aucun"}</p>
              <p className="mt-2 text-xs leading-5 text-stone-600">{currentWorkflowStep?.detail ?? "Le circuit finance est stable."}</p>
            </div>
          </div>
        </Panel>
      </div>

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
              {activeTab === "dm" ? (
                <DecompteTab
                  canCreateInvoice={canCreateInvoice}
                  dmDraft={dmDraft}
                  setDmDraft={setDmDraft}
                  availableLots={projectData.projectSetup.lots}
                  vatRegime={vatRegime}
                  draftValues={draftValues}
                  pendingAction={pendingAction}
                  generateMonthlyStatement={generateMonthlyStatement}
                />
              ) : null}

              {activeTab === "invoices" ? (
                <InvoicesTab
                  canRecordPayment={canRegisterPaymentForSelectedInvoice}
                  paymentActionHelper={paymentActionHelper}
                  canSendInvoice={canSendInvoice}
                  sendInvoiceHelper={sendInvoiceHelper}
                  canUpdateStatus={canApplyStatusUpdate}
                  statusActionHelper={statusActionHelper}
                  manualStatusOptions={manualStatusOptions}
                  invoices={invoices}
                  selectedInvoiceId={selectedInvoiceId}
                  selectInvoice={handleSelectInvoice}
                  selectedInvoice={selectedInvoice}
                  paymentCoverage={paymentCoverage}
                  projectMembers={projectData.projectMembers}
                  workflowOwners={workflowOwners}
                  sendInvoice={sendInvoice}
                  statusValue={selectedStatusValue}
                  setStatusDraft={setStatusDraft}
                  updateInvoiceStatus={updateInvoiceStatus}
                  validateInvoice={validateInvoice}
                  validationAction={validationAction}
                  workflowSteps={workflowSteps}
                  pendingAction={pendingAction}
                  downloadInvoicePdf={downloadInvoicePdf}
                  paymentDraft={paymentDraft}
                  setPaymentDraft={setPaymentDraft}
                  registerPayment={registerPayment}
                />
              ) : null}

              {activeTab === "vat" ? (
                <VatTab
                  vatRegime={vatRegime}
                  setVatRegime={setVatRegime}
                  selectedInvoice={selectedInvoice}
                  declaration={declaration}
                />
              ) : null}

              {activeTab === "cashflow" ? (
                <CashflowTab
                  invoices={invoices}
                  payments={payments}
                  cashflowData={cashflowData}
                />
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            <Panel
              title="Synthese facture selectionnee"
            >
              {selectedInvoice ? (
                <div className="rounded-[24px] border border-white/8 bg-white/4 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-display text-2xl font-semibold text-white">
                        {selectedInvoice.invoiceNumber}
                      </p>
                      <p className="mt-1 text-sm text-slate-300">
                        {selectedInvoice.project}
                      </p>
                    </div>
                    <StatusBadge tone={selectedInvoice.tone}>
                      {selectedInvoice.status}
                    </StatusBadge>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <MiniStat label="HT" value={formatCurrency(selectedInvoice.amountHt)} />
                    <MiniStat label="TVA" value={formatCurrency(selectedInvoice.tvaAmount)} />
                    <MiniStat label="TTC" value={formatCurrency(selectedInvoice.amountTtc)} />
                    <MiniStat label="Echeance" value={formatDate(selectedInvoice.dueDate)} />
                  </div>

                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.14em] text-slate-500">
                      <span>Couverture encaissement</span>
                      <span>{paymentCoverage}%</span>
                    </div>
                    <ProgressBar
                      value={paymentCoverage}
                      tone={paymentCoverage >= 100 ? "success" : "warning"}
                    />
                  </div>
                </div>
              ) : null}
            </Panel>

            <Panel
              title="Alerte tresorerie"
            >
              <div className="rounded-[22px] border border-white/8 bg-white/4 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-1 size-4 text-amber-300" />
                  <p className="text-sm leading-6 text-slate-200">
                    {overview.treasuryAlert}
                  </p>
                </div>
              </div>
            </Panel>

          </div>
        </div>
      </Panel>
    </div>
  );
}

function DecompteTab({
  canCreateInvoice,
  dmDraft,
  setDmDraft,
  availableLots,
  vatRegime,
  draftValues,
  pendingAction,
  generateMonthlyStatement,
}: {
  canCreateInvoice: boolean;
  dmDraft: {
    periodMonth: string;
    progressPct: number;
    baseAmountHt: number;
    retentionPct: number;
    advanceDeduction: number;
  };
  setDmDraft: React.Dispatch<
    React.SetStateAction<{
      periodMonth: string;
      progressPct: number;
      baseAmountHt: number;
      retentionPct: number;
      advanceDeduction: number;
    }>
  >;
  availableLots: string[];
  vatRegime: { id: string; label: string; rate: number; helper: string };
  draftValues: {
    retentionAmount: number;
    amountAfterRetention: number;
    tvaAmount: number;
    amountTtc: number;
  };
  pendingAction: string;
  generateMonthlyStatement: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <StepHeading
            title="1. Preparer le decompte"
            description="Choisissez la periode, reprenez l'avancement et verifiez les montants avant de generer la facture."
          />
          <div className="rounded-[22px] border border-white/8 bg-white/4 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Lots relies au decompte
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {availableLots.map((lot) => (
                <span
                  key={lot}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                >
                  {lot}
                </span>
              ))}
            </div>
          </div>
          <label className="rounded-[22px] border border-white/8 bg-white/4 p-4">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Mois de decompte
            </span>
            <input
              type="month"
              value={toMonthInputValue(dmDraft.periodMonth)}
              onChange={(event) =>
                setDmDraft((current) => ({ ...current, periodMonth: event.target.value }))
              }
              className="mt-3 w-full bg-transparent text-white outline-none"
            />
            <p className="mt-3 text-xs leading-5 text-slate-400">
              Utilisez le mois de facturation reel pour garder les decomptes et l&apos;historique alignes.
            </p>
          </label>
          <NumberField
            label="Avancement saisi (%)"
            value={dmDraft.progressPct}
            onChange={(value) =>
              setDmDraft((current) => ({ ...current, progressPct: value }))
            }
          />
          <NumberField
            label="Base HT avant deductions"
            value={dmDraft.baseAmountHt}
            onChange={(value) =>
              setDmDraft((current) => ({ ...current, baseAmountHt: value }))
            }
          />
          <div className="grid gap-4 md:grid-cols-2">
            <NumberField
              label="Retenue de garantie (%)"
              value={dmDraft.retentionPct}
              onChange={(value) =>
                setDmDraft((current) => ({ ...current, retentionPct: value }))
              }
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
            onClick={() => (canCreateInvoice ? generateMonthlyStatement() : null)}
            disabled={!canCreateInvoice || pendingAction === "create-invoice"}
            className={cx(
              "flex w-full items-center justify-center gap-2 rounded-[22px] px-4 py-4 text-sm font-semibold",
              canCreateInvoice && pendingAction !== "create-invoice"
                ? "bg-sky-400 text-slate-950 hover:bg-sky-300"
                : "cursor-not-allowed bg-slate-700 text-slate-400",
            )}
          >
            <FileText className="size-4" />
            {pendingAction === "create-invoice"
              ? "Creation en cours..."
              : canCreateInvoice
                ? "Generer le decompte et la facture"
                : "Lecture seule des decomptes"}
          </button>
        </div>

        <div className="rounded-[22px] border border-white/8 bg-white/4 p-4">
          <StepHeading
            title="2. Verifier le calcul"
            description="Controlez retenue, avance, TVA et total TTC avant d'ouvrir le circuit de validation."
          />
          <div className="flex items-center gap-2">
            <Receipt className="size-4 text-slate-400" />
            <p className="text-sm font-semibold text-white">
              Calcul automatique depuis l&apos;avancement
            </p>
          </div>
          <div className="mt-4 space-y-3">
            <LineItem label="Montant HT de base" value={formatCurrency(dmDraft.baseAmountHt)} />
            <LineItem
              label={`Retenue de garantie (${dmDraft.retentionPct}%)`}
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
            <div className="border-t border-white/8 pt-3">
              <LineItem
                label="Total TTC"
                value={formatCurrency(draftValues.amountTtc)}
                emphasize
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InvoicesTab({
  canRecordPayment,
  paymentActionHelper,
  canSendInvoice,
  sendInvoiceHelper,
  canUpdateStatus,
  statusActionHelper,
  manualStatusOptions,
  invoices,
  selectedInvoiceId,
  selectInvoice,
  selectedInvoice,
  paymentCoverage,
  projectMembers,
  workflowOwners,
  sendInvoice,
  statusValue,
  setStatusDraft,
  updateInvoiceStatus,
  validateInvoice,
  validationAction,
  workflowSteps,
  pendingAction,
  downloadInvoicePdf,
  paymentDraft,
  setPaymentDraft,
  registerPayment,
}: {
  canRecordPayment: boolean;
  paymentActionHelper: string;
  canSendInvoice: boolean;
  sendInvoiceHelper: string;
  canUpdateStatus: boolean;
  statusActionHelper: string;
  manualStatusOptions: string[];
  invoices: InvoiceItem[];
  selectedInvoiceId: string;
  selectInvoice: (invoiceId: string) => void;
  selectedInvoice: InvoiceItem | undefined;
  paymentCoverage: number;
  projectMembers: Array<{
    id: string;
    initials: string;
    name: string;
    role: string;
  }>;
  workflowOwners: WorkflowOwnerDisplay;
  sendInvoice: (invoiceId: string) => void;
  statusValue: string;
  setStatusDraft: React.Dispatch<React.SetStateAction<string>>;
  updateInvoiceStatus: (invoiceId: string) => void;
  validateInvoice: (invoiceId: string) => void;
  validationAction: {
    canRun: boolean;
    helper: string;
    label: string;
  };
  workflowSteps: FinanceWorkflowStep[];
  pendingAction: string;
  downloadInvoicePdf: (invoice: InvoiceItem) => void;
  paymentDraft: {
    amount: string;
    method: string;
    reference: string;
  };
  setPaymentDraft: React.Dispatch<
    React.SetStateAction<{
      amount: string;
      method: string;
      reference: string;
    }>
  >;
  registerPayment: (invoiceId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <StepHeading
        title="1. Choisir la facture a traiter"
        description="Selectionnez d'abord la facture du mois pour concentrer l'envoi, la validation et l'encaissement sur une seule reference."
      />
      <div className="space-y-3">
        {invoices.map((invoice) => (
          <button
            key={invoice.id}
            type="button"
            onClick={() => selectInvoice(invoice.id)}
            title={
              selectedInvoiceId === invoice.id
                ? "Cette facture est deja selectionnee."
                : "Ouvrir cette facture et synchroniser la selection dans l'URL."
            }
            className={cx(
              "w-full rounded-[24px] border p-4 text-left",
              selectedInvoiceId === invoice.id
                ? "border-sky-400/25 bg-sky-400/10"
                : "border-white/8 bg-white/4 hover:bg-white/6",
            )}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display text-lg font-semibold text-white">
                    {invoice.invoiceNumber}
                  </p>
                  <StatusBadge tone={invoice.tone}>{invoice.status}</StatusBadge>
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  {invoice.project} - {formatDate(invoice.periodMonth)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm text-slate-300 sm:grid-cols-4">
                <MiniStat label="HT" value={formatCurrency(invoice.amountHt)} />
                <MiniStat label="TVA" value={`${invoice.tvaRate}%`} />
                <MiniStat label="TTC" value={formatCurrency(invoice.amountTtc)} />
                <MiniStat label="Echeance" value={formatDate(invoice.dueDate)} />
              </div>
            </div>
          </button>
        ))}
      </div>

      {selectedInvoice ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-[22px] border border-white/8 bg-white/4 p-4">
            <StepHeading
              title="2. Suivre le circuit de validation"
              description="Verifiez ou la facture se trouve dans le parcours, puis n'ouvrez que l'etape suivante."
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">
                Sequence de la facture
              </p>
              <StatusBadge tone={selectedInvoice.tone}>{selectedInvoice.status}</StatusBadge>
            </div>
            <div className="mt-4 space-y-3">
              {workflowSteps.map((step) => (
                <div
                  key={step.title}
                  className={cx(
                    "rounded-[20px] border p-4",
                    step.state === "current"
                      ? "border-sky-400/25 bg-sky-400/10"
                      : step.state === "done"
                        ? "border-emerald-400/25 bg-emerald-400/10"
                        : "border-white/8 bg-white/4",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{step.title}</p>
                    <StatusBadge tone={step.tone}>{step.badge}</StatusBadge>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{step.detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-[20px] border border-white/8 bg-white/4 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                Circuit de validation affecte
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(workflowOwners.projectManagerId || workflowOwners.clientApproverId || workflowOwners.financeLeadId) ? (
                  [
                    workflowOwners.projectManagerId
                      ? {
                          label: "Chef de projet",
                          ...workflowOwners.projectManagerId,
                        }
                      : null,
                    workflowOwners.financeLeadId
                      ? {
                          label: "Referent finance",
                          ...workflowOwners.financeLeadId,
                        }
                      : null,
                    workflowOwners.clientApproverId
                      ? {
                          label: "Validation client",
                          ...workflowOwners.clientApproverId,
                        }
                      : null,
                  ]
                    .filter((member): member is NonNullable<typeof member> => Boolean(member))
                    .map((member) => (
                      <span
                        key={`${member.id}-${member.label}`}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                      >
                        {member.label} - {member.name}
                      </span>
                    ))
                ) : (
                  projectMembers
                    .filter((member) =>
                      ["Chef de projet", "Maitre d'ouvrage", "Comptable", "Super Admin"].includes(
                        member.role,
                      ),
                    )
                    .map((member) => (
                    <span
                      key={member.id}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                    >
                      {member.name} - {member.role}
                    </span>
                    ))
                )}
              </div>
            </div>
            <StepHeading
              title="3. Agir sur la facture"
              description="Envoyez, ajustez ou validez seulement quand l'etape precedente est terminee."
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <label className="rounded-[20px] border border-white/8 bg-white/4 p-4">
                <span className="text-xs uppercase tracking-[0.14em] text-slate-500">
                  Ajustement manuel
                </span>
                <select
                  value={statusValue}
                  onChange={(event) => setStatusDraft(event.target.value)}
                  disabled={!manualStatusOptions.length || !canUpdateStatus || pendingAction === "update-invoice-status"}
                  title={statusActionHelper}
                  className="mt-3 w-full rounded-2xl border border-white/8 bg-black/20 px-3 py-3 text-sm text-white outline-none"
                >
                  {manualStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={() => (canUpdateStatus ? updateInvoiceStatus(selectedInvoice.id) : null)}
                disabled={!canUpdateStatus || pendingAction === "update-invoice-status"}
                title={statusActionHelper}
                className={cx(
                  "self-end rounded-2xl px-4 py-3 text-sm font-semibold",
                  canUpdateStatus && pendingAction !== "update-invoice-status"
                    ? "border border-white/10 bg-white/5 text-white hover:bg-white/8"
                    : "cursor-not-allowed border border-white/8 bg-white/5 text-slate-500",
                )}
              >
                {pendingAction === "update-invoice-status" ? "Mise a jour..." : "Mettre a jour"}
              </button>
            </div>
            <p className="text-xs leading-5 text-slate-400">{statusActionHelper}</p>
            <div className="mt-4 rounded-[20px] border border-white/8 bg-white/4 p-4 text-sm leading-6 text-slate-300">
              {validationAction.helper}
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {selectedInvoice.pdfUrl ? (
                <button
                  onClick={() => downloadInvoicePdf(selectedInvoice)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/8"
                >
                  <FileText className="size-4" />
                  Telecharger le PDF
                </button>
              ) : null}
              <button
                onClick={() => (canSendInvoice ? sendInvoice(selectedInvoice.id) : null)}
                disabled={!canSendInvoice || pendingAction === "send-invoice"}
                title={sendInvoiceHelper}
                className={cx(
                  "inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold",
                  canSendInvoice && pendingAction !== "send-invoice"
                    ? "border border-white/10 bg-white/5 text-white hover:bg-white/8"
                    : "cursor-not-allowed border border-white/8 bg-white/5 text-slate-500",
                )}
              >
                <Send className="size-4" />
                {pendingAction === "send-invoice" ? "Envoi..." : "Envoyer la facture"}
              </button>
              <button
                onClick={() => (validationAction.canRun ? validateInvoice(selectedInvoice.id) : null)}
                disabled={!validationAction.canRun || pendingAction === "validate-invoice"}
                title={validationAction.helper}
                className={cx(
                  "inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold",
                  validationAction.canRun && pendingAction !== "validate-invoice"
                    ? "bg-sky-400 text-slate-950 hover:bg-sky-300"
                    : "cursor-not-allowed bg-slate-700 text-slate-400",
                )}
              >
                <CheckCheck className="size-4" />
                {pendingAction === "validate-invoice" ? "Validation..." : validationAction.label}
              </button>
            </div>
          </div>

          <div className="rounded-[22px] border border-white/8 bg-white/4 p-4">
            <StepHeading
              title="4. Enregistrer le paiement"
              description="Le paiement ne s'ouvre qu'apres validation client. Saisissez ensuite l'encaissement pour cloturer la facture."
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">
                5. Paiement recu
              </p>
              <StatusBadge tone={paymentCoverage >= 100 ? "success" : "warning"}>
                {paymentCoverage}% couvre
              </StatusBadge>
            </div>
            <div className="mt-4 space-y-4">
              <fieldset
                disabled={!canRecordPayment}
                className="space-y-4 disabled:opacity-70"
              >
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
              </fieldset>
              <button
                onClick={() =>
                  canRecordPayment ? registerPayment(selectedInvoice.id) : null
                }
                disabled={!canRecordPayment || pendingAction === "register-payment"}
                title={paymentActionHelper}
                className={cx(
                  "flex w-full items-center justify-center gap-2 rounded-[22px] px-4 py-4 text-sm font-semibold",
                  canRecordPayment && pendingAction !== "register-payment"
                    ? "bg-sky-400 text-slate-950 hover:bg-sky-300"
                    : "cursor-not-allowed bg-slate-700 text-slate-400",
                )}
              >
                <Landmark className="size-4" />
                {pendingAction === "register-payment"
                  ? "Enregistrement..."
                  : canRecordPayment
                    ? "Enregistrer le paiement recu"
                    : "Paiement indisponible"}
              </button>
              <p className="text-xs leading-5 text-slate-400">{paymentActionHelper}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function VatTab({
  vatRegime,
  setVatRegime,
  selectedInvoice,
  declaration,
}: {
  vatRegime: { id: string; label: string; rate: number; helper: string };
  setVatRegime: React.Dispatch<
    React.SetStateAction<{ id: string; label: string; rate: number; helper: string }>
  >;
  selectedInvoice: InvoiceItem | undefined;
  declaration: {
    month: string;
    collectedTva: number;
    declaredTva: number;
    variance: number;
    status: string;
  };
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {financeVatRegimes.map((regime) => (
          <button
            key={regime.id}
            onClick={() => setVatRegime(regime)}
            className={cx(
              "rounded-full border px-4 py-2 text-sm font-semibold",
              vatRegime.id === regime.id
                ? "border-sky-400/25 bg-sky-400/12 text-sky-100"
                : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/8",
            )}
          >
            {regime.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[22px] border border-white/8 bg-white/4 p-4">
          <p className="text-sm font-semibold text-white">Regime applique</p>
          <p className="mt-3 text-sm leading-6 text-slate-300">{vatRegime.helper}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MiniStat label="Taux" value={`${vatRegime.rate}%`} />
            <MiniStat
              label="Sur facture selectionnee"
              value={
                selectedInvoice
                  ? formatCurrency(
                      Math.round((selectedInvoice.amountHt * vatRegime.rate) / 100),
                    )
                  : "-"
              }
            />
          </div>
        </div>

        <div className="rounded-[22px] border border-white/8 bg-white/4 p-4">
          <p className="text-sm font-semibold text-white">Declaration mensuelle TVA</p>
          <div className="mt-4 space-y-3">
            <LineItem label="Periode" value={declaration.month} />
            <LineItem
              label="TVA collectee"
              value={formatCurrency(declaration.collectedTva)}
            />
            <LineItem
              label="TVA declaree"
              value={formatCurrency(declaration.declaredTva)}
            />
            <LineItem
              label="Ecart"
              value={formatCurrency(declaration.variance)}
            />
            <div className="border-t border-white/8 pt-3">
              <LineItem
                label="Statut"
                value={declaration.status}
                emphasize
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CashflowTab({
  invoices,
  payments,
  cashflowData,
}: {
  invoices: InvoiceItem[];
  payments: PaymentItem[];
  cashflowData: Array<{
    label: string;
    plannedReceipts: number;
    actualReceipts: number;
    actualCosts: number;
  }>;
}) {
  const chartData = cashflowData.map((item) => ({
    label: item.label,
    planned: item.plannedReceipts,
    actual: item.actualReceipts,
  }));

  const totalInvoiced = invoices.reduce((sum, invoice) => sum + invoice.amountTtc, 0);
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalCosts = cashflowData.reduce((sum, item) => sum + item.actualCosts, 0);

  return (
    <div className="space-y-4">
      <StepHeading
        title="5. Suivre l'encaissement"
        description="Comparez recettes prevues, paiements recus et tension de tresorerie pour savoir ou relancer."
      />
      <SimpleBarChart data={chartData} />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[22px] border border-white/8 bg-white/4 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Facture TTC</p>
          <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(totalInvoiced)}</p>
        </div>
        <div className="rounded-[22px] border border-white/8 bg-white/4 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Encaisse</p>
          <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="rounded-[22px] border border-white/8 bg-white/4 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Couts reels</p>
          <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(totalCosts * 1000)}</p>
        </div>
      </div>

      <div className="space-y-3">
        {cashflowData.map((item) => {
          const delta = item.actualReceipts - item.actualCosts;
          const tone: ActiveTone = delta >= 0 ? "success" : "danger";

          return (
            <div
              key={item.label}
              className="rounded-[22px] border border-white/8 bg-white/4 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{item.label}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Recettes prevues {item.plannedReceipts}k / recues {item.actualReceipts}k
                  </p>
                </div>
                <StatusBadge tone={tone}>
                  {delta >= 0 ? `+${delta}` : delta}k net
                </StatusBadge>
              </div>
            </div>
          );
        })}
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
      <span className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-3 w-full bg-transparent text-white outline-none"
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
    <label className="rounded-[22px] border border-white/8 bg-white/4 p-4">
      <span className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 w-full bg-transparent text-white outline-none"
      />
    </label>
  );
}

function StepHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-white/4 px-4 py-3">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-300">{description}</p>
    </div>
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
      <p className={cx("text-sm text-slate-300", emphasize && "font-semibold text-white")}>
        {label}
      </p>
      <p className={cx("text-sm text-white", emphasize && "font-semibold")}>{value}</p>
    </div>
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
