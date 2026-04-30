import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName } from "@/lib/backend/session";
import { getGlobalSearchPayload, isApiError } from "@/lib/backend/service";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(sessionCookieName)?.value ?? "";
    const query = request.nextUrl.searchParams.get("q") ?? "";
    const payload = await getGlobalSearchPayload(token, query);
    return NextResponse.json(payload);
  } catch (error) {
    if (isApiError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Erreur recherche globale." }, { status: 500 });
  }
}
