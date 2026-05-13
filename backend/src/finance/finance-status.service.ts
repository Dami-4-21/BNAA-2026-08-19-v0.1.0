import { Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import type { PoolClient } from "pg";

import { formatDateOnly, normalizeDate, roundTo, toNumber } from "@/finance/finance-helpers";
import { MailService } from "@/mail/mail.service";
import { NotificationsService } from "@/notifications/notifications.service";
import { SiteScopeService } from "@/site-reports/site-scope.service";

type OverdueInvoiceRow = {
  amount_paid: number | string;
  amount_ttc: number | string;
  due_date: string;
  id: string;
  invoice_number: string;
  project_id: string;
  status: string;
};

@Injectable()
export class FinanceStatusService {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
    private readonly siteScope: SiteScopeService,
  ) {}

  async syncDerivedInvoiceStatuses(client: PoolClient, tenantId: string, projectId: string) {
    const project = await this.siteScope.getProjectSummary(client, projectId);
    const invoices = await client.query<OverdueInvoiceRow>(
      `SELECT id, project_id, invoice_number, amount_ttc, amount_paid, due_date, status::text AS status
       FROM invoices
       WHERE project_id = $1`,
      [projectId],
    );

    const recipients = await this.siteScope.listProjectUsersByRoles(client, tenantId, projectId, [
      UserRole.CO,
      UserRole.CP,
    ]);

    for (const invoice of invoices.rows) {
      const normalizedDueDate = normalizeDate(invoice.due_date);
      const remainingAmount = roundTo(
        Math.max(toNumber(invoice.amount_ttc) - toNumber(invoice.amount_paid), 0),
        3,
      );
      const shouldBeOverdue =
        remainingAmount > 0 &&
        toNumber(invoice.amount_paid) === 0 &&
        normalizedDueDate < formatDateOnly(new Date()) &&
        !["draft", "litigious", "paid", "overdue"].includes(invoice.status);

      if (!shouldBeOverdue) {
        continue;
      }

      await client.query(
        `UPDATE invoices
         SET status = 'overdue'::tenant_template."InvoiceStatus"
         WHERE id = $1
           AND project_id = $2`,
        [invoice.id, projectId],
      );

      if (recipients.length > 0) {
        await this.notificationsService.createForUsers(client, {
          userIds: recipients.map((recipient) => recipient.id),
          projectId,
          type: "finance.invoice.overdue",
          title: "Facture en retard",
          body: `${invoice.invoice_number} reste a encaisser apres echeance.`,
          link: `/finance?invoice=${invoice.id}&section=collections`,
        });

        for (const recipient of recipients) {
          await this.mailService.sendInvoiceOverdueEmail({
            amountRemaining: remainingAmount,
            dueDate: normalizedDueDate,
            invoiceLink: `/finance?invoice=${invoice.id}&section=collections`,
            invoiceNumber: invoice.invoice_number,
            projectName: project.name,
            recipientEmail: recipient.email,
            recipientName: recipient.fullName,
          });
        }
      }
    }
  }
}
