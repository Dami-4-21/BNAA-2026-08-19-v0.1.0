import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

import { AuthenticatedUser } from "@/common/types/authenticated-user.interface";
import { PrismaService } from "@/database/prisma.service";
import { TenantDatabaseService } from "@/database/tenant-database.service";
import { AddProjectMemberDto } from "@/projects/dto/add-project-member.dto";
import { CreateProjectDto } from "@/projects/dto/create-project.dto";
import { TenantsService } from "@/tenants/tenants.service";

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantDatabase: TenantDatabaseService,
    private readonly tenantsService: TenantsService,
  ) {}

  async list(currentUser: AuthenticatedUser) {
    const schemaName = this.tenantsService.resolveSchemaName(currentUser.tenantId);

    return this.tenantDatabase.withTenantSchema(schemaName, async (client) => {
      const isAdmin = currentUser.role === UserRole.ADMIN;
      const result = await client.query(
        isAdmin
          ? `SELECT p.id, p.name, p.type, p.status, p.governorate, p.city, p.start_date, p.end_date, p.created_at
             FROM projects p
             ORDER BY p.created_at DESC`
          : `SELECT p.id, p.name, p.type, p.status, p.governorate, p.city, p.start_date, p.end_date, p.created_at
             FROM projects p
             INNER JOIN project_members pm ON pm.project_id = p.id
             WHERE pm.user_id = $1
             ORDER BY p.created_at DESC`,
        isAdmin ? [] : [currentUser.sub],
      );

      return {
        items: result.rows.map((row: Record<string, unknown>) => this.mapProjectRow(row)),
      };
    });
  }

  async create(currentUser: AuthenticatedUser, payload: CreateProjectDto) {
    const schemaName = this.tenantsService.resolveSchemaName(currentUser.tenantId);
    const projectId = uuidv4();

    return this.tenantDatabase.withTenantSchema(schemaName, async (client) => {
      await client.query(
        `INSERT INTO projects (
          id,
          name,
          type,
          status,
          governorate,
          city,
          start_date,
          created_by
        ) VALUES ($1, $2, $3, 'configuration', $4, $5, $6, $7)`,
        [
          projectId,
          payload.name.trim(),
          payload.type?.trim() || null,
          payload.governorate?.trim() || null,
          payload.city?.trim() || null,
          payload.startDate ? new Date(payload.startDate) : null,
          currentUser.sub,
        ],
      );

      await client.query(
        `INSERT INTO project_members (id, project_id, user_id, role)
         VALUES ($1, $2, $3, $4)`,
        [uuidv4(), projectId, currentUser.sub, currentUser.role],
      );

      const created = await client.query(
        `SELECT id, name, type, status, governorate, city, start_date, end_date, created_at
         FROM projects
         WHERE id = $1`,
        [projectId],
      );

      return this.mapProjectRow(created.rows[0]);
    });
  }

  async detail(currentUser: AuthenticatedUser, projectId: string) {
    const project = await this.getAccessibleProject(currentUser, projectId);

    return project;
  }

  async members(currentUser: AuthenticatedUser, projectId: string) {
    const schemaName = this.tenantsService.resolveSchemaName(currentUser.tenantId);
    await this.getAccessibleProject(currentUser, projectId);

    return this.tenantDatabase.withTenantSchema(schemaName, async (client) => {
      const result = await client.query(
        `SELECT pm.user_id, pm.role, pm.added_at, u.email, u.full_name, u.is_active
         FROM project_members pm
         INNER JOIN public.users u ON u.id = pm.user_id
         WHERE pm.project_id = $1
         ORDER BY pm.added_at ASC`,
        [projectId],
      );

      return {
        items: result.rows.map((row: Record<string, unknown>) => ({
          userId: row.user_id,
          fullName: row.full_name,
          email: row.email,
          role: row.role,
          isActive: row.is_active,
          addedAt: row.added_at,
        })),
      };
    });
  }

  async addMember(
    currentUser: AuthenticatedUser,
    projectId: string,
    payload: AddProjectMemberDto,
  ) {
    const schemaName = this.tenantsService.resolveSchemaName(currentUser.tenantId);
    await this.assertCanManageMembers(currentUser, projectId);

    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.userId,
        tenantId: currentUser.tenantId,
        isActive: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found in this tenant.");
    }

    return this.tenantDatabase.withTenantSchema(schemaName, async (client) => {
      const existing = await client.query(
        `SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2`,
        [projectId, payload.userId],
      );

      if (existing.rowCount) {
        throw new ConflictException("This user is already a project member.");
      }

      await client.query(
        `INSERT INTO project_members (id, project_id, user_id, role)
         VALUES ($1, $2, $3, $4)`,
        [uuidv4(), projectId, payload.userId, payload.role],
      );

      return {
        ok: true,
        projectId,
        userId: payload.userId,
        role: payload.role,
      };
    });
  }

  private async getAccessibleProject(currentUser: AuthenticatedUser, projectId: string) {
    const schemaName = this.tenantsService.resolveSchemaName(currentUser.tenantId);

    return this.tenantDatabase.withTenantSchema(schemaName, async (client) => {
      const isAdmin = currentUser.role === UserRole.ADMIN;
      const result = await client.query(
        isAdmin
          ? `SELECT id, name, type, status, governorate, city, start_date, end_date, created_at
             FROM projects
             WHERE id = $1`
          : `SELECT p.id, p.name, p.type, p.status, p.governorate, p.city, p.start_date, p.end_date, p.created_at
             FROM projects p
             INNER JOIN project_members pm ON pm.project_id = p.id
             WHERE p.id = $1 AND pm.user_id = $2`,
        isAdmin ? [projectId] : [projectId, currentUser.sub],
      );

      if (!result.rowCount) {
        throw new NotFoundException("Project not found.");
      }

      return this.mapProjectRow(result.rows[0]);
    });
  }

  private async assertCanManageMembers(currentUser: AuthenticatedUser, projectId: string) {
    await this.getAccessibleProject(currentUser, projectId);

    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.CP) {
      throw new ForbiddenException("You cannot manage project members.");
    }
  }

  private mapProjectRow(row: Record<string, unknown>) {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      status: row.status,
      governorate: row.governorate,
      city: row.city,
      startDate: row.start_date,
      endDate: row.end_date,
      createdAt: row.created_at,
    };
  }
}
