import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import type { PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";

import { AuthenticatedUser } from "@/common/types/authenticated-user.interface";
import { CreateInvoiceDto } from "@/finance/dto/create-invoice.dto";
import { UpdateInvoiceStatusDto } from "@/finance/dto/update-invoice-status.dto";
import { ValidateInvoiceDto } from "@/finance/dto/validate-invoice.dto";
import { FinanceDocumentsService } from "@/finance/finance-documents.service";
import {
  formatDateOnly,
  normalizeDate,
  resolveProjectClient,
  resolveProjectCode,
  roundTo,
  toNumber,
} from "@/finance/finance-helpers";
import { FinanceStatusService } from "@/finance/finance-status.service";
import { MailService } from "@/mail/mail.service";
import { NotificationsService } from "@/notifications/notifications.service";
import { PdfService } from "@/pdf/pdf.service";
import { SiteScopeService } from "@/site-reports/site-scope.service";

const DEFAULT_TVA_RATE = 19;
const DEFAULT_PAYMENT_TERM_DAYS = 30;

type InvoiceRow = {
  amount_ht: number | string;
  amount_paid: number | string;
  amount_ttc: number | string;
  client_validated_at: string | null;
  client_validated_by: string | null;
  created_at: string;
  created_by: string;
  due_date: string;
  id: string;
  invoice_number: string;
  paid_at: string | null;
  pdf_url: string | null;
  period_month: string;
  project_id: string;
  project_name?: string | null;
  project_validated_at: string | null;
  project_validated_by: string | null;
  sent_at: string | null;
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
  pdf_url: string | null;
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
  receipt_pdf_url: string | null;
  recorded_by: string;
};

type StatementLineItem = {
  amountHt: number;
  calculationMode?: string;
  lot: string;
  progressPct: number;
  tasks: string[];
};

type ValidationStage = "client" | "project";

@Injectable()
export class InvoicesService {
  constructor(
    private readonly pdfService: PdfService,
    private readonly siteScope: SiteScopeService,
    private readonly financeDocumentsService: FinanceDocumentsService,
    private readonly financeStatusService: FinanceStatusService,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
  ) {}

  async list(currentUser: AuthenticatedUser, projectId: string) {
    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      await this.financeStatusService.syncDerivedInvoiceStatuses(
        client,
        currentUser.tenantId,
        projectId,
      );

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
           i.status::text AS status,
           i.sent_at,
           i.project_validated_by,
           i.project_validated_at,
           i.client_validated_by,
           i.client_validated_at,
           i.paid_at,
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
      await this.financeStatusService.syncDerivedInvoiceStatuses(
        client,
        currentUser.tenantId,
        projectId,
      );

      const invoice = await this.getInvoice(client, projectId, invoiceId);
      const statement = invoice.statement_id
        ? await this.getStatement(client, projectId, invoice.statement_id)
        : null;
      const payments = await client.query<PaymentRow>(
        `SELECT id, amount, payment_date, bank_reference, receipt_pdf_url, notes, recorded_by, created_at
         FROM payments
         WHERE invoice_id = $1
         ORDER BY payment_date DESC, created_at DESC`,
        [invoiceId],
      );

      return {
        item: this.mapInvoiceRow(invoice),
        payments: payments.rows.map((row) => ({
          amount: toNumber(row.amount),
          bankReference: row.bank_reference,
          createdAt: row.created_at,
          id: row.id,
          notes: row.notes,
          paymentDate: formatDateOnly(row.payment_date),
          receiptPdfUrl: row.receipt_pdf_url,
          recordedBy: row.recorded_by,
        })),
        statement: statement ? this.mapStatementSummary(statement) : null,
        workflow: this.mapWorkflowState(invoice),
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
      const invoiceNumber = await this.buildInvoiceNumber(client, projectId, project.name, statement.period_month);
      const dueDate = payload.dueDate
        ? normalizeDate(payload.dueDate)
        : defaultDueDate(statement.period_month);

      const pdfResult = await this.pdfService.generateInvoicePdf({
        amountHt,
        amountTtc,
        clientName: resolveProjectClient(projectId, project.name),
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
          $1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10,
          'draft'::tenant_template."InvoiceStatus",
          $11, $12
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

      const statementDocumentId = await this.financeDocumentsService.findDocumentIdBySourceRecord(
        client,
        projectId,
        statement.id,
      );

      await this.financeDocumentsService.syncInvoicePdf(client, {
        documentCode: invoiceNumber,
        fileBuffer: pdfResult.buffer,
        fileName: pdfResult.fileName,
        parentDocumentId: statementDocumentId,
        pdfUrl: pdfResult.pdfUrl,
        projectId,
        projectName: project.name,
        recordedBy: currentUser.sub,
        sourceRecordId: invoiceId,
        title: `Facture client ${invoiceNumber}`,
      });

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

  async send(currentUser: AuthenticatedUser, projectId: string, invoiceId: string) {
    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      const invoice = await this.getInvoice(client, projectId, invoiceId);
      if (!["draft", "issued"].includes(invoice.status)) {
        throw new ConflictException("Only draft invoices can be sent into the validation workflow.");
      }

      await client.query(
        `UPDATE invoices
         SET status = 'project_validation'::tenant_template."InvoiceStatus",
             sent_at = COALESCE(sent_at, NOW())
         WHERE id = $1
           AND project_id = $2`,
        [invoiceId, projectId],
      );

      const project = await this.getProject(client, projectId);
      const recipients = await this.siteScope.listProjectUsersByRoles(client, currentUser.tenantId, projectId, [
        UserRole.CP,
      ]);
      const targetRecipients = recipients.filter((recipient) => recipient.id !== currentUser.sub);

      if (targetRecipients.length > 0) {
        await this.notificationsService.createForUsers(client, {
          userIds: targetRecipients.map((recipient) => recipient.id),
          projectId,
          type: "finance.invoice.project_validation",
          title: "Validation projet requise",
          body: `${invoice.invoice_number} attend la validation projet.`,
          link: `/finance?invoice=${invoiceId}&section=facturation`,
        });

        for (const recipient of targetRecipients) {
          await this.mailService.sendInvoiceProjectValidationEmail({
            amountTtc: toNumber(invoice.amount_ttc),
            invoiceLink: `/finance?invoice=${invoiceId}&section=facturation`,
            invoiceNumber: invoice.invoice_number,
            projectName: project.name,
            recipientEmail: recipient.email,
            recipientName: recipient.fullName,
          });
        }
      }

      return {
        item: this.mapInvoiceRow(await this.getInvoice(client, projectId, invoiceId)),
      };
    });
  }

  async validate(
    currentUser: AuthenticatedUser,
    projectId: string,
    invoiceId: string,
    payload: ValidateInvoiceDto,
  ) {
    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      const invoice = await this.getInvoice(client, projectId, invoiceId);
      const project = await this.getProject(client, projectId);
      const stage = this.resolveValidationStage(currentUser, invoice, payload);

      if (stage === "project") {
        if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.CP) {
          throw new ForbiddenException("Only the project approver can validate this invoice.");
        }

        if (!["project_validation", "issued"].includes(invoice.status)) {
          throw new ConflictException("This invoice is not waiting for project validation.");
        }

        await client.query(
          `UPDATE invoices
           SET status = 'client_validation'::tenant_template."InvoiceStatus",
               sent_at = COALESCE(sent_at, NOW()),
               project_validated_by = $3,
               project_validated_at = NOW()
           WHERE id = $1
             AND project_id = $2`,
          [invoiceId, projectId, currentUser.sub],
        );

        const recipients = await this.siteScope.listProjectUsersByRoles(client, currentUser.tenantId, projectId, [
          UserRole.MO,
        ]);
        const targetRecipients = recipients.filter((recipient) => recipient.id !== currentUser.sub);

        if (targetRecipients.length > 0) {
          await this.notificationsService.createForUsers(client, {
            userIds: targetRecipients.map((recipient) => recipient.id),
            projectId,
            type: "finance.invoice.client_validation",
            title: "Validation client requise",
            body: `${invoice.invoice_number} attend la validation client.`,
            link: `/finance?invoice=${invoiceId}&section=facturation`,
          });

          for (const recipient of targetRecipients) {
            await this.mailService.sendInvoiceClientValidationEmail({
              amountTtc: toNumber(invoice.amount_ttc),
              invoiceLink: `/finance?invoice=${invoiceId}&section=facturation`,
              invoiceNumber: invoice.invoice_number,
              projectName: project.name,
              recipientEmail: recipient.email,
              recipientName: recipient.fullName,
            });
          }
        }
      } else {
        if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.MO) {
          throw new ForbiddenException("Only the client approver can validate this invoice.");
        }

        if (invoice.status !== "client_validation") {
          throw new ConflictException("This invoice is not waiting for client validation.");
        }

        await client.query(
          `UPDATE invoices
           SET status = 'validated'::tenant_template."InvoiceStatus",
               client_validated_by = $3,
               client_validated_at = NOW()
           WHERE id = $1
             AND project_id = $2`,
          [invoiceId, projectId, currentUser.sub],
        );

        const recipients = await this.siteScope.listProjectUsersByRoles(client, currentUser.tenantId, projectId, [
          UserRole.CO,
        ]);
        const targetRecipients = recipients.filter((recipient) => recipient.id !== currentUser.sub);

        if (targetRecipients.length > 0) {
          await this.notificationsService.createForUsers(client, {
            userIds: targetRecipients.map((recipient) => recipient.id),
            projectId,
            type: "finance.invoice.validated",
            title: "Facture validee",
            body: `${invoice.invoice_number} peut passer en encaissement.`,
            link: `/finance?invoice=${invoiceId}&section=collections`,
          });

          for (const recipient of targetRecipients) {
            await this.mailService.sendInvoiceValidatedEmail({
              amountTtc: toNumber(invoice.amount_ttc),
              invoiceLink: `/finance?invoice=${invoiceId}&section=collections`,
              invoiceNumber: invoice.invoice_number,
              projectName: project.name,
              recipientEmail: recipient.email,
              recipientName: recipient.fullName,
            });
          }
        }
      }

      return {
        item: this.mapInvoiceRow(await this.getInvoice(client, projectId, invoiceId)),
      };
    });
  }

  async updateStatus(
    currentUser: AuthenticatedUser,
    projectId: string,
    invoiceId: string,
    payload: UpdateInvoiceStatusDto,
  ) {
    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      const invoice = await this.getInvoice(client, projectId, invoiceId);
      const nextStatus = payload.status;

      if (
        currentUser.role !== UserRole.ADMIN &&
        currentUser.role !== UserRole.CO &&
        currentUser.role !== UserRole.CP
      ) {
        throw new ForbiddenException("You are not allowed to update this invoice status manually.");
      }

      if (nextStatus === "validated" && !invoice.client_validated_at && currentUser.role !== UserRole.ADMIN) {
        throw new ForbiddenException("Validated status requires completed client validation.");
      }

      const sentAt =
        nextStatus === "issued" || nextStatus === "project_validation" || nextStatus === "client_validation" || nextStatus === "validated"
          ? invoice.sent_at ?? new Date().toISOString()
          : nextStatus === "draft"
            ? null
            : invoice.sent_at;

      await client.query(
        `UPDATE invoices
         SET status = CAST($3 AS text)::tenant_template."InvoiceStatus",
             sent_at = $4,
             project_validated_by = CASE
               WHEN $3 = 'draft' THEN NULL
               ELSE project_validated_by
             END,
             project_validated_at = CASE
               WHEN $3 = 'draft' THEN NULL
               ELSE project_validated_at
             END,
             client_validated_by = CASE
               WHEN $3 IN ('draft', 'issued', 'project_validation') THEN NULL
               ELSE client_validated_by
             END,
             client_validated_at = CASE
               WHEN $3 IN ('draft', 'issued', 'project_validation') THEN NULL
               ELSE client_validated_at
             END
         WHERE id = $1
           AND project_id = $2`,
        [invoiceId, projectId, nextStatus, sentAt],
      );

      return {
        item: this.mapInvoiceRow(await this.getInvoice(client, projectId, invoiceId)),
      };
    });
  }

  async downloadPdf(currentUser: AuthenticatedUser, projectId: string, invoiceId: string) {
    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      const invoice = await this.getInvoice(client, projectId, invoiceId);
      const project = await this.getProject(client, projectId);
      const statement = invoice.statement_id
        ? await this.getStatement(client, projectId, invoice.statement_id)
        : null;

      let buffer: Buffer;
      try {
        buffer = await this.pdfService.readInvoicePdf(invoiceId);
      } catch {
        const pdfResult = await this.pdfService.generateInvoicePdf({
          amountHt: toNumber(invoice.amount_ht),
          amountTtc: toNumber(invoice.amount_ttc),
          clientName: resolveProjectClient(projectId, project.name),
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

        await client.query(
          `UPDATE invoices
           SET pdf_url = $3
           WHERE id = $1
             AND project_id = $2`,
          [invoiceId, projectId, pdfResult.pdfUrl],
        );

        const statementDocumentId = invoice.statement_id
          ? await this.financeDocumentsService.findDocumentIdBySourceRecord(client, projectId, invoice.statement_id)
          : null;

        await this.financeDocumentsService.syncInvoicePdf(client, {
          documentCode: invoice.invoice_number,
          fileBuffer: pdfResult.buffer,
          fileName: pdfResult.fileName,
          parentDocumentId: statementDocumentId,
          pdfUrl: pdfResult.pdfUrl,
          projectId,
          projectName: project.name,
          recordedBy: String(invoice.created_by),
          sourceRecordId: invoiceId,
          title: `Facture client ${invoice.invoice_number}`,
        });

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
         pdf_url,
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
         i.status::text AS status,
         i.sent_at,
         i.project_validated_by,
         i.project_validated_at,
         i.client_validated_by,
         i.client_validated_at,
         i.paid_at,
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
    projectName: string,
    periodMonth: string,
  ) {
    const year = normalizeDate(periodMonth).slice(0, 4);
    const projectCode = resolveProjectCode(projectId, projectName);
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

  private resolveValidationStage(
    currentUser: AuthenticatedUser,
    invoice: InvoiceRow,
    payload: ValidateInvoiceDto,
  ): ValidationStage {
    if (payload.stage) {
      return payload.stage;
    }

    if (invoice.status === "project_validation" || invoice.status === "issued") {
      return "project";
    }

    if (invoice.status === "client_validation") {
      return "client";
    }

    if (currentUser.role === UserRole.MO) {
      return "client";
    }

    return "project";
  }

  private mapInvoiceRow(row: InvoiceRow) {
    const amountTtc = toNumber(row.amount_ttc);
    const amountPaid = toNumber(row.amount_paid);
    const remainingAmount = roundTo(Math.max(amountTtc - amountPaid, 0), 3);

    return {
      amountHt: toNumber(row.amount_ht),
      amountPaid,
      amountTtc,
      clientValidatedAt: row.client_validated_at,
      clientValidatedBy: row.client_validated_by,
      createdAt: row.created_at,
      createdBy: row.created_by,
      dueDate: formatDateOnly(row.due_date),
      id: row.id,
      invoiceNumber: row.invoice_number,
      paidAt: row.paid_at,
      pdfUrl: row.pdf_url,
      periodMonth: formatDateOnly(row.period_month),
      projectId: row.project_id,
      projectName: row.project_name ?? null,
      projectValidatedAt: row.project_validated_at,
      projectValidatedBy: row.project_validated_by,
      remainingAmount,
      sentAt: row.sent_at,
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
      pdfUrl: row.pdf_url,
      periodMonth: formatDateOnly(row.period_month),
      retentionAmount: toNumber(row.retention_amount),
      retentionPct: toNumber(row.retention_pct),
      status: row.status,
      subtotalHt: toNumber(row.subtotal_ht),
    };
  }

  private mapWorkflowState(row: InvoiceRow) {
    return {
      clientValidatedAt: row.client_validated_at,
      clientValidatedBy: row.client_validated_by,
      paidAt: row.paid_at,
      projectValidatedAt: row.project_validated_at,
      projectValidatedBy: row.project_validated_by,
      sentAt: row.sent_at,
      status: row.status,
    };
  }
}

function parseStatementLineItems(raw: unknown): StatementLineItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const parsed = raw.map((item): StatementLineItem | null => {
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

function buildInvoiceFileName(invoiceNumber: string) {
  return `${invoiceNumber}.pdf`;
}

function defaultDueDate(periodMonth: string) {
  const parsed = new Date(normalizeDate(periodMonth));
  parsed.setUTCMonth(parsed.getUTCMonth() + 1);
  parsed.setUTCDate(parsed.getUTCDate() + DEFAULT_PAYMENT_TERM_DAYS - 1);
  return parsed.toISOString().slice(0, 10);
}
