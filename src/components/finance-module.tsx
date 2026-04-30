"use client";

import {
  startTransition,
  useMemo,
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
  cx,
} from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  getFinanceModuleData,
  financeVatRegimes,
} from "@/lib/mock-data";
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

type WorkspaceProject = ReturnType<typeof useWorkspace>["activeProject"];

const tabs: Array<{ key: FinanceTab; label: string; helper: string }> = [
  {
    key: "dm",
    label: "Decompte mensuel",
    helper: "Calcul depuis avancement, retenue et avance",
  },
  {
    key: "invoices",
    label: "Factures",
    helper: "Validation, PDF et suivi d'encaissement",
  },
  {
    key: "vat",
    label: "TVA",
    helper: "Regime applique et declaration mensuelle",
  },
  {
    key: "cashflow",
    label: "Tresorerie",
    helper: "Prevu vs reel, couts et tensions",
  },
];

const metricIcons = [Wallet, Receipt, CircleDollarSign, BadgePercent];

function nextInvoiceNumber(items: InvoiceItem[]) {
  const max = items.reduce((current, item) => {
    const numeric = Number(item.invoiceNumber.split("-").pop());
    return Number.isFinite(numeric) ? Math.max(current, numeric) : current;
  }, 42);

  return `FAC-2026-${String(max + 1).padStart(3, "0")}`;
}

export function FinanceModule() {
  const { activeProject, can, currentUser } = useWorkspace();
  const projectData = useMemo(
    () => getFinanceModuleData(activeProject.id),
    [activeProject.id],
  );
  const canCreateInvoice = can("finance.invoice.create");
  const canSendInvoice = can("finance.invoice.send");
  const canValidateInvoice = can("finance.invoice.validate");
  const canRecordPayment = can("finance.payment.record");

  return (
    <FinanceModuleContent
      key={activeProject.id}
      activeProject={activeProject}
      canCreateInvoice={canCreateInvoice}
      canRecordPayment={canRecordPayment}
      canSendInvoice={canSendInvoice}
      canValidateInvoice={canValidateInvoice}
      currentUserRole={currentUser.role}
      projectData={projectData}
    />
  );
}

