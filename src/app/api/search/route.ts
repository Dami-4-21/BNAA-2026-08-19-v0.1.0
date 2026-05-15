import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName } from "@/lib/backend/session";
import { getGlobalSearchPayload, isApiError } from "@/lib/backend/service";
import {
  getRebuildAccessTokenFromRequest,
  shouldUseRebuildProjectsBridge,
} from "@/lib/rebuild-auth";
import { workspaceProjects } from "@/lib/mock-data";
import { fetchRebuildSearchPayload } from "@/lib/rebuild-search";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q") ?? "";

    if (shouldUseRebuildProjectsBridge()) {
      const rebuildAccessToken = getRebuildAccessTokenFromRequest(request);
      const bridgedPayload = await fetchRebuildSearchPayload(
        rebuildAccessToken,
        workspaceProjects,
        query,
      );

      if (bridgedPayload) {
        return NextResponse.json(bridgedPayload);
      }
    }

    const token = request.cookies.get(sessionCookieName)?.value ?? "";
    const payload = await getGlobalSearchPayload(token, query);
    return NextResponse.json(payload);
  } catch (error) {
    if (isApiError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Erreur recherche globale." }, { status: 500 });
  }
}
