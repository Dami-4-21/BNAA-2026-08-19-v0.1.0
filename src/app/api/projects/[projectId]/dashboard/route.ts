import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName } from "@/lib/backend/session";
import { getDashboardPayload, isApiError } from "@/lib/backend/service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
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
