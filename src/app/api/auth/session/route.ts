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
  applyRebuildSessionCookies,
  clearRebuildSessionCookies,
  fetchRebuildSession,
  logoutFromRebuildApi,
  rebuildAccessCookieName,
  rebuildRefreshCookieName,
  refreshRebuildSession,
  shouldUseRebuildAuthBridge,
} from "@/lib/rebuild-auth";

export async function GET(request: NextRequest) {
  try {
    let shouldClearRebuildCookies = false;

    if (shouldUseRebuildAuthBridge()) {
      const rebuildAccessToken =
        request.cookies.get(rebuildAccessCookieName)?.value ?? "";
      const rebuildRefreshToken =
        request.cookies.get(rebuildRefreshCookieName)?.value ?? "";
      const rebuildSession = await fetchRebuildSession(rebuildAccessToken);

      if (rebuildSession) {
        return NextResponse.json(rebuildSession, { status: 200 });
      }

      const refreshedRebuildSession = await refreshRebuildSession(rebuildRefreshToken);
      if (refreshedRebuildSession) {
        const response = NextResponse.json(refreshedRebuildSession.session, { status: 200 });
        applyRebuildSessionCookies(response, refreshedRebuildSession.tokens);
        return response;
      }

      shouldClearRebuildCookies = Boolean(rebuildAccessToken || rebuildRefreshToken);
    }

    const token = request.cookies.get(sessionCookieName)?.value ?? null;
    const session = await getAuthenticatedSession(token);

    if (!session) {
      const response = NextResponse.json({ user: null }, { status: 200 });

      if (shouldClearRebuildCookies) {
        clearRebuildSessionCookies(response);
      }

      return response;
    }

    const response = NextResponse.json(session);

    if (shouldClearRebuildCookies) {
      clearRebuildSessionCookies(response);
    }

    return response;
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
    const rebuildAccessToken =
      request.cookies.get(rebuildAccessCookieName)?.value ?? "";
    await clearAuthenticatedSession(token);
    if (shouldUseRebuildAuthBridge()) {
      await logoutFromRebuildApi(rebuildAccessToken);
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(buildExpiredSessionCookie());
    clearRebuildSessionCookies(response);
    return response;
  } catch (error) {
    if (isApiError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Erreur de deconnexion." }, { status: 500 });
  }
}
