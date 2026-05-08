"use client";

import { apiFetch } from "@/lib/api";
import type { GlobalSearchPayload } from "@/lib/backend/types";

export const globalSearchQueryKey = (query: string) => ["search", query] as const;

export function fetchGlobalSearch(query: string) {
  return apiFetch<GlobalSearchPayload>(`/api/search?q=${encodeURIComponent(query)}`, {
    method: "GET",
  });
}
