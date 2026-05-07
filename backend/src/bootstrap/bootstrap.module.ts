import { Module } from "@nestjs/common";

import { BootstrapService } from "@/bootstrap/bootstrap.service";
import { DatabaseModule } from "@/database/database.module";
import { TenantsModule } from "@/tenants/tenants.module";

@Module({
  imports: [DatabaseModule, TenantsModule],
  providers: [BootstrapService],
})
export class BootstrapModule {}
