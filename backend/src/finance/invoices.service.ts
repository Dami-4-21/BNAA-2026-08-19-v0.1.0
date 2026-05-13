import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";

import { pilotProjects } from "@/bootstrap/pilot-catalog";
import { AuthenticatedUser } from "@/common/types/authenticated-user.interface";
import { CreateInvoiceDto } from "@/finance/dto/create-invoice.dto";
import { PdfService } from "@/pdf/pdf.service";
import { SiteScopeService } from "@/site-reports/site-scope.service";

const DEFAULT_TVA_RATE = 19;
const DEFAULT_PAYMENT_TERM_DAYS = 30;

const pilotCodeByProjectId = new Map(
  pilotProjects.map((project) => [project.backendId, project.code]),
);
const pilotClientByProjectId = new Map(
  pilotProjects.map((project) => [project.backendId, project.client]),
);

type InvoiceRow = {
  amount_ht: number | string;
  amount_paid: number | string;
  amount_ttc: number | string;
  created_at: string;
  created_by: string;
  due_date: string;
  id: string;
  invoice_number: string;
  pdf_url: string | null;
  period_month: string;
  project_id: string;
  project_name?: string | null;
  statement_id: string | null;
  status: string;
  tva_amount: number | string;
  tva_rate: number | string;
};

type StatementRow = {
  advance_deduction: number | string;
  created_at: string;
  created_by: string;
  id: string;
  line_items: unknown;
  net_payable_ht: number | string;
  period_month: string;
  project_id: string;
  retention_amount: number | string;
  retention_pct: number | string;
  status: string;
  subtotal_ht: number | string;
};

type ProjectRow = {
  id: string;
  name: string;
};

type PaymentRow = {
  amount: number | string;
  bank_reference: string | null;
  created_at: string;
  id: string;
  notes: string | null;
  payment_date: string;
  recorded_by: string;
};

type StatementLineItem = {
  amountHt: number;
  calculationMode?: string;
  lot: string;
  progressPct: number;
  tasks: string[];
};

@Injectable()
export class InvoicesService {
  constructor(
    private readonly pdfService: PdfService,
    private readonly siteScope: SiteScopeService,
  ) {}

