import type { FinanceModuleData, FinancePaymentRecord } from "@/lib/backend/types";
import {
  getRebuildApiUrl,
  resolveRebuildProjectForLegacyId,
  shouldUseRebuildProjectsBridge,
} from "@/lib/rebuild-auth";

type FinanceMutationAction =
  | "create-invoice"
  | "register-payment"
  | "send-invoice"
  | "update-invoice-status"
  | "validate-invoice";

type RebuildBinaryAsset = {
  bytes: ArrayBuffer;
  fileName: string;
  mimeType: string;
};

type RebuildFinanceSummary = {
  budgetTnd: number;
  budgetVsCostPct: number;
  dsoDays: number;
  facturationDansLesDelaisPct: number;
  montantEnRetard: number;
  pendingClientValidations: number;
  pendingProjectValidations: number;
  realCostTnd: number;
  totalCollected: number;
  totalInvoiced: number;
  totalOutstanding: number;
  tvaCollected: number;
  tvaDeclared: number;
  tvaGap: number;
};

type RebuildFinanceSummaryResponse = {
  item: RebuildFinanceSummary;
};

type RebuildCashflowPoint = {
  costsReal: number;
  period: string;
  receiptsCollected: number;
  receiptsExpected: number;
};

type RebuildCashflowResponse = {
  item: {
    projectId: string;
    projectName: string;
    series: RebuildCashflowPoint[];
    totals: {
      costsReal: number;
      overdueAmount: number;
      receiptsCollected: number;
      receiptsExpected: number;
      totalOutstanding: number;
    };
  };
};

type RebuildStatementLineItem = {
  amountHt: number;
  lot: string;
  progressPct: number;
  tasks: string[];
};

type RebuildStatement = {
  advanceDeduction: number;
  createdAt: string;
  createdBy: string;
  id: string;
  lineItems: RebuildStatementLineItem[];
  netPayableHt: number;
  pdfUrl?: string | null;
  periodMonth: string;
  projectId: string;
  projectName?: string | null;
  retentionAmount: number;
  retentionPct: number;
  status: string;
  subtotalHt: number;
  validatedAt?: string | null;
  validatedBy?: string | null;
};

type RebuildStatementsResponse = {
  items: RebuildStatement[];
};

type RebuildInvoice = {
  amountHt: number;
  amountPaid?: number;
  amountTtc: number;
  clientValidatedAt?: string | null;
  clientValidatedBy?: string | null;
  createdAt: string;
  createdBy: string;
  dueDate: string;
  id: string;
  invoiceNumber: string;
  paidAt?: string | null;
  pdfUrl?: string | null;
  periodMonth: string;
  projectId: string;
  projectName?: string | null;
  projectValidatedAt?: string | null;
  projectValidatedBy?: string | null;
  remainingAmount?: number;
  sentAt?: string | null;
  statementId?: string | null;
  status: string;
  tvaAmount: number;
  tvaRate: number;
};

type RebuildInvoicesResponse = {
  items: RebuildInvoice[];
};

type RebuildInvoiceDetailResponse = {
  item: RebuildInvoice;
  payments: Array<{
    amount: number;
    bankReference?: string | null;
    createdAt: string;
    id: string;
    notes?: string | null;
    paymentDate: string;
    receiptPdfUrl?: string | null;
    recordedBy: string;
  }>;
  statement: RebuildStatement | null;
  workflow: {
    clientValidatedAt?: string | null;
    clientValidatedBy?: string | null;
    paidAt?: string | null;
    projectValidatedAt?: string | null;
    projectValidatedBy?: string | null;
    sentAt?: string | null;
    status: string;
  };
};

type RebuildStatementCreateResponse = {
  item: RebuildStatement;
  pdf: {
    fileName: string;
    pdfUrl: string;
  };
};

type RebuildInvoiceCreateResponse = {
  item: RebuildInvoice;
  pdf: {
    fileName: string;
    pdfUrl: string;
  };
};

type RebuildPaymentRegisterResponse = {
  invoice: {
    amountPaid: number;
    amountTtc: number;
    id: string;
    invoiceNumber: string;
    remainingAmount: number;
    status: string;
  };
  payment: {
    amount: number;
    createdAt: string;
    id: string;
    paymentDate: string;
    receiptPdfUrl?: string | null;
  };
};

