import { Module } from "@nestjs/common";

import { DatabaseModule } from "@/database/database.module";
import { TenantsModule } from "@/tenants/tenants.module";
import { ProjectsController } from "@/projects/projects.controller";
import { ProjectsService } from "@/projects/projects.service";

@Module({
  imports: [DatabaseModule, TenantsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
