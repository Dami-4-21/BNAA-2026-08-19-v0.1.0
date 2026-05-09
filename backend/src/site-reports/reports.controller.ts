import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  StreamableFile,
  Put,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";

import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
import { AuthenticatedUser } from "@/common/types/authenticated-user.interface";
import { CreateReportDto } from "@/site-reports/dto/create-report.dto";
import { ReportsService } from "@/site-reports/reports.service";
import { UpdateReportDto } from "@/site-reports/dto/update-report.dto";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("projects/:id/reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  list(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
  ) {
    return this.reportsService.list(currentUser, projectId);
  }

  @Get(":reportId")
  detail(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Param("reportId") reportId: string,
  ) {
    return this.reportsService.detail(currentUser, projectId, reportId);
  }

  @Get(":reportId/pdf")
  async pdf(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Param("reportId") reportId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const pdf = await this.reportsService.downloadPdf(currentUser, projectId, reportId);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `inline; filename=\"${pdf.fileName.replaceAll('"', "")}\"`,
    );
    return new StreamableFile(pdf.buffer);
  }

  @Post()
  @Roles("ADMIN", "CP", "CT")
  create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Body() payload: CreateReportDto,
  ) {
    return this.reportsService.create(currentUser, projectId, payload);
  }

  @Put(":reportId")
  @Roles("ADMIN", "CP", "CT")
  update(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Param("reportId") reportId: string,
    @Body() payload: UpdateReportDto,
  ) {
    return this.reportsService.update(currentUser, projectId, reportId, payload);
  }

  @Post(":reportId/prepare")
  @Roles("ADMIN", "CP", "CT")
  prepare(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Param("reportId") reportId: string,
  ) {
    return this.reportsService.prepare(currentUser, projectId, reportId);
  }

  @Post(":reportId/sign")
  @Roles("ADMIN", "CP", "MO")
  sign(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("id") projectId: string,
    @Param("reportId") reportId: string,
  ) {
    return this.reportsService.sign(currentUser, projectId, reportId);
  }
}