const vatRatesByRegimeId: Record<string, number> = {
  exempt: 0,
  reduced: 7,
  standard: 19,
};

export function shouldUseRebuildFinanceBridge() {
  const explicit = process.env.BNAASAAS_REBUILD_FINANCE_ENABLED;
  if (explicit === "true") {
    return true;
  }
  if (explicit === "false") {
    return false;
  }

  return shouldUseRebuildProjectsBridge();
}

export async function buildRebuildFinancePayload(
  accessToken: string,
  legacyProjectId: string,
  fallbackPayload: FinanceModuleData,
) {
  const resolvedProject = await resolveRebuildProjectForLegacyId(accessToken, legacyProjectId);
  if (!resolvedProject) {
    return null;
  }

  const [summaryResponse, cashflowResponse, statementsResponse, invoicesResponse] =
    await Promise.all([
      callRebuildJson<RebuildFinanceSummaryResponse>(
        `/api/v1/projects/${resolvedProject.id}/financial-summary`,
        accessToken,
      ),
      callRebuildJson<RebuildCashflowResponse>(
        `/api/v1/projects/${resolvedProject.id}/cashflow`,
        accessToken,
      ),
      callRebuildJson<RebuildStatementsResponse>(
        `/api/v1/projects/${resolvedProject.id}/statements`,
        accessToken,
      ),
      callRebuildJson<RebuildInvoicesResponse>(
        `/api/v1/projects/${resolvedProject.id}/invoices`,
        accessToken,
      ),
    ]);

  if (!summaryResponse?.item || !cashflowResponse?.item || !statementsResponse?.items || !invoicesResponse?.items) {
    return null;
  }

  const invoiceDetails = await Promise.all(
    invoicesResponse.items.map((invoice) =>
      callRebuildJson<RebuildInvoiceDetailResponse>(
        `/api/v1/projects/${resolvedProject.id}/invoices/${encodeURIComponent(invoice.id)}`,
        accessToken,
      ),
    ),
  );

  const detailByInvoiceId = new Map(
    invoiceDetails
      .filter((detail): detail is RebuildInvoiceDetailResponse => Boolean(detail?.item?.id))
      .map((detail) => [detail.item.id, detail]),
  );

  const statementsById = new Map(
    statementsResponse.items.map((statement) => [statement.id, statement]),
  );

  const invoices = invoicesResponse.items.map((invoice) =>
    mapRebuildInvoiceToFinanceRecord(
      invoice,
      detailByInvoiceId.get(invoice.id),
      statementsById.get(invoice.statementId ?? ""),
      legacyProjectId,
      fallbackPayload,
    ),
  );

  const payments = buildFinancePayments(detailByInvoiceId);
  const latestStatement =
    statementsResponse.items.find((statement) => statement.periodMonth === fallbackPayload.dmDraft.periodMonth) ??
    statementsResponse.items[0] ??
    null;

  return {
    ...fallbackPayload,
    overview: {
      kpis: buildOverviewKpis(summaryResponse.item),
      treasuryAlert: buildTreasuryAlert(summaryResponse.item, cashflowResponse.item),
    },
    invoices,
    payments,
    cashflow: cashflowResponse.item.series.map((entry) => ({
      actualCosts: entry.costsReal,
      actualReceipts: entry.receiptsCollected,
      label: formatPeriodLabel(entry.period),
      plannedReceipts: entry.receiptsExpected,
    })),
    declaration: {
      month: formatMonthLabel(
        latestStatement?.periodMonth ??
          invoices[0]?.periodMonth ??
          fallbackPayload.declaration.month,
      ),
      collectedTva: roundTo(summaryResponse.item.tvaCollected, 3),
      declaredTva: roundTo(summaryResponse.item.tvaDeclared, 3),
      variance: roundTo(summaryResponse.item.tvaGap, 3),
      status: deriveVatStatus(summaryResponse.item),
    },
    defaultVatRegimeId: inferVatRegimeId(invoices[0]?.tvaRate ?? fallbackPayload.invoices[0]?.tvaRate ?? 19),
    dmDraft: latestStatement
      ? {
          advanceDeduction: latestStatement.advanceDeduction,
          baseAmountHt: latestStatement.subtotalHt,
          periodMonth: latestStatement.periodMonth,
          progressPct: deriveStatementProgress(latestStatement.lineItems),
          retentionPct: latestStatement.retentionPct,
        }
      : fallbackPayload.dmDraft,
    paymentDraft: fallbackPayload.paymentDraft,
  } satisfies FinanceModuleData;
}

