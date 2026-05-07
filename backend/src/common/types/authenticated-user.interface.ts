import { UserRole } from "@prisma/client";

export interface AuthenticatedUser {
  sub: string;
  email: string;
  fullName: string;
  tenantId: string;
  role: UserRole;
  refreshToken?: string;
  type?: "access" | "refresh" | "2fa";
}
