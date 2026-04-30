import { appUsers } from "@/lib/auth";
import {
  alerts,
  auditTrail,
  getDocumentsModuleData,
  getFinanceModuleData,
  getSiteModuleData,
  notifications,
  projects,
  roleMatrix,
  teamMembers,
  tenant,
  workspaceProjects,
} from "@/lib/mock-data";
import type { DatabaseState } from "@/lib/backend/types";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createSeedDatabase(): DatabaseState {
  return {
    tenant: clone(tenant),
    users: clone(appUsers),
    projects: Object.fromEntries(
      workspaceProjects.map((project) => [
        project.id,
        {
          summary: clone(project),
          site: getSiteModuleData(project.id),
          documents: getDocumentsModuleData(project.id),
          finance: getFinanceModuleData(project.id),
        },
      ]),
    ),
    alerts: clone(alerts),
    teamMembers: clone(teamMembers),
    notifications: clone(notifications),
    portfolio: clone(projects),
    roleMatrix: clone(roleMatrix),
    auditTrail: clone(auditTrail),
    sessions: [],
  };
}