  async list(currentUser: AuthenticatedUser, projectId: string) {
    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      const result = await client.query<InvoiceRow>(
        `SELECT
           i.id,
           i.project_id,
           p.name AS project_name,
           i.statement_id,
           i.invoice_number,
           i.period_month,
           i.amount_ht,
           i.tva_rate,
           i.tva_amount,
           i.amount_ttc,
           i.amount_paid,
           i.due_date,
           i.status,
           i.pdf_url,
           i.created_by,
           i.created_at
         FROM invoices i
         INNER JOIN projects p
           ON p.id = i.project_id
         WHERE i.project_id = $1
         ORDER BY i.created_at DESC`,
        [projectId],
      );

      return {
        items: result.rows.map((row) => this.mapInvoiceRow(row)),
      };
    });
  }

  async detail(currentUser: AuthenticatedUser, projectId: string, invoiceId: string) {
    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      const invoice = await this.getInvoice(client, projectId, invoiceId);
      const statement = invoice.statement_id
        ? await this.getStatement(client, projectId, invoice.statement_id)
        : null;
      const payments = await client.query<PaymentRow>(
        `SELECT id, amount, payment_date, bank_reference, notes, recorded_by, created_at
         FROM payments
         WHERE invoice_id = $1
         ORDER BY payment_date DESC, created_at DESC`,
        [invoiceId],
      );

      return {
        item: this.mapInvoiceRow(invoice),
        statement: statement ? this.mapStatementSummary(statement) : null,
        payments: payments.rows.map((row) => ({
          amount: toNumber(row.amount),
          bankReference: row.bank_reference,
          createdAt: row.created_at,
          id: row.id,
          notes: row.notes,
          paymentDate: formatDateOnly(row.payment_date),
          recordedBy: row.recorded_by,
        })),
      };
    });
  }

  async create(currentUser: AuthenticatedUser, projectId: string, payload: CreateInvoiceDto) {
    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      const project = await this.getProject(client, projectId);
      const statement = await this.getStatement(client, projectId, payload.statementId);

      const existing = await client.query<{ id: string }>(
        `SELECT id
         FROM invoices
         WHERE statement_id = $1
         LIMIT 1`,
        [statement.id],
      );

      if (existing.rowCount) {
        throw new ConflictException("An invoice already exists for this monthly statement.");
      }

      const amountHt = roundTo(toNumber(statement.net_payable_ht), 3);
      if (amountHt <= 0) {
        throw new BadRequestException(
          "The monthly statement has no payable amount left to invoice.",
        );
      }

      const invoiceId = uuidv4();
      const tvaRate = roundTo(payload.tvaRate ?? DEFAULT_TVA_RATE, 2);
      const tvaAmount = roundTo(amountHt * (tvaRate / 100), 3);
      const amountTtc = roundTo(amountHt + tvaAmount, 3);
      const invoiceNumber = await this.buildInvoiceNumber(client, projectId, statement.period_month);
      const dueDate = payload.dueDate
        ? normalizeDate(payload.dueDate)
        : defaultDueDate(statement.period_month);

      const pdfResult = await this.pdfService.generateInvoicePdf({
        amountHt,
        amountTtc,
        clientName: pilotClientByProjectId.get(projectId) ?? project.name,
        createdBy: currentUser.fullName,
        dueDate,
        invoiceId,
        invoiceNumber,
        lineItems: parseStatementLineItems(statement.line_items),
        netPayableHt: amountHt,
        periodMonth: statement.period_month,
        projectId,
        projectName: project.name,
        retentionAmount: toNumber(statement.retention_amount),
        retentionPct: toNumber(statement.retention_pct),
        statementId: statement.id,
        subtotalHt: toNumber(statement.subtotal_ht),
        tvaAmount,
        tvaRate,
      });

      await client.query(
        `INSERT INTO invoices (
          id,
          project_id,
          statement_id,
          invoice_number,
          period_month,
          amount_ht,
          tva_rate,
          tva_amount,
          amount_ttc,
          amount_paid,
          due_date,
          status,
          pdf_url,
          created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10, 'issued', $11, $12
        )`,
        [
          invoiceId,
          projectId,
          statement.id,
          invoiceNumber,
          normalizeDate(statement.period_month),
          amountHt,
          tvaRate,
          tvaAmount,
          amountTtc,
          dueDate,
          pdfResult.pdfUrl,
          currentUser.sub,
        ],
      );

      const created = await this.getInvoice(client, projectId, invoiceId);

      return {
        item: this.mapInvoiceRow(created),
        pdf: {
          fileName: pdfResult.fileName,
          pdfUrl: pdfResult.pdfUrl,
        },
      };
    });
  }

  async downloadPdf(currentUser: AuthenticatedUser, projectId: string, invoiceId: string) {
    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      const invoice = await this.getInvoice(client, projectId, invoiceId);

      let buffer: Buffer;
      try {
        buffer = await this.pdfService.readInvoicePdf(invoiceId);
      } catch {
        const project = await this.getProject(client, projectId);
        const statement = invoice.statement_id
          ? await this.getStatement(client, projectId, invoice.statement_id)
          : null;

        const pdfResult = await this.pdfService.generateInvoicePdf({
          amountHt: toNumber(invoice.amount_ht),
          amountTtc: toNumber(invoice.amount_ttc),
          clientName: pilotClientByProjectId.get(projectId) ?? project.name,
          createdBy: String(invoice.created_by),
          dueDate: normalizeDate(invoice.due_date),
          invoiceId,
          invoiceNumber: invoice.invoice_number,
          lineItems: statement ? parseStatementLineItems(statement.line_items) : [],
          netPayableHt: toNumber(invoice.amount_ht),
          periodMonth: normalizeDate(invoice.period_month),
          projectId,
          projectName: project.name,
          retentionAmount: statement ? toNumber(statement.retention_amount) : 0,
          retentionPct: statement ? toNumber(statement.retention_pct) : 0,
          statementId: invoice.statement_id ?? "",
          subtotalHt: statement ? toNumber(statement.subtotal_ht) : toNumber(invoice.amount_ht),
          tvaAmount: toNumber(invoice.tva_amount),
          tvaRate: toNumber(invoice.tva_rate),
        });

        if (String(invoice.pdf_url ?? "") !== pdfResult.pdfUrl) {
          await client.query(
            `UPDATE invoices
             SET pdf_url = $3
             WHERE id = $1 AND project_id = $2`,
            [invoiceId, projectId, pdfResult.pdfUrl],
          );
        }

        buffer = pdfResult.buffer;
      }

      return {
        buffer,
        fileName: buildInvoiceFileName(invoice.invoice_number),
      };
    });
  }

  private async getProject(client: PoolClient, projectId: string) {
    const result = await client.query<ProjectRow>(
      `SELECT id, name
       FROM projects
       WHERE id = $1
       LIMIT 1`,
      [projectId],
    );

    if (!result.rowCount) {
      throw new NotFoundException("Project not found.");
    }

    return result.rows[0];
  }

  private async getStatement(client: PoolClient, projectId: string, statementId: string) {
    const result = await client.query<StatementRow>(
      `SELECT
         id,
         project_id,
         period_month,
         line_items,
         subtotal_ht,
         retention_pct,
         retention_amount,
         advance_deduction,
         net_payable_ht,
         status,
         created_by,
         created_at
       FROM statements
       WHERE project_id = $1
         AND id = $2
       LIMIT 1`,
      [projectId, statementId],
    );

    if (!result.rowCount) {
      throw new NotFoundException("Monthly statement not found.");
    }

    return result.rows[0];
  }

  private async getInvoice(client: PoolClient, projectId: string, invoiceId: string) {
    const result = await client.query<InvoiceRow>(
      `SELECT
         i.id,
         i.project_id,
         p.name AS project_name,
         i.statement_id,
         i.invoice_number,
         i.period_month,
         i.amount_ht,
         i.tva_rate,
         i.tva_amount,
         i.amount_ttc,
         i.amount_paid,
         i.due_date,
         i.status,
         i.pdf_url,
         i.created_by,
         i.created_at
       FROM invoices i
       INNER JOIN projects p
         ON p.id = i.project_id
       WHERE i.project_id = $1
         AND i.id = $2
       LIMIT 1`,
      [projectId, invoiceId],
    );

    if (!result.rowCount) {
      throw new NotFoundException("Invoice not found.");
    }

    return result.rows[0];
  }

  private async buildInvoiceNumber(
    client: PoolClient,
    projectId: string,
    periodMonth: string,
  ) {
    const year = normalizeDate(periodMonth).slice(0, 4);
    const projectCode = resolveProjectCode(projectId);
    const result = await client.query<{ invoice_number: string }>(
      `SELECT invoice_number
       FROM invoices
       WHERE invoice_number LIKE $1
       ORDER BY invoice_number DESC`,
      [`FAC-${year}-${projectCode}-%`],
    );

    let nextSequence = 1;
    if (result.rowCount) {
      const latest = result.rows[0]?.invoice_number ?? "";
      const match = latest.match(/-(\d{3})$/);
      if (match) {
        nextSequence = Number(match[1]) + 1;
      }
    }

    return `FAC-${year}-${projectCode}-${String(nextSequence).padStart(3, "0")}`;
  }

  private mapInvoiceRow(row: InvoiceRow) {
    const amountTtc = toNumber(row.amount_ttc);
    const amountPaid = toNumber(row.amount_paid);
    const remainingAmount = roundTo(Math.max(amountTtc - amountPaid, 0), 3);

    return {
      amountHt: toNumber(row.amount_ht),
      amountPaid,
      amountTtc,
      createdAt: row.created_at,
      createdBy: row.created_by,
      dueDate: formatDateOnly(row.due_date),
      id: row.id,
      invoiceNumber: row.invoice_number,
      pdfUrl: row.pdf_url,
      periodMonth: formatDateOnly(row.period_month),
      projectId: row.project_id,
      projectName: row.project_name ?? null,
      remainingAmount,
      statementId: row.statement_id,
      status: row.status,
      tvaAmount: toNumber(row.tva_amount),
      tvaRate: toNumber(row.tva_rate),
    };
  }

  private mapStatementSummary(row: StatementRow) {
    return {
      advanceDeduction: toNumber(row.advance_deduction),
      createdAt: row.created_at,
      createdBy: row.created_by,
      id: row.id,
      lineItems: parseStatementLineItems(row.line_items),
      netPayableHt: toNumber(row.net_payable_ht),
      periodMonth: formatDateOnly(row.period_month),
      retentionAmount: toNumber(row.retention_amount),
      retentionPct: toNumber(row.retention_pct),
      status: row.status,
      subtotalHt: toNumber(row.subtotal_ht),
    };
  }
}

