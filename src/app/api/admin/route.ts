import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName } from "@/lib/backend/session";
import {
  archiveAdminProject,
  createAdminProject,
  createAdminUser,
  getAdminPayload,
  isApiError,
  updateAdminProjectMembers,
  updateAdminProjectSetup,
  updateAdminUser,
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
      action?:
        | "archive-project"
        | "create-project"
        | "create-user"
        | "update-project-members"
        | "update-project-setup"
        | "update-user";
      payload?: Record<string, unknown>;
    };
    const payloadBody = body.payload ?? {};
    let payload;

    switch (body.action) {
      case "archive-project":
        payload = await archiveAdminProject(token, {
          projectId: String(payloadBody.projectId ?? ""),
        });
        break;
      case "create-project":
        payload = await createAdminProject(token, {
          budgetTnd: Number(payloadBody.budgetTnd ?? 0),
          client: String(payloadBody.client ?? ""),
          code: String(payloadBody.code ?? ""),
          location: String(payloadBody.location ?? ""),
          lots: String(payloadBody.lots ?? ""),
          name: String(payloadBody.name ?? ""),
          nextMilestone: String(payloadBody.nextMilestone ?? ""),
          phases: String(payloadBody.phases ?? ""),
          status: String(payloadBody.status ?? ""),
          zones: String(payloadBody.zones ?? ""),
        });
        break;
      case "update-project-setup":
        payload = await updateAdminProjectSetup(token, {
          projectId: String(payloadBody.projectId ?? ""),
          name: String(payloadBody.name ?? ""),
          client: String(payloadBody.client ?? ""),
          location: String(payloadBody.location ?? ""),
          status: String(payloadBody.status ?? ""),
          budgetTnd: Number(payloadBody.budgetTnd ?? 0),
          nextMilestone: String(payloadBody.nextMilestone ?? ""),
          lots: Array.isArray(payloadBody.lots)
            ? payloadBody.lots.map((entry) => String(entry))
            : [],
          phases: Array.isArray(payloadBody.phases)
            ? payloadBody.phases.map((entry) => String(entry))
            : [],
          zones: Array.isArray(payloadBody.zones)
            ? payloadBody.zones.map((entry) => String(entry))
            : [],
        });
        break;
      case "update-project-members":
        payload = await updateAdminProjectMembers(token, {
          projectId: String(payloadBody.projectId ?? ""),
          memberIds: Array.isArray(payloadBody.memberIds)
            ? payloadBody.memberIds.map((entry) => String(entry))
            : [],
        });
        break;
      case "update-user":
        payload = await updateAdminUser(token, {
          userId: String(payloadBody.userId ?? ""),
          role:
            (payloadBody.role as
              | "Comptable"
              | "Chef de projet"
              | "Conductrice travaux"
              | "Bureau d'etudes"
              | "Maitre d'ouvrage"
              | "Super Admin") ?? "Comptable",
          projectIds: Array.isArray(payloadBody.projectIds)
            ? payloadBody.projectIds.map((entry) => String(entry))
            : [],
        });
        break;
      case "create-user":
      default:
        payload = await createAdminUser(token, {
          name: String(payloadBody.name ?? ""),
          email: String(payloadBody.email ?? ""),
          password: String(payloadBody.password ?? ""),
          role:
            (payloadBody.role as
              | "Comptable"
              | "Chef de projet"
              | "Conductrice travaux"
              | "Bureau d'etudes"
              | "Maitre d'ouvrage"
              | "Super Admin") ?? "Comptable",
          projectIds: Array.isArray(payloadBody.projectIds)
            ? payloadBody.projectIds.map((entry) => String(entry))
            : [],
        });
        break;
    }

    return NextResponse.json(payload);
  } catch (error) {
    if (isApiError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Erreur creation utilisateur." }, { status: 500 });
  }
}
