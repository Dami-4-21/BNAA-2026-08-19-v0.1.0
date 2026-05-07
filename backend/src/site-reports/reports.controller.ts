import { Body, Controller, Get, Param, Post } from "@nestjs/common";

import { CreateReportDto } from "@/site-reports/dto/create-report.dto";
import { ReportsService } from "@/site-reports/reports.service";

@Controller()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("projects/:id/reports")
  list(@Param("id") projectId: string) {
    return this.reportsService.list(projectId);
  }

  @Post("projects/:id/reports")
  create(@Param("id") projectId: string, @Body() payload: CreateReportDto) {
    return { mode: "scaffold", next: "create-daily-report", projectId, payload };
  }
}
