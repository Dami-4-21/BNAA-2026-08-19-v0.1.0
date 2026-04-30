import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName } from "@/lib/backend/session";
import { getFinancePayload, isApiError, mutateFinancePayload } from "@/lib/backend/service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const token = request.cookies.get(sessionCookieName)?.value ?? "";
    const payload = await getFinancePayload(token, projectId);
    return NextResponse.json(payload);
  } catch (error) {
    if (isApiError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Erreur finance." }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const token = request.cookies.get(sessionCookieName)?.value ?? "";
    const body = (await request.json()) as {
      action?: string;
      payload?: Record<string, unknown>;
    };
    const payload = await mutateFinancePayload(
      token,
      projectId,
      body.action ?? "",
      body.payload ?? {},
    );
    return NextResponse.json(payload);
  } catch (error) {
    if (isApiError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Erreur action finance." }, { status: 500 });
  }
}
