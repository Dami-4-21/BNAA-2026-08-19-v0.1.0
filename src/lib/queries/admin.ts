"use client";

import { apiFetch } from "@/lib/api";
import type { AdminPageData, ProjectWorkflowOwnerKey } from "@/lib/backend/types";
import type { UserRole } from "@/lib/auth";

export const adminQueryKey = ["admin"] as const;

export type CreateUserPayload = {
  email: string;
  name: string;
  password: string;
  projectIds: string[];
  role: UserRole;
};

export type CreateProjectPayload = {
  budgetTnd: number;
  client: string;
  code: string;
  location: string;
  lots: string;
  name: string;
  nextMilestone: string;
  phases: string;
  status: string;
  zones: string;
};

export type UpdateProjectSetupPayload = {
  budgetTnd: number;
  client: string;
  location: string;
  lots: string[];
  name: string;
  nextMilestone: string;
  phases: string[];
  projectId: string;
  status: string;
  workflowOwners: Record<ProjectWorkflowOwnerKey, string>;
  zones: string[];
};

export function fetchAdminData() {
  return apiFetch<AdminPageData>("/api/admin", { method: "GET" });
}

export function createUser(payload: CreateUserPayload) {
  return apiFetch<AdminPageData>("/api/admin", {
    method: "POST",
    body: {
      action: "create-user",
      payload,
    },
  });
}

export function createProject(payload: CreateProjectPayload) {
  return apiFetch<AdminPageData>("/api/admin", {
    method: "POST",
    body: {
      action: "create-project",
      payload,
    },
  });
}

export function updateProjectSetup(payload: UpdateProjectSetupPayload) {
  return apiFetch<AdminPageData>("/api/admin", {
    method: "POST",
    body: {
      action: "update-project-setup",
      payload,
    },
  });
}

export function updateProjectMembers(projectId: string, memberIds: string[]) {
  return apiFetch<AdminPageData>("/api/admin", {
    method: "POST",
    body: {
      action: "update-project-members",
      payload: { projectId, memberIds },
    },
  });
}

export function updateUserAccess(
  userId: string,
  payload: { projectIds: string[]; role: UserRole },
) {
  return apiFetch<AdminPageData>("/api/admin", {
    method: "POST",
    body: {
      action: "update-user",
      payload: {
        userId,
        ...payload,
      },
    },
  });
}

export function closeProject(projectId: string) {
  return apiFetch<AdminPageData>("/api/admin", {
    method: "POST",
    body: {
      action: "archive-project",
      payload: { projectId },
    },
  });
}
