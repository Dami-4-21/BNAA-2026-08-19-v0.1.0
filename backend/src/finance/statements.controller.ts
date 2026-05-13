import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";

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

  @Get(":statementId/pdf")
  async pdf(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Param("statementId") statementId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const pdf = await this.statementsService.downloadPdf(currentUser, projectId, statementId);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `inline; filename="${pdf.fileName.replaceAll('"', "")}"`,
    );
    return new StreamableFile(pdf.buffer);
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
