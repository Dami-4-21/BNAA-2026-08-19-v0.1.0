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
import { FinanceDocumentsService } from "@/finance/finance-documents.service";
import {
  buildPaymentDocumentCode,
  formatDateOnly,
  normalizeDate,
  roundTo,
  toNumber,
} from "@/finance/finance-helpers";
import { RegisterPaymentDto } from "@/finance/dto/register-payment.dto";
import { MailService } from "@/mail/mail.service";
import { NotificationsService } from "@/notifications/notifications.service";
import { PdfService } from "@/pdf/pdf.service";
import { SiteScopeService } from "@/site-reports/site-scope.service";

type InvoiceRow = {
  amount_paid: number | string;
  amount_ttc: number | string;
  id: string;
  invoice_number: string;
  paid_at: string | null;
  project_id: string;
  project_name?: string | null;
  status: string;
};

type PaymentRow = {
  amount: number | string;
  created_at: string;
  id: string;
  payment_date: string;
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly siteScope: SiteScopeService,
    private readonly pdfService: PdfService,
    private readonly financeDocumentsService: FinanceDocumentsService,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
  ) {}

  async register(
    currentUser: AuthenticatedUser,
    projectId: string,
    invoiceId: string,
    payload: RegisterPaymentDto,
  ) {
    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.CO) {
        throw new ForbiddenException("Only finance users can register payments.");
      }

      const invoice = await this.getInvoice(client, projectId, invoiceId);
      if (!["validated", "partially_paid", "overdue"].includes(invoice.status)) {
        throw new ConflictException("Payment can only be recorded after client validation.");
      }

      const amount = roundTo(payload.amount, 3);
      const amountTtc = roundTo(toNumber(invoice.amount_ttc), 3);
      const currentPaid = roundTo(toNumber(invoice.amount_paid), 3);
      const nextPaid = roundTo(currentPaid + amount, 3);

      if (nextPaid - amountTtc > 0.0005) {
        throw new BadRequestException("Payment amount exceeds the remaining invoice balance.");
      }

      const paymentId = uuidv4();
      const paymentDate = normalizeDate(payload.paymentDate);
      const project = await this.siteScope.getProjectSummary(client, projectId);
      const pdf = await this.pdfService.generatePaymentReceiptPdf({
        amount,
        bankReference: payload.bankReference ?? null,
        createdBy: currentUser.fullName,
        invoiceNumber: invoice.invoice_number,
        paymentDate,
        paymentId,
        projectId,
        projectName: project.name,
      });

      await client.query(
        `INSERT INTO payments (
          id,
          invoice_id,
          amount,
          payment_date,
          bank_reference,
          receipt_pdf_url,
          notes,
          recorded_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          paymentId,
          invoiceId,
          amount,
          paymentDate,
          payload.bankReference?.trim() || null,
          pdf.pdfUrl,
          payload.notes?.trim() || null,
          currentUser.sub,
        ],
      );

      const fullyPaid = nextPaid >= amountTtc - 0.0005;
      await client.query(
        `UPDATE invoices
         SET amount_paid = $3,
             paid_at = CASE WHEN $4 THEN NOW() ELSE paid_at END,
             status = CASE
               WHEN $4 THEN 'paid'::tenant_template."InvoiceStatus"
               ELSE 'partially_paid'::tenant_template."InvoiceStatus"
             END
         WHERE id = $1
           AND project_id = $2`,
        [invoiceId, projectId, nextPaid, fullyPaid],
      );

      const invoiceDocumentId = await this.financeDocumentsService.findDocumentIdBySourceRecord(
        client,
        projectId,
        invoiceId,
      );

      await this.financeDocumentsService.syncPaymentProof(client, {
        documentCode: buildPaymentDocumentCode(
          invoice.invoice_number,
          await this.countInvoicePayments(client, invoiceId),
        ),
        fileBuffer: pdf.buffer,
        fileName: pdf.fileName,
        parentDocumentId: invoiceDocumentId,
        pdfUrl: pdf.pdfUrl,
        projectId,
        projectName: project.name,
        recordedBy: currentUser.sub,
        sourceRecordId: paymentId,
        title: `Preuve de paiement ${invoice.invoice_number} - ${formatDateOnly(paymentDate)}`,
      });

      await this.notifyPaymentRecorded(
        client,
        currentUser,
        projectId,
        project.name,
        invoice.invoice_number,
        invoiceId,
        amount,
        paymentDate,
      );

      const recorded = await this.getPayment(client, paymentId);

      return {
        invoice: {
          amountPaid: nextPaid,
          amountTtc,
          id: invoiceId,
          invoiceNumber: invoice.invoice_number,
          remainingAmount: roundTo(Math.max(amountTtc - nextPaid, 0), 3),
          status: fullyPaid ? "paid" : "partially_paid",
        },
        payment: {
          amount: toNumber(recorded.amount),
          createdAt: recorded.created_at,
          id: recorded.id,
          paymentDate: formatDateOnly(recorded.payment_date),
          receiptPdfUrl: pdf.pdfUrl,
        },
      };
    });
  }

  private async getInvoice(client: PoolClient, projectId: string, invoiceId: string) {
    const result = await client.query<InvoiceRow>(
      `SELECT
         i.id,
         i.project_id,
         p.name AS project_name,
         i.invoice_number,
         i.amount_ttc,
         i.amount_paid,
         i.status::text AS status,
         i.paid_at
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

  private async getPayment(client: PoolClient, paymentId: string) {
    const result = await client.query<PaymentRow>(
      `SELECT id, amount, payment_date, created_at
       FROM payments
       WHERE id = $1
       LIMIT 1`,
      [paymentId],
    );

    if (!result.rowCount) {
      throw new NotFoundException("Payment not found.");
    }

    return result.rows[0];
  }

  private async countInvoicePayments(client: PoolClient, invoiceId: string) {
    const result = await client.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM payments
       WHERE invoice_id = $1`,
      [invoiceId],
    );

    return Number(result.rows[0]?.total ?? "0");
  }

  private async notifyPaymentRecorded(
    client: PoolClient,
    currentUser: AuthenticatedUser,
    projectId: string,
    projectName: string,
    invoiceNumber: string,
    invoiceId: string,
    amount: number,
    paymentDate: string,
  ) {
    const recipients = await this.siteScope.listProjectUsersByRoles(client, currentUser.tenantId, projectId, [
      UserRole.CP,
      UserRole.MO,
      UserRole.CO,
    ]);
    const targetRecipients = recipients.filter((recipient) => recipient.id !== currentUser.sub);

    if (targetRecipients.length === 0) {
      return;
    }

    await this.notificationsService.createForUsers(client, {
      userIds: targetRecipients.map((recipient) => recipient.id),
      projectId,
      type: "finance.payment.recorded",
      title: "Paiement enregistre",
      body: `${invoiceNumber} a recu un encaissement de ${amount.toFixed(3)} TND.`,
      link: `/finance?invoice=${invoiceId}&section=collections`,
    });

    for (const recipient of targetRecipients) {
      await this.mailService.sendPaymentRecordedEmail({
        amount,
        invoiceLink: `/finance?invoice=${invoiceId}&section=collections`,
        invoiceNumber,
        paymentDate,
        projectName,
        recipientEmail: recipient.email,
        recipientName: recipient.fullName,
      });
    }
  }
}
