import { UserRole } from "@prisma/client";

import {
  pilotProjects as pilotProjectCatalog,
  pilotTenant as pilotTenantCatalog,
  pilotUsers as pilotUserCatalog,
  type PilotBackendRole,
} from "@/bootstrap/pilot-catalog";

const backendRoleMap: Record<PilotBackendRole, UserRole> = {
  ADMIN: UserRole.ADMIN,
  BE: UserRole.BE,
  CO: UserRole.CO,
  CP: UserRole.CP,
  CT: UserRole.CT,
  MO: UserRole.MO,
};

const userEmailByLegacyId = new Map(
  pilotUserCatalog.map((user) => [user.legacyId, user.email]),
);

export const pilotTenant = {
  name: pilotTenantCatalog.name,
  slug: pilotTenantCatalog.slug,
};

export const pilotUsers: Array<{
  backendId: string;
  email: string;
  fullName: string;
  password: string;
  role: UserRole;
}> = pilotUserCatalog.map((user) => ({
  backendId: user.backendId,
  email: user.email,
  fullName: user.fullName,
  password: user.password,
  role: backendRoleMap[user.role],
}));

export const pilotProjects: Array<{
  backendId: string;
  budgetTnd: number;
  city: string;
  governorate: string;
  memberEmails: string[];
  name: string;
  type: string;
}> = pilotProjectCatalog.map((project) => ({
  backendId: project.backendId,
  budgetTnd: project.budgetTnd,
  city: project.city,
  governorate: project.governorate,
  memberEmails: project.memberLegacyIds
    .map((legacyId) => userEmailByLegacyId.get(legacyId) ?? null)
    .filter((email): email is string => email !== null),
  name: project.name,
  type: project.type,
}));
