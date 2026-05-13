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
import { CreateInvoiceDto } from "@/finance/dto/create-invoice.dto";
import { UpdateInvoiceStatusDto } from "@/finance/dto/update-invoice-status.dto";
import { ValidateInvoiceDto } from "@/finance/dto/validate-invoice.dto";
import { InvoicesService } from "@/finance/invoices.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("projects/:id/invoices")
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  list(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
  ) {
    return this.invoicesService.list(currentUser, projectId);
  }

  @Get(":invoiceId")
  detail(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Param("invoiceId") invoiceId: string,
  ) {
    return this.invoicesService.detail(currentUser, projectId, invoiceId);
  }

  @Get(":invoiceId/pdf")
  async pdf(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Param("invoiceId") invoiceId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const pdf = await this.invoicesService.downloadPdf(currentUser, projectId, invoiceId);
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
    @Body() payload: CreateInvoiceDto,
  ) {
    return this.invoicesService.create(currentUser, projectId, payload);
  }

  @Post(":invoiceId/send")
  @Roles("ADMIN", "CO")
  send(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Param("invoiceId") invoiceId: string,
  ) {
    return this.invoicesService.send(currentUser, projectId, invoiceId);
  }

  @Post(":invoiceId/validate")
  @Roles("ADMIN", "CP", "MO")
  validate(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Param("invoiceId") invoiceId: string,
    @Body() payload: ValidateInvoiceDto,
  ) {
    return this.invoicesService.validate(currentUser, projectId, invoiceId, payload);
  }

  @Post(":invoiceId/status")
  @Roles("ADMIN", "CO", "CP")
  updateStatus(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Param("invoiceId") invoiceId: string,
    @Body() payload: UpdateInvoiceStatusDto,
  ) {
    return this.invoicesService.updateStatus(currentUser, projectId, invoiceId, payload);
  }
}
