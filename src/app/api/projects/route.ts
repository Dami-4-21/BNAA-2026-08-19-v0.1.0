import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName } from "@/lib/backend/session";
import type { ProjectsPageData } from "@/lib/backend/types";
import { getProjectsPayload, isApiError } from "@/lib/backend/service";
import {
  fetchRebuildProjectMembers,
  fetchRebuildProjects,
  rebuildAccessCookieName,
  shouldUseRebuildProjectsBridge,
} from "@/lib/rebuild-auth";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(sessionCookieName)?.value ?? "";
    const legacyPayload = await getProjectsPayload(token);

    if (shouldUseRebuildProjectsBridge()) {
      const rebuildAccessToken =
        request.cookies.get(rebuildAccessCookieName)?.value ?? "";
      const rebuildPayload = await buildProjectsBridgePayload(
        rebuildAccessToken,
        legacyPayload,
      );

      if (rebuildPayload) {
        return NextResponse.json(rebuildPayload);
      }
    }

    const payload = legacyPayload;
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
  legacyPayload: ProjectsPageData,
): Promise<ProjectsPageData | null> {
  const rebuildProjects = await fetchRebuildProjects(rebuildAccessToken);

  if (!rebuildProjects?.length) {
    return null;
  }

  const legacyProjectMap = new Map(
    legacyPayload.projects.map((project) => [
      buildProjectCompatibilityKey(project.summary.name),
      project,
    ]),
  );

  const memberCounts = await Promise.all(
    rebuildProjects.map(async (project) => {
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

  const projects = rebuildProjects
    .map((project) => {
      const legacyProject = legacyProjectMap.get(buildProjectCompatibilityKey(project.name));

      if (!legacyProject) {
        return null;
      }

      return {
        ...legacyProject,
        memberCount: memberCountByProjectId.get(project.id) ?? legacyProject.memberCount,
      };
    })
    .filter((project): project is ProjectsPageData["projects"][number] => project !== null);

  if (!projects.length || projects.length !== rebuildProjects.length) {
    return null;
  }

  return { projects };
}

function buildProjectCompatibilityKey(value: string) {
  return value.trim().toLowerCase();
}
