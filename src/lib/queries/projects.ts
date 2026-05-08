"use client";

import { apiFetch } from "@/lib/api";
import type { ProjectsPageData } from "@/lib/backend/types";

export const projectsQueryKey = ["projects"] as const;

export function fetchProjects() {
  return apiFetch<ProjectsPageData>("/api/projects", { method: "GET" });
}
