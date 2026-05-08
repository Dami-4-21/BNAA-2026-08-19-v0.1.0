"use client";

import { apiFetch } from "@/lib/api";
import type { WorkspacePayload } from "@/lib/backend/types";

export const workspaceQueryKey = (userId: string) => ["workspace", userId] as const;

export function fetchWorkspace() {
  return apiFetch<WorkspacePayload>("/api/workspace", {
    method: "GET",
  });
}

function getActiveProjectStorageKey(userId: string) {
  return `bnaasaas-active-project:${userId}`;
}

export function readStoredActiveProjectId(userId: string) {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(getActiveProjectStorageKey(userId)) ?? "";
}

export function writeStoredActiveProjectId(userId: string, projectId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getActiveProjectStorageKey(userId), projectId);
}
