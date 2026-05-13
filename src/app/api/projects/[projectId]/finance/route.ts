import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName } from "@/lib/backend/session";
import { getFinancePayload, isApiError, mutateFinancePayload } from "@/lib/backend/service";
import { getRebuildAccessTokenFromRequest } from "@/lib/rebuild-auth";
import {
  buildRebuildFinancePayload,
  mutateRebuildFinancePayload,
  shouldUseRebuildFinanceBridge,
} from "@/lib/rebuild-finance";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const token = request.cookies.get(sessionCookieName)?.value ?? "";

    if (shouldUseRebuildFinanceBridge()) {
      const fallbackPayload = await getFinancePayload(token, projectId);
      const rebuildAccessToken = getRebuildAccessTokenFromRequest(request);
      const bridgedPayload = await buildRebuildFinancePayload(
        rebuildAccessToken,
        projectId,
        fallbackPayload,
      );

      if (!bridgedPayload) {
        return NextResponse.json({ error: "Erreur finance." }, { status: 500 });
      }

      return NextResponse.json(bridgedPayload);
    }

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

    if (shouldUseRebuildFinanceBridge()) {
      const fallbackPayload = await getFinancePayload(token, projectId);
      const rebuildAccessToken = getRebuildAccessTokenFromRequest(request);
      const bridgedPayload = await mutateRebuildFinancePayload(
        rebuildAccessToken,
        projectId,
        (body.action ?? "") as
          | "create-invoice"
          | "register-payment"
          | "send-invoice"
          | "update-invoice-status"
          | "validate-invoice",
        body.payload ?? {},
        fallbackPayload,
      );

      if (!bridgedPayload) {
        return NextResponse.json({ error: "Erreur action finance." }, { status: 500 });
      }

      return NextResponse.json(bridgedPayload);
    }

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
