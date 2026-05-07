import { Injectable } from "@nestjs/common";

import { buildTenantSchemaName } from "@/common/utils/tenant-schema.util";
import { TenantDatabaseService } from "@/database/tenant-database.service";

@Injectable()
export class TenantsService {
  constructor(private readonly tenantDatabase: TenantDatabaseService) {}

  resolveSchemaName(tenantId: string) {
    return buildTenantSchemaName(tenantId);
  }

  async provisionSchema(tenantId: string) {
    const schemaName = this.resolveSchemaName(tenantId);
    await this.tenantDatabase.provisionTenantSchema(schemaName);

    return {
      tenantId,
      schemaName,
    };
  }

  async deprovisionSchema(tenantId: string) {
    const schemaName = this.resolveSchemaName(tenantId);
    await this.tenantDatabase.dropTenantSchema(schemaName);

    return {
      tenantId,
      schemaName,
    };
  }
}
