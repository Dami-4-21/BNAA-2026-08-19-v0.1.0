import { Module } from "@nestjs/common";

import { NcrController } from "@/site-reports/ncr.controller";
import { NcrService } from "@/site-reports/ncr.service";
import { PhotosController } from "@/site-reports/photos.controller";
import { PhotosService } from "@/site-reports/photos.service";
import { ReportsController } from "@/site-reports/reports.controller";
import { ReportsService } from "@/site-reports/reports.service";

@Module({
  controllers: [ReportsController, PhotosController, NcrController],
  providers: [ReportsService, PhotosService, NcrService],
})
export class SiteReportsModule {}