function parseStatementLineItems(raw: unknown): StatementLineItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const parsed = raw
    .map((item): StatementLineItem | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const lot = String(record.lot ?? "").trim();
      if (!lot) {
        return null;
      }

      const tasks = Array.isArray(record.tasks)
        ? record.tasks
            .map((task) => String(task ?? "").trim())
            .filter((task) => task.length > 0)
        : [];

      return {
        amountHt: roundTo(toNumber(record.amountHt), 3),
        calculationMode:
          typeof record.calculationMode === "string" && record.calculationMode.trim().length > 0
            ? record.calculationMode.trim()
            : undefined,
        lot,
        progressPct: roundTo(toNumber(record.progressPct), 2),
        tasks,
      };
    });

  return parsed.filter((item): item is StatementLineItem => item !== null);
}

function resolveProjectCode(projectId: string) {
  const pilotCode = pilotCodeByProjectId.get(projectId);
  if (pilotCode) {
    return pilotCode.replace(/[^A-Za-z0-9]/g, "");
  }

  return projectId.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase() || "PRJ";
}

function buildInvoiceFileName(invoiceNumber: string) {
  return `${invoiceNumber}.pdf`;
}

function normalizeDate(input: string) {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException("Invalid date.");
  }

  return parsed.toISOString().slice(0, 10);
}

function defaultDueDate(periodMonth: string) {
  const parsed = new Date(normalizeDate(periodMonth));
  parsed.setUTCMonth(parsed.getUTCMonth() + 1);
  parsed.setUTCDate(parsed.getUTCDate() + DEFAULT_PAYMENT_TERM_DAYS - 1);
  return parsed.toISOString().slice(0, 10);
}

function formatDateOnly(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const raw = String(value ?? "").trim();
  return raw.length >= 10 ? raw.slice(0, 10) : raw;
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  return 0;
}

function roundTo(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
