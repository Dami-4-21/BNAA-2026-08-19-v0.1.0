import { Module } from "@nestjs/common";

import { DatabaseModule } from "@/database/database.module";
import { TenantsService } from "@/tenants/tenants.service";

@Module({
  imports: [DatabaseModule],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
