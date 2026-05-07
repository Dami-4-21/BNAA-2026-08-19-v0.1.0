import { NextRequest, NextResponse } from "next/server";

import { buildSessionCookie } from "@/lib/backend/session";
import { authenticateUser, isApiError } from "@/lib/backend/service";
import {
  applyRebuildSessionCookies,
  authenticateWithRebuildApi,
  shouldUseRebuildAuthBridge,
} from "@/lib/rebuild-auth";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const result = await authenticateUser(body.email ?? "", body.password ?? "");
    const response = NextResponse.json({
      user: result.user,
      homePath: result.homePath,
      permissions: result.permissions,
    });

    response.cookies.set(buildSessionCookie(result.sessionToken));

    if (shouldUseRebuildAuthBridge()) {
      const rebuildSession = await authenticateWithRebuildApi(
        body.email ?? "",
        body.password ?? "",
      );

      if (rebuildSession) {
        applyRebuildSessionCookies(response, rebuildSession.tokens);
      }
    }

    return response;
  } catch (error) {
    if (isApiError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Erreur de connexion." }, { status: 500 });
  }
}
