import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName } from "@/lib/backend/session";
import type { ProjectsPageData } from "@/lib/backend/types";
import { getProjectsPayload, isApiError } from "@/lib/backend/service";
import {
  fetchRebuildProjectScope,
  fetchRebuildProjectMembers,
  getRebuildAccessTokenFromRequest,
  shouldUseRebuildProjectsBridge,
} from "@/lib/rebuild-auth";
import { workspaceProjects } from "@/lib/mock-data";

export async function GET(request: NextRequest) {
  try {
    if (shouldUseRebuildProjectsBridge()) {
      const rebuildAccessToken = getRebuildAccessTokenFromRequest(request);
      const legacyToken = request.cookies.get(sessionCookieName)?.value ?? "";
      const rebuildPayload = await buildProjectsBridgePayload(
        rebuildAccessToken,
        legacyToken,
      );

      if (rebuildPayload) {
        return NextResponse.json(rebuildPayload);
      }
    }

    const token = request.cookies.get(sessionCookieName)?.value ?? "";
    const payload = await getProjectsPayload(token);
    return NextResponse.json(payload);
  } catch (error) {
    if (isApiError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Erreur projets." }, { status: 500 });
  }
}

async function buildProjectsBridgePayload(
  rebuildAccessToken: string,
  legacyToken: string,
): Promise<ProjectsPageData | null> {
  const projectScope = await fetchRebuildProjectScope(
    rebuildAccessToken,
    workspaceProjects,
  );

  if (!projectScope) {
    return null;
  }

  if (projectScope.rebuildProjects.length === 0) {
    return { projects: [] };
  }

  if (projectScope.hasCompatibilityGap) {
    return null;
  }

  const legacyPayload = await getProjectsPayload(legacyToken);

  const legacyProjectMap = new Map(
    legacyPayload.projects.map((project) => [
      project.summary.name.trim().toLowerCase(),
      project,
    ]),
  );
  const compatibleProjects = projectScope.legacyProjects;
  const compatibleProjectKeys = new Set(
    compatibleProjects.map((project) => project.name.trim().toLowerCase()),
  );
  const compatibleProjectMap = new Map(
    compatibleProjects.map((project) => [project.name.trim().toLowerCase(), project]),
  );

  const memberCounts = await Promise.all(
    projectScope.rebuildProjects.map(async (project) => {
      const members = await fetchRebuildProjectMembers(rebuildAccessToken, project.id);
      return {
        memberCount: members?.length ?? null,
        projectId: project.id,
      };
    }),
  );
  const memberCountByProjectId = new Map(
    memberCounts.map((entry) => [entry.projectId, entry.memberCount]),
  );

  const projects = projectScope.rebuildProjects
    .map((project) => {
      const projectKey = project.name.trim().toLowerCase();
      const legacyProject = legacyProjectMap.get(projectKey);
      const compatibleProject = compatibleProjectMap.get(projectKey);

      if (!legacyProject || !compatibleProject) {
        return null;
      }

      return {
        ...legacyProject,
        summary: compatibleProject,
        memberCount: memberCountByProjectId.get(project.id) ?? legacyProject.memberCount,
      };
    })
    .filter((project): project is ProjectsPageData["projects"][number] => project !== null);

  if (
    !projects.length ||
    compatibleProjectKeys.size !== projectScope.rebuildProjects.length
  ) {
    return null;
  }

  return { projects };
}
