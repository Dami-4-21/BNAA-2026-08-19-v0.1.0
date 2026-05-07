import { Injectable } from "@nestjs/common";

@Injectable()
export class TenantsService {
  provisionSchema(tenantId: string) {
    return {
      mode: "scaffold",
      next: "clone-tenant_template-into-runtime-schema",
      tenantId,
    };
  }
}
