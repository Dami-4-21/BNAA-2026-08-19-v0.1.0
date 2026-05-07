import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName } from "@/lib/backend/session";
import type { WorkspacePayload } from "@/lib/backend/types";
import { getWorkspacePayload, isApiError } from "@/lib/backend/service";
import {
  fetchRebuildProjects,
  fetchRebuildSession,
  mapRebuildProjectsToLegacyWorkspaceProjects,
  rebuildAccessCookieName,
  shouldUseRebuildProjectsBridge,
} from "@/lib/rebuild-auth";
import { tenant as legacyTenant, workspaceProjects } from "@/lib/mock-data";

export async function GET(request: NextRequest) {
  try {
    if (shouldUseRebuildProjectsBridge()) {
      const rebuildAccessToken =
        request.cookies.get(rebuildAccessCookieName)?.value ?? "";
      const rebuildPayload = await buildWorkspaceBridgePayload(rebuildAccessToken);

      if (rebuildPayload) {
        return NextResponse.json(rebuildPayload);
      }
    }

    const token = request.cookies.get(sessionCookieName)?.value ?? "";
    const payload = await getWorkspacePayload(token);
    return NextResponse.json(payload);
  } catch (error) {
    if (isApiError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Erreur workspace." }, { status: 500 });
  }
}

async function buildWorkspaceBridgePayload(
  rebuildAccessToken: string,
): Promise<WorkspacePayload | null> {
  const [rebuildSession, rebuildProjects] = await Promise.all([
    fetchRebuildSession(rebuildAccessToken),
    fetchRebuildProjects(rebuildAccessToken),
  ]);

  if (!rebuildSession || !rebuildProjects) {
    return null;
  }

  const availableProjects = mapRebuildProjectsToLegacyWorkspaceProjects(
    rebuildProjects,
    workspaceProjects,
  );

  if (rebuildProjects.length > 0 && availableProjects.length === 0) {
    return null;
  }

  return {
    tenant: {
      ...legacyTenant,
      activeProjects: availableProjects.length,
      name: rebuildSession.tenant.name,
    },
    currentUser: rebuildSession.user,
    availableProjects,
  };
}
