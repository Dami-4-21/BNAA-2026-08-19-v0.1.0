import { Module } from "@nestjs/common";

import { FinanceModuleController } from "@/finance/internal.placeholder";
import { InvoicesController } from "@/finance/invoices.controller";
import { InvoicesService } from "@/finance/invoices.service";
import { PaymentsService } from "@/finance/payments.service";
import { StatementsController } from "@/finance/statements.controller";
import { StatementsService } from "@/finance/statements.service";
import { SiteScopeService } from "@/site-reports/site-scope.service";
import { TenantsModule } from "@/tenants/tenants.module";

@Module({
  imports: [TenantsModule],
  controllers: [FinanceModuleController, StatementsController, InvoicesController],
  providers: [SiteScopeService, StatementsService, InvoicesService, PaymentsService],
})
export class FinanceModule {}
