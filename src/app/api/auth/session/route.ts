import { NextRequest, NextResponse } from "next/server";

import {
  buildExpiredSessionCookie,
  sessionCookieName,
} from "@/lib/backend/session";
import {
  clearAuthenticatedSession,
  getAuthenticatedSession,
  isApiError,
} from "@/lib/backend/service";
import {
  fetchRebuildSession,
  rebuildAccessCookieName,
  shouldUseRebuildAuthBridge,
} from "@/lib/rebuild-auth";

export async function GET(request: NextRequest) {
  try {
    if (shouldUseRebuildAuthBridge()) {
      const rebuildAccessToken =
        request.cookies.get(rebuildAccessCookieName)?.value ?? "";
      const rebuildSession = await fetchRebuildSession(rebuildAccessToken);

      if (rebuildSession) {
        return NextResponse.json(rebuildSession, { status: 200 });
      }
    }

    const token = request.cookies.get(sessionCookieName)?.value ?? null;
    const session = await getAuthenticatedSession(token);

    if (!session) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    return NextResponse.json(session);
  } catch (error) {
    if (isApiError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Erreur de session." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get(sessionCookieName)?.value ?? null;
    await clearAuthenticatedSession(token);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(buildExpiredSessionCookie());
    return response;
  } catch (error) {
    if (isApiError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Erreur de deconnexion." }, { status: 500 });
  }
}
