import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName } from "@/lib/backend/session";
import {
  getNotificationsPayload,
  isApiError,
  mutateNotificationsPayload,
} from "@/lib/backend/service";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(sessionCookieName)?.value ?? "";
    const payload = await getNotificationsPayload(token);
    return NextResponse.json(payload);
  } catch (error) {
    if (isApiError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Erreur notifications." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(sessionCookieName)?.value ?? "";
    const body = (await request.json()) as {
      action?: "mark-all-read" | "mark-read" | "mark-unread";
      payload?: {
        notificationId?: string;
      };
    };

    const payload = await mutateNotificationsPayload(
      token,
      body.action ?? "mark-read",
      body.payload ?? {},
    );
    return NextResponse.json(payload);
  } catch (error) {
    if (isApiError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Erreur notifications." }, { status: 500 });
  }
}