function FinanceModuleContent({
  activeProject,
  canCreateInvoice,
  canRecordPayment,
  canSendInvoice,
  canValidateInvoice,
  currentUserRole,
  projectData,
}: {
  activeProject: WorkspaceProject;
  canCreateInvoice: boolean;
  canRecordPayment: boolean;
  canSendInvoice: boolean;
  canValidateInvoice: boolean;
  currentUserRole: string;
  projectData: ReturnType<typeof getFinanceModuleData>;
}) {
  const [activeTab, setActiveTab] = useState<FinanceTab>("dm");
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

  const selectedInvoice =
    invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? invoices[0];

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

  function generateMonthlyStatement() {
    const newInvoice: InvoiceItem = {
      id: `INV-${Date.now()}`,
      projectId: activeProject.id,
      invoiceNumber: nextInvoiceNumber(invoices),
      project: activeProject.name,
      periodMonth: dmDraft.periodMonth,
      amountHt: draftValues.amountAfterRetention,
      tvaRate: vatRegime.rate,
      tvaAmount: draftValues.tvaAmount,
      amountTtc: draftValues.amountTtc,
      dueDate: "2026-05-10",
      paidAt: "",
      status: "Brouillon",
      tone: "warning",
      retentionAmount: draftValues.retentionAmount,
      advanceDeduction: dmDraft.advanceDeduction,
      sourceProgress: dmDraft.progressPct,
      validatedByMoe: false,
      validatedByMo: false,
    };

    startTransition(() => {
      setInvoices((current) => [newInvoice, ...current]);
      setSelectedInvoiceId(newInvoice.id);
      setActiveTab("invoices");
    });
  }

  function validateInvoice(invoiceId: string) {
    startTransition(() => {
      setInvoices((current) =>
        current.map((invoice) =>
          invoice.id === invoiceId
            ? {
                ...invoice,
                status: invoice.validatedByMoe ? "Validee" : "Envoyee",
                tone: invoice.validatedByMoe ? "primary" : "warning",
                validatedByMoe: true,
                validatedByMo: invoice.validatedByMoe ? true : invoice.validatedByMo,
              }
            : invoice,
        ),
      );
    });
  }

  function sendInvoice(invoiceId: string) {
    startTransition(() => {
      setInvoices((current) =>
        current.map((invoice) =>
          invoice.id === invoiceId
            ? {
                ...invoice,
                status: "Envoyee",
                tone: "primary",
              }
            : invoice,
        ),
      );
    });
  }

  function registerPayment(invoiceId: string) {
    const amount = Number(paymentDraft.amount);
    if (!Number.isFinite(amount) || !selectedInvoice) {
      return;
    }

    const payment: PaymentItem = {
      id: `PAY-${Date.now()}`,
      invoiceId,
      invoiceNumber: selectedInvoice.invoiceNumber,
      amount,
      method: paymentDraft.method,
      reference: paymentDraft.reference,
      paidAt: "2026-04-30T17:20:00",
    };

    startTransition(() => {
      setPayments((current) => [payment, ...current]);
      setInvoices((current) =>
        current.map((invoice) =>
          invoice.id === invoiceId
            ? {
                ...invoice,
                paidAt: payment.paidAt,
                status: amount >= invoice.amountTtc ? "Payee" : "Validee",
                tone: amount >= invoice.amountTtc ? "success" : "primary",
              }
            : invoice,
        ),
      );
      setActiveTab("cashflow");
    });
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Finance"
        title="Facturation, encaissements et tresorerie"
        action={
          <button
            onClick={() => (canCreateInvoice ? setActiveTab("dm") : null)}
            disabled={!canCreateInvoice}
            className={cx(
              "rounded-2xl px-4 py-3 text-sm font-semibold",
              canCreateInvoice
                ? "bg-black text-white hover:bg-stone-800"
                : "cursor-not-allowed bg-stone-200 text-stone-500",
            )}
          >
            Creer une facture
          </button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-4">
        {projectData.overview.kpis.map((metric, index) => (
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
          consulter la finance, avec des droits adaptes pour creer, valider ou enregistrer les
          paiements.
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
              {activeTab === "dm" ? (
                <DecompteTab
                  canCreateInvoice={canCreateInvoice}
                  dmDraft={dmDraft}
                  setDmDraft={setDmDraft}
                  vatRegime={vatRegime}
                  draftValues={draftValues}
                  generateMonthlyStatement={generateMonthlyStatement}
                />
              ) : null}

              {activeTab === "invoices" ? (
                <InvoicesTab
                  canRecordPayment={canRecordPayment}
                  canSendInvoice={canSendInvoice}
                  canValidateInvoice={canValidateInvoice}
                  invoices={invoices}
                  selectedInvoiceId={selectedInvoiceId}
                  setSelectedInvoiceId={setSelectedInvoiceId}
                  selectedInvoice={selectedInvoice}
                  paymentCoverage={paymentCoverage}
                  sendInvoice={sendInvoice}
                  validateInvoice={validateInvoice}
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
                  declaration={projectData.declaration}
                />
              ) : null}

              {activeTab === "cashflow" ? (
                <CashflowTab
                  invoices={invoices}
                  payments={payments}
                  cashflowData={projectData.cashflow}
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
                    {projectData.overview.treasuryAlert}
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
  vatRegime,
  draftValues,
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
  vatRegime: { id: string; label: string; rate: number; helper: string };
  draftValues: {
    retentionAmount: number;
    amountAfterRetention: number;
    tvaAmount: number;
    amountTtc: number;
  };
  generateMonthlyStatement: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <Field
            label="Mois de decompte"
            value={dmDraft.periodMonth}
            onChange={(value) =>
              setDmDraft((current) => ({ ...current, periodMonth: value }))
            }
          />
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
            disabled={!canCreateInvoice}
            className={cx(
              "flex w-full items-center justify-center gap-2 rounded-[22px] px-4 py-4 text-sm font-semibold",
              canCreateInvoice
                ? "bg-sky-400 text-slate-950 hover:bg-sky-300"
                : "cursor-not-allowed bg-slate-700 text-slate-400",
            )}
          >
            <FileText className="size-4" />
            {canCreateInvoice ? "Generer le decompte mensuel" : "Lecture seule des decomptes"}
          </button>
        </div>

        <div className="rounded-[22px] border border-white/8 bg-white/4 p-4">
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
  canSendInvoice,
  canValidateInvoice,
  invoices,
  selectedInvoiceId,
  setSelectedInvoiceId,
  selectedInvoice,
  paymentCoverage,
  sendInvoice,
  validateInvoice,
  paymentDraft,
  setPaymentDraft,
  registerPayment,
}: {
  canRecordPayment: boolean;
  canSendInvoice: boolean;
  canValidateInvoice: boolean;
  invoices: InvoiceItem[];
  selectedInvoiceId: string;
  setSelectedInvoiceId: React.Dispatch<React.SetStateAction<string>>;
  selectedInvoice: InvoiceItem | undefined;
  paymentCoverage: number;
  sendInvoice: (invoiceId: string) => void;
  validateInvoice: (invoiceId: string) => void;
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
      <div className="space-y-3">
        {invoices.map((invoice) => (
          <button
            key={invoice.id}
            onClick={() => setSelectedInvoiceId(invoice.id)}
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">
                Validation & emission
              </p>
              <StatusBadge tone={selectedInvoice.tone}>{selectedInvoice.status}</StatusBadge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[20px] border border-white/8 bg-white/4 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                  Validation MOE
                </p>
                <p className="mt-2 text-sm text-white">
                  {selectedInvoice.validatedByMoe ? "Validee" : "En attente"}
                </p>
              </div>
              <div className="rounded-[20px] border border-white/8 bg-white/4 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                  Validation MO
                </p>
                <p className="mt-2 text-sm text-white">
                  {selectedInvoice.validatedByMo ? "Validee" : "En attente"}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => (canSendInvoice ? sendInvoice(selectedInvoice.id) : null)}
                disabled={!canSendInvoice}
                className={cx(
                  "inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold",
                  canSendInvoice
                    ? "border border-white/10 bg-white/5 text-white hover:bg-white/8"
                    : "cursor-not-allowed border border-white/8 bg-white/5 text-slate-500",
                )}
              >
                <Send className="size-4" />
                Generer / envoyer PDF
              </button>
              <button
                onClick={() => (canValidateInvoice ? validateInvoice(selectedInvoice.id) : null)}
                disabled={!canValidateInvoice}
                className={cx(
                  "inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold",
                  canValidateInvoice
                    ? "bg-sky-400 text-slate-950 hover:bg-sky-300"
                    : "cursor-not-allowed bg-slate-700 text-slate-400",
                )}
              >
                <CheckCheck className="size-4" />
                Valider la facture
              </button>
            </div>
          </div>

          <div className="rounded-[22px] border border-white/8 bg-white/4 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">
                Enregistrer un paiement
              </p>
              <StatusBadge tone={paymentCoverage >= 100 ? "success" : "warning"}>
                {paymentCoverage}% couvre
              </StatusBadge>
            </div>
            <div className="mt-4 space-y-4">
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
              <button
                onClick={() => (canRecordPayment ? registerPayment(selectedInvoice.id) : null)}
                disabled={!canRecordPayment}
                className={cx(
                  "flex w-full items-center justify-center gap-2 rounded-[22px] px-4 py-4 text-sm font-semibold",
                  canRecordPayment
                    ? "bg-sky-400 text-slate-950 hover:bg-sky-300"
                    : "cursor-not-allowed bg-slate-700 text-slate-400",
                )}
              >
                <Landmark className="size-4" />
                {canRecordPayment ? "Enregistrer le paiement" : "Paiement en lecture seule"}
              </button>
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
