import { Module } from "@nestjs/common";

import { NotificationsModule } from "@/notifications/notifications.module";
import { PdfModule } from "@/pdf/pdf.module";
import { TenantsModule } from "@/tenants/tenants.module";
import { NcrController } from "@/site-reports/ncr.controller";
import { NcrService } from "@/site-reports/ncr.service";
import { PhotosController } from "@/site-reports/photos.controller";
import { PhotosService } from "@/site-reports/photos.service";
import { ReportsController } from "@/site-reports/reports.controller";
import { ReportsService } from "@/site-reports/reports.service";
import { SiteScopeService } from "@/site-reports/site-scope.service";

@Module({
  imports: [TenantsModule, PdfModule, NotificationsModule],
  controllers: [ReportsController, PhotosController, NcrController],
  providers: [SiteScopeService, ReportsService, PhotosService, NcrService],
})
export class SiteReportsModule {}
