"use client";

const siteDraftPrefix = "bnaasaas:site-draft:";
const siteQueuePrefix = "bnaasaas:site-queue:";
const documentCacheName = "bnaasaas-documents-v1";

export type PendingSiteReportAction = {
  action: "create-report" | "update-report";
  formState: Record<string, unknown>;
  id: string;
  projectId: string;
  queuedAt: string;
  reportId?: string;
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota errors in MVP mode.
  }
}

export function loadSiteDraft<T>(projectId: string) {
  return readJson<T | null>(`${siteDraftPrefix}${projectId}`, null);
}

export function saveSiteDraft<T>(projectId: string, draft: T) {
  writeJson(`${siteDraftPrefix}${projectId}`, draft);
}

export function clearSiteDraft(projectId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(`${siteDraftPrefix}${projectId}`);
}

export function loadPendingSiteReports(projectId: string) {
  return readJson<PendingSiteReportAction[]>(`${siteQueuePrefix}${projectId}`, []);
}

export function enqueuePendingSiteReport(action: PendingSiteReportAction) {
  const reportDate =
    typeof action.formState.reportDate === "string" ? action.formState.reportDate : "";
  const queue = loadPendingSiteReports(action.projectId).filter((entry) => {
    if (action.reportId && entry.reportId) {
      return entry.reportId !== action.reportId;
    }

    if (action.action === "create-report" && entry.action === "create-report") {
      const entryReportDate =
        typeof entry.formState.reportDate === "string" ? entry.formState.reportDate : "";
      return entryReportDate !== reportDate;
    }

    return true;
  });

  queue.push(action);
  writeJson(`${siteQueuePrefix}${action.projectId}`, queue);
  return queue;
}

export function overwritePendingSiteReports(
  projectId: string,
  queue: PendingSiteReportAction[],
) {
  writeJson(`${siteQueuePrefix}${projectId}`, queue);
}

export async function cacheDocumentForOffline(url: string) {
  if (typeof window === "undefined" || !("caches" in window)) {
    return false;
  }

  const response = await fetch(url, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Impossible de preparer ce document pour un usage hors ligne.");
  }

  const cache = await window.caches.open(documentCacheName);
  await cache.put(url, response.clone());
  return true;
}

export async function removeCachedDocument(url: string) {
  if (typeof window === "undefined" || !("caches" in window)) {
    return false;
  }

  const cache = await window.caches.open(documentCacheName);
  return cache.delete(url);
}

export async function isDocumentCached(url: string) {
  if (typeof window === "undefined" || !("caches" in window)) {
    return false;
  }

  const cache = await window.caches.open(documentCacheName);
  const match = await cache.match(url);
  return Boolean(match);
}
