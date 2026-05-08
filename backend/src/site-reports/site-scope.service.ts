import { Injectable, NotFoundException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import type { PoolClient } from "pg";

import { AuthenticatedUser } from "@/common/types/authenticated-user.interface";
import { TenantDatabaseService } from "@/database/tenant-database.service";
import { TenantsService } from "@/tenants/tenants.service";

@Injectable()
export class SiteScopeService {
  constructor(
    private readonly tenantDatabase: TenantDatabaseService,
    private readonly tenantsService: TenantsService,
  ) {}

  async withProjectAccess<T>(
    currentUser: AuthenticatedUser,
    projectId: string,
    handler: (client: PoolClient, schemaName: string) => Promise<T>,
  ): Promise<T> {
    const schemaName = this.tenantsService.resolveSchemaName(currentUser.tenantId);

    return this.tenantDatabase.withTenantSchema(schemaName, async (client) => {
      const project = await this.findAccessibleProject(client, currentUser, projectId);

      if (!project) {
        throw new NotFoundException("Project not found.");
      }

      return handler(client, schemaName);
    });
  }

  async assertUserActiveInTenant(currentUser: AuthenticatedUser, userId: string) {
    const schemaName = this.tenantsService.resolveSchemaName(currentUser.tenantId);

    return this.tenantDatabase.withTenantSchema(schemaName, async (client) => {
      const result = await client.query<{ id: string }>(
        `SELECT id
         FROM public.users
         WHERE id = $1 AND tenant_id = $2 AND is_active = true
         LIMIT 1`,
        [userId, currentUser.tenantId],
      );

      if (!result.rowCount) {
        throw new NotFoundException("User not found in this tenant.");
      }

      return true;
    });
  }

  private async findAccessibleProject(
    client: PoolClient,
    currentUser: AuthenticatedUser,
    projectId: string,
  ) {
    const isAdmin = currentUser.role === UserRole.ADMIN;
    const result = await client.query(
      isAdmin
        ? `SELECT id FROM projects WHERE id = $1 LIMIT 1`
        : `SELECT p.id
           FROM projects p
           INNER JOIN project_members pm ON pm.project_id = p.id
           WHERE p.id = $1 AND pm.user_id = $2
           LIMIT 1`,
      isAdmin ? [projectId] : [projectId, currentUser.sub],
    );

    return result.rows[0] ?? null;
  }
}
