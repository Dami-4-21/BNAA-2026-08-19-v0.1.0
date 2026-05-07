import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v4 as uuidv4 } from "uuid";
import * as bcrypt from "bcrypt";

import { PrismaService } from "@/database/prisma.service";
import { TenantsService } from "@/tenants/tenants.service";
import { pilotTenant, pilotUsers } from "@/bootstrap/bootstrap.constants";

@Injectable()
export class BootstrapService implements OnModuleInit {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantsService: TenantsService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const shouldSeed =
      this.configService.get<string>("BNAASAAS_ENABLE_COMPAT_SEED", "true") === "true";

    if (!shouldSeed) {
      return;
    }

    const tenantCount = await this.prisma.tenant.count();
    if (tenantCount > 0) {
      return;
    }

    const tenantId = uuidv4();
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
          const userId = uuidv4();
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

      await this.tenantsService.provisionSchema(tenantId);
      this.logger.log("Seeded compatibility pilot tenant and users for the rebuild bridge.");
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
}
