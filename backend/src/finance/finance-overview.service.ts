import { Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";

import { AuthenticatedUser } from "@/common/types/authenticated-user.interface";
import {
  formatDateOnly,
  normalizeDate,
  resolveProjectBudget,
  resolveProjectSpent,
  roundTo,
  toNumber,
} from "@/finance/finance-helpers";
import { FinanceStatusService } from "@/finance/finance-status.service";
import { SiteScopeService } from "@/site-reports/site-scope.service";

type InvoiceOverviewRow = {
  amount_paid: number | string;
  amount_ttc: number | string;
  paid_at: string | null;
  created_at: string;
  due_date: string;
  id: string;
  period_month: string;
  status: string;
  tva_amount: number | string;
};

type PaymentOverviewRow = {
  amount: number | string;
  payment_date: string;
};

type ProjectRow = {
  id: string;
  name: string;
};

@Injectable()
export class FinanceOverviewService {
  constructor(
    private readonly siteScope: SiteScopeService,
    private readonly financeStatusService: FinanceStatusService,
  ) {}

  async summary(currentUser: AuthenticatedUser, projectId: string) {
    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      await this.financeStatusService.syncDerivedInvoiceStatuses(
        client,
        currentUser.tenantId,
        projectId,
      );

      const project = await this.getProject(client, projectId);
      const invoices = await this.listInvoices(client, projectId);
      const totals = computeFinanceTotals(invoices);
      const budget = resolveProjectBudget(project.id, project.name);
      const spent = resolveProjectSpent(project.id, project.name);
      const budgetGapPct =
        budget > 0 ? roundTo(((spent - budget) / budget) * 100, 2) : 0;
      const dsoDays = computeDso(invoices);
      const onTimeRate = computeOnTimeBillingRate(invoices);
      const vatDeclared = roundTo(
        invoices
          .filter((invoice) =>
            ["validated", "paid", "partially_paid", "overdue"].includes(invoice.status),
          )
          .reduce((sum, invoice) => sum + toNumber(invoice.tva_amount), 0),
        3,
      );

      return {
        item: {
          budgetTnd: budget,
          budgetVsCostPct: budgetGapPct,
          dsoDays,
          facturationDansLesDelaisPct: onTimeRate,
          montantEnRetard: totals.overdueAmount,
          pendingClientValidations: totals.pendingClientValidations,
          pendingProjectValidations: totals.pendingProjectValidations,
          totalCollected: totals.collectedAmount,
          totalInvoiced: totals.invoicedAmount,
          totalOutstanding: totals.outstandingAmount,
          tvaCollected: totals.vatCollected,
          tvaDeclared: vatDeclared,
          tvaGap: roundTo(Math.max(totals.vatCollected - vatDeclared, 0), 3),
          realCostTnd: spent,
        },
      };
    });
  }

  async cashflow(currentUser: AuthenticatedUser, projectId: string) {
    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      await this.financeStatusService.syncDerivedInvoiceStatuses(
        client,
        currentUser.tenantId,
        projectId,
      );

      const project = await this.getProject(client, projectId);
      const invoices = await this.listInvoices(client, projectId);
      const payments = await this.listPayments(client, projectId);
      const spentTnd = resolveProjectSpent(project.id, project.name);
      const periodMap = new Map<
        string,
        {
          costsReal: number;
          receiptsCollected: number;
          receiptsExpected: number;
        }
      >();

      for (const invoice of invoices) {
        const key = formatDateOnly(invoice.period_month);
        const bucket = periodMap.get(key) ?? {
          costsReal: 0,
          receiptsCollected: 0,
          receiptsExpected: 0,
        };
        bucket.receiptsExpected = roundTo(
          bucket.receiptsExpected + toNumber(invoice.amount_ttc),
          3,
        );
        periodMap.set(key, bucket);
      }

      for (const payment of payments) {
        const key = formatDateOnly(payment.payment_date).slice(0, 7) + "-01";
        const bucket = periodMap.get(key) ?? {
          costsReal: 0,
          receiptsCollected: 0,
          receiptsExpected: 0,
        };
        bucket.receiptsCollected = roundTo(
          bucket.receiptsCollected + toNumber(payment.amount),
          3,
        );
        periodMap.set(key, bucket);
      }

      const expectedTotal = [...periodMap.values()].reduce(
        (sum, item) => sum + item.receiptsExpected,
        0,
      );

      for (const [period, bucket] of periodMap.entries()) {
        const weight = expectedTotal > 0 ? bucket.receiptsExpected / expectedTotal : 0;
        bucket.costsReal = roundTo(spentTnd * weight, 3);
        periodMap.set(period, bucket);
      }

      const series = [...periodMap.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([period, bucket]) => ({
          costsReal: bucket.costsReal,
          period,
          receiptsCollected: bucket.receiptsCollected,
          receiptsExpected: bucket.receiptsExpected,
        }));

      const totals = computeFinanceTotals(invoices);

      return {
        item: {
          projectId,
          projectName: project.name,
          series,
          totals: {
            costsReal: roundTo(series.reduce((sum, item) => sum + item.costsReal, 0), 3),
            overdueAmount: totals.overdueAmount,
            receiptsCollected: roundTo(
              series.reduce((sum, item) => sum + item.receiptsCollected, 0),
              3,
            ),
            receiptsExpected: roundTo(
              series.reduce((sum, item) => sum + item.receiptsExpected, 0),
              3,
            ),
            totalOutstanding: totals.outstandingAmount,
          },
        },
      };
    });
  }

  private async getProject(client: PoolClient, projectId: string) {
    const project = await this.siteScope.getProjectSummary(client, projectId);
    return project as ProjectRow;
  }

  private async listInvoices(client: PoolClient, projectId: string) {
    const result = await client.query<InvoiceOverviewRow>(
      `SELECT id, period_month, amount_ttc, amount_paid, tva_amount, due_date, status::text AS status, created_at
              , paid_at
       FROM invoices
       WHERE project_id = $1
       ORDER BY period_month ASC, created_at ASC`,
      [projectId],
    );

    return result.rows;
  }

  private async listPayments(client: PoolClient, projectId: string) {
    const result = await client.query<PaymentOverviewRow>(
      `SELECT p.amount, p.payment_date
       FROM payments p
       INNER JOIN invoices i
         ON i.id = p.invoice_id
       WHERE i.project_id = $1
       ORDER BY p.payment_date ASC`,
      [projectId],
    );

    return result.rows;
  }
}