export async function mutateRebuildFinancePayload(
  accessToken: string,
  legacyProjectId: string,
  action: FinanceMutationAction,
  payload: Record<string, unknown>,
  fallbackPayload: FinanceModuleData,
) {
  const resolvedProject = await resolveRebuildProjectForLegacyId(accessToken, legacyProjectId);
  if (!resolvedProject) {
    return null;
  }

  switch (action) {
    case "create-invoice": {
      const statement = await findOrCreateStatement(
        accessToken,
        resolvedProject.id,
        payload,
        fallbackPayload,
      );

      if (!statement) {
        return null;
      }

      const existingInvoice = await findInvoiceForStatement(
        accessToken,
        resolvedProject.id,
        statement.id,
      );

      if (!existingInvoice) {
        const invoiceCreated = await callRebuildJson<RebuildInvoiceCreateResponse>(
          `/api/v1/projects/${resolvedProject.id}/invoices`,
          accessToken,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              statementId: statement.id,
              tvaRate: resolveVatRateFromPayload(payload, fallbackPayload.defaultVatRegimeId),
            }),
          },
        );

        if (!invoiceCreated?.item?.id) {
          return null;
        }
      }

      return buildRebuildFinancePayload(accessToken, legacyProjectId, fallbackPayload);
    }
    case "send-invoice": {
      const invoiceId = String(payload.invoiceId ?? "");
      if (!invoiceId) {
        return null;
      }

      const response = await callRebuildJson<{ item: RebuildInvoice }>(
        `/api/v1/projects/${resolvedProject.id}/invoices/${encodeURIComponent(invoiceId)}/send`,
        accessToken,
        {
          method: "POST",
        },
      );

      if (!response?.item?.id) {
        return null;
      }

      return buildRebuildFinancePayload(accessToken, legacyProjectId, fallbackPayload);
    }
    case "validate-invoice": {
      const invoiceId = String(payload.invoiceId ?? "");
      if (!invoiceId) {
        return null;
      }

      const response = await callRebuildJson<{ item: RebuildInvoice }>(
        `/api/v1/projects/${resolvedProject.id}/invoices/${encodeURIComponent(invoiceId)}/validate`,
        accessToken,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );

      if (!response?.item?.id) {
        return null;
      }

      return buildRebuildFinancePayload(accessToken, legacyProjectId, fallbackPayload);
    }
    case "register-payment": {
      const invoiceId = String(payload.invoiceId ?? "");
      const paymentDraft = payload.paymentDraft as FinanceModuleData["paymentDraft"] | undefined;
      if (!invoiceId || !paymentDraft) {
        return null;
      }

      const amount = Number(paymentDraft.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return null;
      }

      const response = await callRebuildJson<RebuildPaymentRegisterResponse>(
        `/api/v1/projects/${resolvedProject.id}/invoices/${encodeURIComponent(invoiceId)}/payment`,
        accessToken,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount,
            bankReference: String(paymentDraft.reference ?? "").trim() || undefined,
            notes: String(paymentDraft.method ?? "").trim() || undefined,
            paymentDate: getTodayIso(),
          }),
        },
      );

      if (!response?.payment?.id) {
        return null;
      }

      return buildRebuildFinancePayload(accessToken, legacyProjectId, fallbackPayload);
    }
    case "update-invoice-status": {
      const invoiceId = String(payload.invoiceId ?? "");
      const nextStatus = mapLegacyStatusToRebuildStatus(String(payload.status ?? ""));
      if (!invoiceId || !nextStatus) {
        return null;
      }

      const response = await callRebuildJson<{ item: RebuildInvoice }>(
        `/api/v1/projects/${resolvedProject.id}/invoices/${encodeURIComponent(invoiceId)}/status`,
        accessToken,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: nextStatus,
          }),
        },
      );

      if (!response?.item?.id) {
        return null;
      }

      return buildRebuildFinancePayload(accessToken, legacyProjectId, fallbackPayload);
    }
    default:
      return null;
  }
}

