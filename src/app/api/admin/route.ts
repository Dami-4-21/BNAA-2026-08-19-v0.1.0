import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName } from "@/lib/backend/session";
import {
  createAdminUser,
  getAdminPayload,
  isApiError,
} from "@/lib/backend/service";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(sessionCookieName)?.value ?? "";
    const payload = await getAdminPayload(token);
    return NextResponse.json(payload);
  } catch (error) {
    if (isApiError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Erreur administration." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(sessionCookieName)?.value ?? "";
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      password?: string;
      role?: "Comptable" | "Chef de projet" | "Conductrice travaux" | "Bureau d'etudes" | "Maitre d'ouvrage" | "Super Admin";
      projectIds?: string[];
    };

    const payload = await createAdminUser(token, {
      name: body.name ?? "",
      email: body.email ?? "",
      password: body.password ?? "",
      role: body.role ?? "Comptable",
      projectIds: body.projectIds ?? [],
    });

    return NextResponse.json(payload);
  } catch (error) {
    if (isApiError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Erreur creation utilisateur." }, { status: 500 });
  }
}