function computeFinanceTotals(invoices: InvoiceOverviewRow[]) {
  let invoicedAmount = 0;
  let collectedAmount = 0;
  let outstandingAmount = 0;
  let overdueAmount = 0;
  let pendingProjectValidations = 0;
  let pendingClientValidations = 0;
  let vatCollected = 0;

  for (const invoice of invoices) {
    const amountTtc = toNumber(invoice.amount_ttc);
    const amountPaid = toNumber(invoice.amount_paid);
    const remaining = roundTo(Math.max(amountTtc - amountPaid, 0), 3);

    invoicedAmount += amountTtc;
    collectedAmount += amountPaid;
    outstandingAmount += remaining;
    vatCollected += toNumber(invoice.tva_amount);

    if (invoice.status === "overdue") {
      overdueAmount += remaining;
    }
    if (invoice.status === "project_validation") {
      pendingProjectValidations += 1;
    }
    if (invoice.status === "client_validation") {
      pendingClientValidations += 1;
    }
  }

  return {
    collectedAmount: roundTo(collectedAmount, 3),
    invoicedAmount: roundTo(invoicedAmount, 3),
    outstandingAmount: roundTo(outstandingAmount, 3),
    overdueAmount: roundTo(overdueAmount, 3),
    pendingClientValidations,
    pendingProjectValidations,
    vatCollected: roundTo(vatCollected, 3),
  };
}

function computeDso(invoices: InvoiceOverviewRow[]) {
  const paidInvoices = invoices.filter((invoice) => toNumber(invoice.amount_paid) >= toNumber(invoice.amount_ttc) - 0.0005);
  if (paidInvoices.length === 0) {
    return 0;
  }

  const totalDays = paidInvoices.reduce((sum, invoice) => {
    const start = new Date(invoice.created_at);
    const end = new Date(invoice.paid_at ?? invoice.due_date);
    return sum + Math.max(Math.round((end.getTime() - start.getTime()) / 86_400_000), 0);
  }, 0);

  return Math.round(totalDays / paidInvoices.length);
}

function computeOnTimeBillingRate(invoices: InvoiceOverviewRow[]) {
  if (invoices.length === 0) {
    return 100;
  }

  const compliant = invoices.filter((invoice) => {
    const createdAt = new Date(invoice.created_at);
    const periodMonth = new Date(normalizeDate(invoice.period_month));
    const graceDeadline = new Date(
      Date.UTC(periodMonth.getUTCFullYear(), periodMonth.getUTCMonth() + 1, 10),
    );

    return createdAt.getTime() <= graceDeadline.getTime();
  }).length;

  return Math.round((compliant / invoices.length) * 100);
}
