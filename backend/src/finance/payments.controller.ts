import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";

import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
import { AuthenticatedUser } from "@/common/types/authenticated-user.interface";
import { RegisterPaymentDto } from "@/finance/dto/register-payment.dto";
import { PaymentsService } from "@/finance/payments.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("projects/:id/invoices/:invoiceId/payment")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Roles("ADMIN", "CO")
  register(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Param("invoiceId") invoiceId: string,
    @Body() payload: RegisterPaymentDto,
  ) {
    return this.paymentsService.register(currentUser, projectId, invoiceId, payload);
  }
}
