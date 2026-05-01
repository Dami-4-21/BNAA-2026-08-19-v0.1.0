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
import type { DatabaseState, NotificationRecord } from "@/lib/backend/types";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createSeedDatabase(): DatabaseState {
  const users = clone(appUsers);
  const notificationRecipients = users
    .filter((user) => user.projectIds.includes("*") || user.projectIds.includes("BN-042"))
    .map((user) => user.id);
  const seededNotifications: NotificationRecord[] = clone(notifications).map(
    (notification, index) => ({
      id: `NTF-SEED-${index + 1}`,
      title: notification.title,
      detail: notification.detail,
      channel:
        notification.channel === "Email"
          ? "Email"
          : notification.channel === "In-app + email"
            ? "In-app + email"
            : "In-app",
      createdAt: [
        "2026-04-30T17:58:00.000Z",
        "2026-04-30T07:42:00.000Z",
        "2026-04-30T09:15:00.000Z",
      ][index] ?? "2026-04-30T08:00:00.000Z",
      href:
        index === 0 ? "/documents" : index === 1 ? "/site" : "/finance",
      tone: index === 2 ? "warning" : "primary",
      type: index === 0 ? "document" : index === 1 ? "report" : "invoice",
      actor: index === 0 ? "Hichem Trabelsi" : index === 1 ? "Nour Baccar" : "Sara Ben Salah",
      projectId: "BN-042",
      projectCode: "BN-042",
      recipients: notificationRecipients,
      readBy: [],
      requiresAction: index !== 1,
    }),
  );

  return {
    tenant: {
      ...clone(tenant),
      users: users.length,
      activeProjects: workspaceProjects.length,
    },
    users,
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
    notifications: seededNotifications,
    portfolio: clone(projects),
    roleMatrix: clone(roleMatrix),
    auditTrail: clone(auditTrail).map((entry, index) => ({
      ...entry,
      createdAt: [
        "2026-04-29T10:22:00.000Z",
        "2026-04-29T07:42:00.000Z",
        "2026-04-28T18:10:00.000Z",
      ][index] ?? "2026-04-28T08:00:00.000Z",
      id: `AUD-SEED-${index + 1}`,
      projectCode:
        entry.context.includes("BN-042") || entry.context.includes("FAC-2026")
          ? "BN-042"
          : undefined,
    })),
    sessions: [],
  };
}
