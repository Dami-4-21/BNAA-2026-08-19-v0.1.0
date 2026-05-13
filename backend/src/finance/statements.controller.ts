import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";

import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
import { AuthenticatedUser } from "@/common/types/authenticated-user.interface";
import { CreateStatementDto } from "@/finance/dto/create-statement.dto";
import { StatementsService } from "@/finance/statements.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("projects/:id/statements")
export class StatementsController {
  constructor(private readonly statementsService: StatementsService) {}

  @Get()
  list(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
  ) {
    return this.statementsService.list(currentUser, projectId);
  }

  @Get(":statementId")
  detail(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Param("statementId") statementId: string,
  ) {
    return this.statementsService.detail(currentUser, projectId, statementId);
  }

  @Post()
  @Roles("ADMIN", "CP", "CO")
  create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Body() payload: CreateStatementDto,
  ) {
    return this.statementsService.create(currentUser, projectId, payload);
  }
}
