import "server-only";

import type { AppUser } from "@/lib/auth";
import type { WorkspaceProject } from "@/lib/backend/types";
import {
  pilotProjects,
  pilotTenant,
  pilotUsers,
  type PilotProjectSeed,
  type PilotUserSeed,
} from "../../../backend/src/bootstrap/pilot-catalog";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const compatibilityUsers = pilotUsers.map((user) => ({
  backendId: user.backendId,
  email: user.email,
  initials: user.initials,
  legacyId: user.legacyId,
  name: user.fullName,
  projectIds:
    user.legacyRole === "Super Admin"
      ? ["*"]
      : pilotProjects
          .filter((project) => project.memberLegacyIds.includes(user.legacyId))
          .map((project) => project.legacyId),
  role: user.legacyRole,
}));

const compatibilityProjects = pilotProjects.map((project) => ({
  backendId: project.backendId,
  code: project.code,
  legacyId: project.legacyId,
  name: project.name,
}));

export const legacySeedUsers: AppUser[] = pilotUsers.map((user) => ({
  id: user.legacyId,
  name: user.fullName,
  email: user.email,
  password: user.password,
  role: user.legacyRole,
  initials: user.initials,
  projectIds:
    user.legacyRole === "Super Admin"
      ? ["*"]
      : pilotProjects
          .filter((project) => project.memberLegacyIds.includes(user.legacyId))
          .map((project) => project.legacyId),
}));

export const legacyWorkspaceProjects: WorkspaceProject[] = pilotProjects.map((project) => ({
  id: project.legacyId,
  name: project.name,
  code: project.code,
  client: project.client,
  location: project.location,
  status: project.status,
  progress: project.progress,
  budgetTnd: project.budgetTnd,
  spentTnd: project.spentTnd,
  invoicesDue: project.invoicesDue,
  nextMilestone: project.nextMilestone,
  allowedRoles: [...project.allowedRoles],
}));

export const legacyTenantSummary = {
  name: pilotTenant.name,
  sector: pilotTenant.sector,
  users: pilotUsers.length,
  activeProjects: pilotProjects.length,
};

export function findPilotUserCompatibilityByBackendId(backendId: string) {
  return compatibilityUsers.find((user) => user.backendId === backendId) ?? null;
}

export function findPilotUserCompatibilityByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return compatibilityUsers.find((user) => user.email.toLowerCase() === normalizedEmail) ?? null;
}

export function findPilotProjectCompatibilityByBackendId(backendId: string) {
  return compatibilityProjects.find((project) => project.backendId === backendId) ?? null;
}

export function findPilotProjectCompatibilityByLegacyId(legacyId: string) {
  return compatibilityProjects.find((project) => project.legacyId === legacyId) ?? null;
}

export function findPilotProjectCompatibilityByName(name: string) {
  const normalizedName = buildCompatibilityKey(name);
  return compatibilityProjects.find((project) => buildCompatibilityKey(project.name) === normalizedName) ?? null;
}

export function getPilotProjectSeedByLegacyId(legacyId: string) {
  return pilotProjects.find((project) => project.legacyId === legacyId) ?? null;
}

export function getPilotProjectSeedByBackendId(backendId: string) {
  return pilotProjects.find((project) => project.backendId === backendId) ?? null;
}

export function getPilotUserSeedByLegacyId(legacyId: string) {
  return pilotUsers.find((user) => user.legacyId === legacyId) ?? null;
}

export function getPilotUserSeedByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return pilotUsers.find((user) => user.email.toLowerCase() === normalizedEmail) ?? null;
}

export function listPilotProjectSeeds(): PilotProjectSeed[] {
  return clone(pilotProjects);
}

export function listPilotUserSeeds(): PilotUserSeed[] {
  return clone(pilotUsers);
}

function buildCompatibilityKey(value: string) {
  return value.trim().toLowerCase();
}