export async function downloadRebuildInvoicePdf(
  accessToken: string,
  legacyProjectId: string,
  invoiceId: string,
) {
  const resolvedProject = await resolveRebuildProjectForLegacyId(accessToken, legacyProjectId);
  if (!resolvedProject) {
    return null;
  }

  return callRebuildBinary(
    `/api/v1/projects/${resolvedProject.id}/invoices/${encodeURIComponent(invoiceId)}/pdf`,
    accessToken,
  );
}

async function findOrCreateStatement(
  accessToken: string,
  rebuildProjectId: string,
  payload: Record<string, unknown>,
  fallbackPayload: FinanceModuleData,
) {
  const statementPeriod = normalizePeriodMonth(
    String((payload.dmDraft as FinanceModuleData["dmDraft"] | undefined)?.periodMonth ?? fallbackPayload.dmDraft.periodMonth),
  );

  const statementsBefore = await callRebuildJson<RebuildStatementsResponse>(
    `/api/v1/projects/${rebuildProjectId}/statements`,
    accessToken,
  );
  const existing = statementsBefore?.items?.find((statement) => statement.periodMonth === statementPeriod);
  if (existing) {
    return existing;
  }

  const dmDraft = payload.dmDraft as FinanceModuleData["dmDraft"] | undefined;
  const response = await callRebuildJson<RebuildStatementCreateResponse>(
    `/api/v1/projects/${rebuildProjectId}/statements`,
    accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        advanceDeduction: dmDraft?.advanceDeduction ?? fallbackPayload.dmDraft.advanceDeduction,
        periodMonth: statementPeriod,
        retentionPct: dmDraft?.retentionPct ?? fallbackPayload.dmDraft.retentionPct,
      }),
    },
  );

  if (response?.item?.id) {
    return response.item;
  }

  const statementsAfter = await callRebuildJson<RebuildStatementsResponse>(
    `/api/v1/projects/${rebuildProjectId}/statements`,
    accessToken,
  );
  return statementsAfter?.items?.find((statement) => statement.periodMonth === statementPeriod) ?? null;
}

async function findInvoiceForStatement(
  accessToken: string,
  rebuildProjectId: string,
  statementId: string,
) {
  const invoices = await callRebuildJson<RebuildInvoicesResponse>(
    `/api/v1/projects/${rebuildProjectId}/invoices`,
    accessToken,
  );

  return invoices?.items?.find((invoice) => invoice.statementId === statementId) ?? null;
}

function mapRebuildInvoiceToFinanceRecord(
  invoice: RebuildInvoice,
  detail: RebuildInvoiceDetailResponse | undefined,
  statementFallback: RebuildStatement | undefined,
  legacyProjectId: string,
  fallbackPayload: FinanceModuleData,
) {
  const statement = detail?.statement ?? statementFallback ?? null;
  const amountPaid = roundTo(invoice.amountPaid ?? detail?.item.amountPaid ?? 0, 3);
  const remainingAmount = roundTo(
    typeof invoice.remainingAmount === "number"
      ? invoice.remainingAmount
      : Math.max(invoice.amountTtc - amountPaid, 0),
    3,
  );
  const mappedStatus = mapRebuildStatusToLegacyStatus(invoice.status, amountPaid, invoice.amountTtc);

  return {
    id: invoice.id,
    projectId: legacyProjectId,
    invoiceNumber: invoice.invoiceNumber,
    project: invoice.projectName ?? detail?.item.projectName ?? fallbackPayload.invoices[0]?.project ?? "Projet",
    periodMonth: invoice.periodMonth,
    amountHt: roundTo(invoice.amountHt, 3),
    tvaRate: roundTo(invoice.tvaRate, 2),
    tvaAmount: roundTo(invoice.tvaAmount, 3),
    amountTtc: roundTo(invoice.amountTtc, 3),
    dueDate: invoice.dueDate,
    paidAt: invoice.paidAt ?? "",
    status: mappedStatus,
    tone: mapLegacyStatusToTone(mappedStatus, remainingAmount, invoice.dueDate),
    retentionAmount: roundTo(statement?.retentionAmount ?? 0, 3),
    advanceDeduction: roundTo(statement?.advanceDeduction ?? 0, 3),
    sourceProgress: deriveStatementProgress(statement?.lineItems ?? []),
    validatedByMoe: Boolean(invoice.projectValidatedAt),
    validatedByMo: Boolean(invoice.clientValidatedAt),
    pdfUrl: invoice.pdfUrl
      ? `/api/projects/${legacyProjectId}/finance/invoices/${invoice.id}/pdf`
      : undefined,
    statementId: statement?.id ?? invoice.statementId ?? undefined,
    statementPdfUrl: undefined,
    moeValidatedBy: invoice.projectValidatedBy ?? "",
    moeValidatedAt: invoice.projectValidatedAt ?? "",
    moValidatedBy: invoice.clientValidatedBy ?? "",
    moValidatedAt: invoice.clientValidatedAt ?? "",
  } satisfies FinanceModuleData["invoices"][number];
}

