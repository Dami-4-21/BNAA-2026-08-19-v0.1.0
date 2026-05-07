import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName } from "@/lib/backend/session";
import type { GlobalSearchPayload } from "@/lib/backend/types";
import { getGlobalSearchPayload, isApiError } from "@/lib/backend/service";
import {
  fetchBridgedWorkspaceProjects,
  rebuildAccessCookieName,
  shouldUseRebuildProjectsBridge,
} from "@/lib/rebuild-auth";
import { workspaceProjects } from "@/lib/mock-data";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(sessionCookieName)?.value ?? "";
    const query = request.nextUrl.searchParams.get("q") ?? "";
    const legacyPayload = await getGlobalSearchPayload(token, query);

    if (shouldUseRebuildProjectsBridge()) {
      const rebuildAccessToken =
        request.cookies.get(rebuildAccessCookieName)?.value ?? "";
      const bridgedPayload = await buildSearchBridgePayload(
        rebuildAccessToken,
        legacyPayload,
      );

      if (bridgedPayload) {
        return NextResponse.json(bridgedPayload);
      }
    }

    const payload = legacyPayload;
    return NextResponse.json(payload);
  } catch (error) {
    if (isApiError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Erreur recherche globale." }, { status: 500 });
  }
}

async function buildSearchBridgePayload(
  rebuildAccessToken: string,
  legacyPayload: GlobalSearchPayload,
): Promise<GlobalSearchPayload | null> {
  const bridgedProjects = await fetchBridgedWorkspaceProjects(
    rebuildAccessToken,
    workspaceProjects,
  );

  if (!bridgedProjects) {
    return null;
  }

  const allowedProjectIds = new Set(
    bridgedProjects.legacyProjects.map((project) => project.id),
  );

  return {
    ...legacyPayload,
    results: legacyPayload.results.filter(
      (result) => !result.projectId || allowedProjectIds.has(result.projectId),
    ),
  };
}
