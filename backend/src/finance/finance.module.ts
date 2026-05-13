import { Module } from "@nestjs/common";

import { FinanceModuleController } from "@/finance/internal.placeholder";
import { FinanceDocumentsService } from "@/finance/finance-documents.service";
import { FinanceOverviewController } from "@/finance/finance-overview.controller";
import { FinanceOverviewService } from "@/finance/finance-overview.service";
import { FinanceStatusService } from "@/finance/finance-status.service";
import { InvoicesController } from "@/finance/invoices.controller";
import { InvoicesService } from "@/finance/invoices.service";
import { PaymentsService } from "@/finance/payments.service";
import { PaymentsController } from "@/finance/payments.controller";
import { StatementsController } from "@/finance/statements.controller";
import { StatementsService } from "@/finance/statements.service";
import { NotificationsModule } from "@/notifications/notifications.module";
import { PdfModule } from "@/pdf/pdf.module";
import { SiteScopeService } from "@/site-reports/site-scope.service";
import { TenantsModule } from "@/tenants/tenants.module";

@Module({
  imports: [TenantsModule, PdfModule, NotificationsModule],
  controllers: [
    FinanceModuleController,
    FinanceOverviewController,
    StatementsController,
    InvoicesController,
    PaymentsController,
  ],
  providers: [
    SiteScopeService,
    FinanceDocumentsService,
    FinanceOverviewService,
    FinanceStatusService,
    StatementsService,
    InvoicesService,
    PaymentsService,
  ],
})
export class FinanceModule {}
