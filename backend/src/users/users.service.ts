import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { v4 as uuidv4 } from "uuid";

import { AuthenticatedUser } from "@/common/types/authenticated-user.interface";
import { PrismaService } from "@/database/prisma.service";
import { InviteUserDto } from "@/users/dto/invite-user.dto";
import { UpdateRoleDto } from "@/users/dto/update-role.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(currentUser: AuthenticatedUser) {
    const users = await this.prisma.user.findMany({
      where: {
        tenantId: currentUser.tenantId,
      },
      include: {
        tenant: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      items: users.map((user) => ({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
        totpEnabled: user.totpEnabled,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      })),
    };
  }

  async invite(currentUser: AuthenticatedUser, payload: InviteUserDto) {
    const normalizedEmail = payload.email.toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException("A user with this email already exists.");
    }

    const rawToken = randomBytes(24).toString("hex");
    const inviteToken = this.hashToken(rawToken);
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const user = await this.prisma.user.create({
      data: {
        id: uuidv4(),
        tenantId: currentUser.tenantId,
        email: normalizedEmail,
        fullName: normalizedEmail,
        passwordHash: "",
        role: payload.role as UserRole,
        isActive: false,
        invitedBy: currentUser.sub,
        inviteToken,
        inviteExpiresAt,
      },
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      inviteExpiresAt,
      debugInviteToken: process.env.NODE_ENV === "production" ? undefined : rawToken,
    };
  }

  async me(currentUser: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.sub },
      include: { tenant: true },
    });

    if (!user) {
      throw new NotFoundException("User not found.");
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      tenantId: user.tenantId,
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
        plan: user.tenant.plan,
      },
      isActive: user.isActive,
      totpEnabled: user.totpEnabled,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  async updateRole(
    currentUser: AuthenticatedUser,
    userId: string,
    payload: UpdateRoleDto,
  ) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: currentUser.tenantId,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found.");
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        role: payload.role as UserRole,
      },
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
    };
  }

  async deactivate(currentUser: AuthenticatedUser, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: currentUser.tenantId,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found.");
    }

    if (user.id === currentUser.sub) {
      throw new ConflictException("You cannot deactivate your own account.");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        refreshToken: null,
      },
    });

    return { ok: true };
  }

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
}
