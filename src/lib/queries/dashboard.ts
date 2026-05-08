"use client";

import { apiFetch } from "@/lib/api";
import type { DashboardPageData } from "@/lib/backend/types";

export const dashboardQueryKey = (projectId: string) => ["dashboard", projectId] as const;

export function fetchDashboard(projectId: string) {
  return apiFetch<DashboardPageData>(`/api/projects/${projectId}/dashboard`, {
    method: "GET",
  });
}
