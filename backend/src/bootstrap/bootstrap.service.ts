import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v4 as uuidv4 } from "uuid";
import * as bcrypt from "bcrypt";

import { seedPilotDocumentHubData } from "@/bootstrap/pilot-document-hydration";
import { seedPilotSiteData } from "@/bootstrap/pilot-site-hydration";
import { PrismaService } from "@/database/prisma.service";
import { TenantDatabaseService } from "@/database/tenant-database.service";
import { TenantsService } from "@/tenants/tenants.service";
import { pilotProjects, pilotTenant, pilotUsers } from "@/bootstrap/bootstrap.constants";

@Injectable()
export class BootstrapService implements OnModuleInit {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantsService: TenantsService,
    private readonly tenantDatabase: TenantDatabaseService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const shouldSeed =
      this.configService.get<string>("BNAASAAS_ENABLE_COMPAT_SEED", "true") === "true";

    if (!shouldSeed) {
      return;
    }

    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug: pilotTenant.slug },
    });

    const tenantId = existingTenant?.id ?? uuidv4();

    if (!existingTenant) {
      await this.createPilotTenantAndUsers(tenantId);
      this.logger.log("Seeded compatibility pilot tenant and users for the rebuild bridge.");
    } else {
      await this.ensurePilotUsers(tenantId);
    }

    await this.tenantsService.provisionSchema(tenantId);
    await this.ensurePilotProjects(tenantId);
  }

  private async createPilotTenantAndUsers(tenantId: string) {
    const createdUserIds: string[] = [];
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.tenant.create({
          data: {
            id: tenantId,
            name: pilotTenant.name,
            slug: pilotTenant.slug,
          },
        });

        for (const entry of pilotUsers) {
          const userId = entry.backendId ?? uuidv4();
          createdUserIds.push(userId);
          await tx.user.create({
            data: {
              id: userId,
              tenantId,
              email: entry.email,
              fullName: entry.fullName,
              passwordHash: await bcrypt.hash(entry.password, 12),
              role: entry.role,
            },
          });
        }
      });
    } catch (error) {
      await Promise.allSettled([
        this.prisma.user.deleteMany({
          where: {
            id: {
              in: createdUserIds,
            },
          },
        }),
        this.prisma.tenant.deleteMany({
          where: { id: tenantId },
        }),
        this.tenantsService.deprovisionSchema(tenantId),
      ]);

      throw error;
    }
  }

  private async ensurePilotUsers(tenantId: string) {
    const existingUsers = await this.prisma.user.findMany({
      where: { tenantId },
      select: {
        email: true,
      },
    });

    const existingEmails = new Set(existingUsers.map((user) => user.email.toLowerCase()));

    for (const entry of pilotUsers) {
      if (existingEmails.has(entry.email.toLowerCase())) {
        continue;
      }

      await this.prisma.user.create({
        data: {
          id: entry.backendId ?? uuidv4(),
          tenantId,
          email: entry.email,
          fullName: entry.fullName,
          passwordHash: await bcrypt.hash(entry.password, 12),
          role: entry.role,
        },
      });
    }
  }

  private async ensurePilotProjects(tenantId: string) {
    const schemaName = this.tenantsService.resolveSchemaName(tenantId);
    const users = await this.prisma.user.findMany({
      where: { tenantId },
      select: {
        email: true,
        id: true,
        role: true,
      },
    });

    const userIdByEmail = new Map(
      users.map((user) => [user.email.toLowerCase(), { id: user.id, role: user.role }]),
    );
    const fallbackCreatorId =
      userIdByEmail.get("admin@bnaa.com")?.id ?? users[0]?.id ?? uuidv4();

    await this.tenantDatabase.withTenantSchema(schemaName, async (client) => {
      for (const project of pilotProjects) {
        const existingProject = await client.query<{ id: string }>(
          `SELECT id FROM projects WHERE name = $1 LIMIT 1`,
          [project.name],
        );

        const projectId = existingProject.rows[0]?.id ?? project.backendId ?? uuidv4();

        if (!existingProject.rowCount) {
          await client.query(
            `INSERT INTO projects (
              id,
              name,
              type,
              status,
              governorate,
              city,
              contract_amount_ht,
              created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              projectId,
              project.name,
              project.type,
              "active",
              project.governorate,
              project.city,
              project.budgetTnd,
              fallbackCreatorId,
            ],
          );
        }

        await client.query(
          `UPDATE projects
           SET contract_amount_ht = CASE
             WHEN contract_amount_ht IS NULL OR contract_amount_ht = 0 THEN $2
             ELSE contract_amount_ht
           END
           WHERE id = $1`,
          [projectId, project.budgetTnd],
        );

        for (const memberEmail of project.memberEmails) {
          const member = userIdByEmail.get(memberEmail.toLowerCase());
          if (!member) {
            continue;
          }

          const existingMember = await client.query(
            `SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2 LIMIT 1`,
            [projectId, member.id],
          );

          if (existingMember.rowCount) {
            continue;
          }

          await client.query(
            `INSERT INTO project_members (id, project_id, user_id, role)
             VALUES ($1, $2, $3, $4)`,
            [uuidv4(), projectId, member.id, member.role],
          );
        }

        await seedPilotSiteData(client, project.backendId, projectId, users);
        await seedPilotDocumentHubData(client, project.backendId, projectId, users);
      }
    });
  }
}