function buildFinancePayments(
  detailByInvoiceId: Map<string, RebuildInvoiceDetailResponse>,
) {
  const flattened: FinancePaymentRecord[] = [];

  for (const [invoiceId, detail] of detailByInvoiceId.entries()) {
    for (const payment of detail.payments ?? []) {
      flattened.push({
        id: payment.id,
        invoiceId,
        invoiceNumber: detail.item.invoiceNumber,
        amount: roundTo(payment.amount, 3),
        method: payment.notes?.trim() || "Virement",
        reference: payment.bankReference?.trim() || "Sans reference",
        paidAt: payment.paymentDate,
        receiptPdfUrl: payment.receiptPdfUrl ?? undefined,
      });
    }
  }

  return flattened.sort((left, right) => right.paidAt.localeCompare(left.paidAt));
}

function buildOverviewKpis(summary: RebuildFinanceSummary): FinanceModuleData["overview"]["kpis"] {
  const vatCompliance =
    summary.tvaCollected <= 0
      ? 100
      : Math.max(0, Math.round((Math.min(summary.tvaCollected, summary.tvaDeclared) / summary.tvaCollected) * 100));

  return [
    {
      label: "DSO",
      value: `${Math.round(summary.dsoDays)} j`,
      helper: "Delai moyen de reglement observe sur les factures reglees.",
      tone: summary.dsoDays > 30 ? "danger" : summary.dsoDays > 20 ? "warning" : "success",
    },
    {
      label: "Facturation dans les delais",
      value: `${Math.round(summary.facturationDansLesDelaisPct)}%`,
      helper: `${summary.pendingProjectValidations + summary.pendingClientValidations} validation(s) encore ouvertes.`,
      tone:
        summary.facturationDansLesDelaisPct >= 90
          ? "success"
          : summary.facturationDansLesDelaisPct >= 70
            ? "warning"
            : "danger",
    },
    {
      label: "Ecart budget / cout reel",
      value: `${summary.budgetVsCostPct >= 0 ? "+" : ""}${roundTo(summary.budgetVsCostPct, 1)}%`,
      helper: `${formatCurrency(summary.budgetTnd)} budget · ${formatCurrency(summary.realCostTnd)} cout reel`,
      tone: summary.budgetVsCostPct > 0 ? "danger" : summary.budgetVsCostPct > -5 ? "warning" : "success",
    },
    {
      label: "TVA collectee / declaree",
      value: `${vatCompliance}%`,
      helper: `${formatCurrency(summary.tvaCollected)} / ${formatCurrency(summary.tvaDeclared)}`,
      tone: vatCompliance >= 99 ? "success" : vatCompliance >= 85 ? "warning" : "danger",
    },
    {
      label: "Montant en retard",
      value: formatCurrency(summary.montantEnRetard),
      helper: `${summary.pendingClientValidations} validation(s) client et ${summary.pendingProjectValidations} validation(s) projet en attente.`,
      tone: summary.montantEnRetard > 0 ? "danger" : "success",
    },
  ];
}

function buildTreasuryAlert(
  summary: RebuildFinanceSummary,
  cashflow: RebuildCashflowResponse["item"],
) {
  if (summary.montantEnRetard > 0) {
    return `${formatCurrency(summary.montantEnRetard)} restent en retard d'encaissement sur le projet.`;
  }

  const delta = roundTo(cashflow.totals.receiptsCollected - cashflow.totals.costsReal, 3);
  if (delta < 0) {
    return `Tresorerie sous tension: ${formatCurrency(Math.abs(delta))} de delta negatif sur le cycle actuel.`;
  }

  return "Tresorerie sous controle sur le cycle courant.";
}

