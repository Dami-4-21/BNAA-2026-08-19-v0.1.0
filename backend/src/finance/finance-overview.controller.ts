import { Controller, Get, Param, UseGuards } from "@nestjs/common";

import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
import { AuthenticatedUser } from "@/common/types/authenticated-user.interface";
import { FinanceOverviewService } from "@/finance/finance-overview.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("projects/:id")
export class FinanceOverviewController {
  constructor(private readonly financeOverviewService: FinanceOverviewService) {}

  @Get("financial-summary")
  summary(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
  ) {
    return this.financeOverviewService.summary(currentUser, projectId);
  }

  @Get("cashflow")
  cashflow(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
  ) {
    return this.financeOverviewService.cashflow(currentUser, projectId);
  }
}
