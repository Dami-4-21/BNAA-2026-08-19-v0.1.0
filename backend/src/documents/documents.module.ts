import { Module } from "@nestjs/common";

import { DistributionService } from "@/documents/distribution.service";
import { DocumentsController } from "@/documents/documents.controller";
import { DocumentsService } from "@/documents/documents.service";
import { VersionsService } from "@/documents/versions.service";
import { MailModule } from "@/mail/mail.module";
import { NotificationsModule } from "@/notifications/notifications.module";
import { PdfModule } from "@/pdf/pdf.module";
import { SiteScopeService } from "@/site-reports/site-scope.service";
import { TenantsModule } from "@/tenants/tenants.module";

@Module({
  imports: [TenantsModule, PdfModule, NotificationsModule, MailModule],
  controllers: [DocumentsController],
  providers: [SiteScopeService, DocumentsService, VersionsService, DistributionService],
})
export class DocumentsModule {}
