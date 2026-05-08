import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName } from "@/lib/backend/session";
import { getDashboardPayload, isApiError } from "@/lib/backend/service";
import {
  fetchRebuildProjectScope,
  getRebuildAccessTokenFromRequest,
  shouldUseRebuildProjectsBridge,
} from "@/lib/rebuild-auth";
import { workspaceProjects } from "@/lib/mock-data";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;

    if (shouldUseRebuildProjectsBridge()) {
      const rebuildAccessToken = getRebuildAccessTokenFromRequest(request);
      const projectScope = await fetchRebuildProjectScope(
        rebuildAccessToken,
        workspaceProjects,
      );

      if (
        projectScope &&
        !projectScope.hasCompatibilityGap &&
        !projectScope.allowedProjectIds.has(projectId)
      ) {
        return NextResponse.json({ error: "Acces projet refuse." }, { status: 403 });
      }
    }

    const token = request.cookies.get(sessionCookieName)?.value ?? "";
    const payload = await getDashboardPayload(token, projectId);
    return NextResponse.json(payload);
  } catch (error) {
    if (isApiError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Erreur tableau de bord." }, { status: 500 });
  }
}