function deriveVatStatus(summary: RebuildFinanceSummary) {
  if (summary.tvaGap <= 0.0005) {
    return "Conforme";
  }
  if (summary.tvaDeclared < summary.tvaCollected) {
    return "A finaliser";
  }
  return "A verifier";
}

function deriveStatementProgress(lineItems: RebuildStatementLineItem[]) {
  if (!lineItems.length) {
    return 0;
  }

  return Math.round(
    lineItems.reduce((sum, item) => sum + Number(item.progressPct ?? 0), 0) / lineItems.length,
  );
}

function mapRebuildStatusToLegacyStatus(
  status: string,
  amountPaid: number,
  amountTtc: number,
) {
  switch (status) {
    case "draft":
      return "Brouillon";
    case "issued":
    case "project_validation":
      return "Envoyee";
    case "client_validation":
      return "Validation MO";
    case "validated":
      return "Validee";
    case "paid":
      return "Payee";
    case "litigious":
      return "Litigieuse";
    case "partially_paid":
    case "overdue":
      return amountPaid >= amountTtc - 0.0005 ? "Payee" : "Validee";
    default:
      return "Brouillon";
  }
}

function mapLegacyStatusToRebuildStatus(status: string) {
  switch (status.trim()) {
    case "Brouillon":
      return "draft";
    case "Envoyee":
      return "issued";
    case "Validation MO":
      return "client_validation";
    case "Validee":
      return "validated";
    case "Payee":
      return "paid";
    case "Litigieuse":
      return "litigious";
    default:
      return null;
  }
}

function mapLegacyStatusToTone(
  status: string,
  remainingAmount: number,
  dueDate: string,
): "danger" | "primary" | "success" | "warning" {
  if (status === "Litigieuse") {
    return "danger";
  }
  if (status === "Payee") {
    return "success";
  }
  if (remainingAmount > 0 && dueDate < getTodayIso()) {
    return "danger";
  }
  if (status === "Validee" || status === "Validation MO") {
    return "primary";
  }
  return "warning";
}

function resolveVatRateFromPayload(
  payload: Record<string, unknown>,
  fallbackVatRegimeId: string,
) {
  const vatRegimeId = String(payload.vatRegimeId ?? fallbackVatRegimeId);
  return vatRatesByRegimeId[vatRegimeId] ?? 19;
}

function inferVatRegimeId(rate: number) {
  if (Math.abs(rate) < 0.001) {
    return "exempt";
  }
  if (Math.abs(rate - 7) < 0.001) {
    return "reduced";
  }
  return "standard";
}

function normalizePeriodMonth(value: string) {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return `${trimmed}-01`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  if (/^\d{2}\/\d{4}$/.test(trimmed)) {
    const [month, year] = trimmed.split("/");
    return `${year}-${month}-01`;
  }
  return trimmed;
}

function formatPeriodLabel(value: string) {
  const normalized = normalizePeriodMonth(value);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function formatMonthLabel(value: string) {
  const normalized = normalizePeriodMonth(value);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(parsed);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    currency: "TND",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function callRebuildJson<T>(
  path: string,
  accessToken: string,
  options?: RequestInit,
): Promise<T | null> {
  const apiUrl = getRebuildApiUrl();
  if (!apiUrl || !accessToken) {
    return null;
  }

  try {
    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(options?.headers ?? {}),
      },
    });

    if (!response.ok) {
      return null;
    }

    if (response.status === 204) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function callRebuildBinary(
  path: string,
  accessToken: string,
): Promise<RebuildBinaryAsset | null> {
  const apiUrl = getRebuildApiUrl();
  if (!apiUrl || !accessToken) {
    return null;
  }

  try {
    const response = await fetch(`${apiUrl}${path}`, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    return {
      bytes: await response.arrayBuffer(),
      fileName: parseFileName(response.headers.get("content-disposition")) ?? "facture.pdf",
      mimeType: response.headers.get("content-type") ?? "application/pdf",
    };
  } catch {
    return null;
  }
}

function parseFileName(contentDisposition: string | null) {
  const match = /filename="?([^"]+)"?/i.exec(contentDisposition ?? "");
  return match?.[1] ?? null;
}
