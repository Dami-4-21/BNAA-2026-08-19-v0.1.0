import { Module } from "@nestjs/common";

import { FinanceModuleController } from "@/finance/internal.placeholder";
import { InvoicesController } from "@/finance/invoices.controller";
import { InvoicesService } from "@/finance/invoices.service";
import { PaymentsService } from "@/finance/payments.service";
import { StatementsController } from "@/finance/statements.controller";
import { StatementsService } from "@/finance/statements.service";

@Module({
  controllers: [FinanceModuleController, StatementsController, InvoicesController],
  providers: [StatementsService, InvoicesService, PaymentsService],
})
export class FinanceModule {}
