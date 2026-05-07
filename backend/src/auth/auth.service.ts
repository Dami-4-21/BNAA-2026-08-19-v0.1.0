import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Tenant, User, UserRole } from "@prisma/client";
import { authenticator } from "otplib";
import * as bcrypt from "bcrypt";
import { createHash, randomBytes } from "node:crypto";
import { v4 as uuidv4 } from "uuid";

import { AcceptInviteDto } from "@/auth/dto/accept-invite.dto";
import { Disable2faDto } from "@/auth/dto/disable-2fa.dto";
import { Enable2faDto } from "@/auth/dto/enable-2fa.dto";
import { LoginDto } from "@/auth/dto/login.dto";
import { RegisterDto } from "@/auth/dto/register.dto";
import { ResetPasswordDto } from "@/auth/dto/reset-password.dto";
import { Verify2faDto } from "@/auth/dto/verify-2fa.dto";
import { AuthenticatedUser } from "@/common/types/authenticated-user.interface";
import { buildTenantSlug } from "@/common/utils/tenant-schema.util";
import { PrismaService } from "@/database/prisma.service";
import { MailService } from "@/mail/mail.service";
import { TenantsService } from "@/tenants/tenants.service";

type PublicUserWithTenant = User & { tenant: Tenant };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantsService: TenantsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async register(payload: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: payload.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException("An account already exists for this email.");
    }

    const tenantId = uuidv4();
    const userId = uuidv4();
    const slug = await this.createUniqueTenantSlug(payload.tenantName);
    const passwordHash = await bcrypt.hash(payload.password, 12);

    let created: { tenant: Tenant; user: PublicUserWithTenant };

    try {
      created = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            id: tenantId,
            name: payload.tenantName.trim(),
            slug,
          },
        });

        const user = await tx.user.create({
          data: {
            id: userId,
            tenantId,
            email: payload.email.toLowerCase(),
            fullName: payload.fullName.trim(),
            passwordHash,
            role: UserRole.ADMIN,
          },
          include: {
            tenant: true,
          },
        });

        return { tenant, user };
      });

      await this.tenantsService.provisionSchema(tenantId);
    } catch (error) {
      await Promise.allSettled([
        this.prisma.user.deleteMany({ where: { id: userId } }),
        this.prisma.tenant.deleteMany({ where: { id: tenantId } }),
        this.tenantsService.deprovisionSchema(tenantId),
      ]);
      throw error;
    }

    const session = await this.createSession(created.user);

    return {
      ...session,
      tenant: this.serializeTenant(created.tenant),
      schemaName: this.tenantsService.resolveSchemaName(tenantId),
    };
  }

  async login(payload: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: payload.email.toLowerCase() },
      include: { tenant: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const passwordValid = await bcrypt.compare(payload.password, user.passwordHash);

    if (!passwordValid) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
      },
    });

    if (user.totpEnabled) {
      const tempToken = await this.jwtService.signAsync(this.buildJwtPayload(user, "2fa"), {
        secret: this.configService.get<string>("JWT_SECRET", "dev-secret"),
        expiresIn: "10m",
      });

      return {
        requires2fa: true,
        tempToken,
        user: this.serializeUser(user),
        tenant: this.serializeTenant(user.tenant),
      };
    }

    return this.createSession(user);
  }

  async verify2fa(payload: Verify2faDto) {
    if (!payload.tempToken) {
      throw new BadRequestException("A 2FA challenge token is required.");
    }

    const decoded = (await this.jwtService.verifyAsync(payload.tempToken, {
      secret: this.configService.get<string>("JWT_SECRET", "dev-secret"),
    })) as AuthenticatedUser;

    if (decoded.type !== "2fa") {
      throw new UnauthorizedException("Invalid 2FA challenge.");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: decoded.sub },
      include: { tenant: true },
    });

    if (!user || !user.totpEnabled || !user.totpSecret) {
      throw new UnauthorizedException("2FA is not enabled for this account.");
    }

    const validCode = authenticator.verify({
      token: payload.code,
      secret: user.totpSecret,
    });

    if (!validCode) {
      throw new UnauthorizedException("Invalid 2FA code.");
    }

    return this.createSession(user);
  }

  async refreshSession(refreshToken: string, currentUser?: AuthenticatedUser) {
    if (!refreshToken) {
      throw new UnauthorizedException("Missing refresh token.");
    }

    const decoded =
      currentUser ??
      ((await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>(
          "JWT_REFRESH_SECRET",
          "dev-refresh-secret",
        ),
      })) as AuthenticatedUser);

    const user = await this.prisma.user.findUnique({
      where: { id: decoded.sub },
      include: { tenant: true },
    });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException("Refresh session is no longer valid.");
    }

    const matches = await bcrypt.compare(refreshToken, user.refreshToken);

    if (!matches) {
      throw new UnauthorizedException("Refresh session is no longer valid.");
    }

    return this.createSession(user);
  }

  async logout(currentUser?: AuthenticatedUser) {
    if (!currentUser?.sub) {
      return { ok: true };
    }

    await this.prisma.user.update({
      where: { id: currentUser.sub },
      data: {
        refreshToken: null,
      },
    });

    return { ok: true };
  }

  async forgotPassword(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return { ok: true };
    }

    const token = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: this.hashToken(token),
        resetExpiresAt: expiresAt,
      },
    });

    const delivery = await this.mailService.sendResetPasswordEmail({
      recipientEmail: user.email,
      recipientName: user.fullName,
      resetLink: this.mailService.buildResetPasswordLink(token),
    });

    return {
      ok: true,
      expiresAt,
      delivery,
      debugToken: !this.isProduction() && delivery.mode === "debug" ? token : undefined,
    };
  }

  async resetPassword(payload: ResetPasswordDto) {
    const tokenHash = this.hashToken(payload.token);
    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: tokenHash,
        resetExpiresAt: {
          gt: new Date(),
        },
      },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException("Reset link is invalid or expired.");
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetExpiresAt: null,
        refreshToken: null,
      },
    });

    return { ok: true };
  }

  async acceptInvite(payload: AcceptInviteDto) {
    const tokenHash = this.hashToken(payload.token);
    const user = await this.prisma.user.findFirst({
      where: {
        inviteToken: tokenHash,
        inviteExpiresAt: {
          gt: new Date(),
        },
      },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException("Invite link is invalid or expired.");
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        fullName: payload.fullName.trim(),
        passwordHash,
        isActive: true,
        inviteToken: null,
        inviteExpiresAt: null,
      },
    });

    const hydratedUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { tenant: true },
    });

    return this.createSession(hydratedUser);
  }

  async setup2fa(currentUser: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.sub },
    });

    if (!user) {
      throw new UnauthorizedException("User not found.");
    }

    const secret = authenticator.generateSecret();
    const issuer = this.configService.get<string>("APP_NAME", "BnaaSaaS");
    const otpAuthUrl = authenticator.keyuri(user.email, issuer, secret);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        totpSecret: secret,
        totpEnabled: false,
      },
    });

    return {
      secret,
      otpAuthUrl,
    };
  }

  async me(currentUser: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.sub },
      include: { tenant: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("User not found.");
    }

    return {
      user: this.serializeUser(user),
      tenant: this.serializeTenant(user.tenant),
    };
  }

  async enable2fa(currentUser: AuthenticatedUser, payload: Enable2faDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.sub },
    });

    if (!user || !user.totpSecret) {
      throw new BadRequestException("2FA setup has not been initialized.");
    }

    const validCode = authenticator.verify({
      token: payload.code,
      secret: user.totpSecret,
    });

    if (!validCode) {
      throw new UnauthorizedException("Invalid 2FA code.");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        totpEnabled: true,
      },
    });

    return { ok: true };
  }

  async disable2fa(currentUser: AuthenticatedUser, payload: Disable2faDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.sub },
    });

    if (!user) {
      throw new UnauthorizedException("User not found.");
    }

    const passwordValid = await bcrypt.compare(payload.password, user.passwordHash);

    if (!passwordValid) {
      throw new UnauthorizedException("Invalid password.");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        totpSecret: null,
        totpEnabled: false,
      },
    });

    return { ok: true };
  }

  private async createSession(user: PublicUserWithTenant) {
    const accessToken = await this.jwtService.signAsync(this.buildJwtPayload(user, "access"), {
      secret: this.configService.get<string>("JWT_SECRET", "dev-secret"),
      expiresIn: this.configService.get<string>("JWT_ACCESS_EXPIRES", "15m"),
    });
    const refreshToken = await this.jwtService.signAsync(
      this.buildJwtPayload(user, "refresh"),
      {
        secret: this.configService.get<string>(
          "JWT_REFRESH_SECRET",
          "dev-refresh-secret",
        ),
        expiresIn: this.configService.get<string>("JWT_REFRESH_EXPIRES", "30d"),
      },
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: await bcrypt.hash(refreshToken, 12),
        lastLoginAt: new Date(),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: this.serializeUser(user),
      tenant: this.serializeTenant(user.tenant),
    };
  }

  private buildJwtPayload(user: PublicUserWithTenant, type: "access" | "refresh" | "2fa") {
    return {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      tenantId: user.tenantId,
      role: user.role,
      type,
    };
  }

  private async createUniqueTenantSlug(name: string) {
    const baseSlug = buildTenantSlug(name) || "workspace";
    let slug = baseSlug;
    let suffix = 2;

    while (
      await this.prisma.tenant.findUnique({
        where: { slug },
      })
    ) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    return slug;
  }

  private serializeUser(user: PublicUserWithTenant | User) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      tenantId: user.tenantId,
      isActive: user.isActive,
      totpEnabled: user.totpEnabled,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  private serializeTenant(tenant: Tenant) {
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt,
    };
  }

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private isProduction() {
    return this.configService.get<string>("NODE_ENV") === "production";
  }

  getRefreshCookieOptions() {
    const maxAge = this.parseDurationToMs(
      this.configService.get<string>("JWT_REFRESH_EXPIRES", "30d"),
    );

    return {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: this.isProduction(),
      path: "/api/v1/auth",
      maxAge,
    };
  }

  private parseDurationToMs(value: string) {
    const match = /^(\d+)([smhd])$/.exec(value.trim());

    if (!match) {
      return 30 * 24 * 60 * 60 * 1000;
    }

    const amount = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1_000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };

    return amount * multipliers[unit];
  }
}
