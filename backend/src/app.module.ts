import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AuthModule } from "@/auth/auth.module";
import { DocumentsModule } from "@/documents/documents.module";
import { FinanceModule } from "@/finance/finance.module";
import { NotificationsModule } from "@/notifications/notifications.module";
import { PdfModule } from "@/pdf/pdf.module";
import { ProjectsModule } from "@/projects/projects.module";
import { QueueModule } from "@/queue/queue.module";
import { SiteReportsModule } from "@/site-reports/site-reports.module";
import { StorageModule } from "@/storage/storage.module";
import { TenantsModule } from "@/tenants/tenants.module";
import { UsersModule } from "@/users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ".env",
      isGlobal: true,
    }),
    AuthModule,
    TenantsModule,
    UsersModule,
    ProjectsModule,
    SiteReportsModule,
    DocumentsModule,
    FinanceModule,
    StorageModule,
    PdfModule,
    NotificationsModule,
    QueueModule,
  ],
})
export class AppModule {}
