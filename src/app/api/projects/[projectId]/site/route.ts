import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName } from "@/lib/backend/session";
import {
  getSitePayload,
  isApiError,
  mutateSitePayload,
  uploadSitePhoto,
} from "@/lib/backend/service";
import { getRebuildAccessTokenFromRequest } from "@/lib/rebuild-auth";
import {
  buildRebuildSitePayload,
  mutateRebuildSiteReports,
  shouldUseRebuildSiteBridge,
} from "@/lib/rebuild-site";

const rebuildReportActions = new Set([
  "create-report",
  "mark-pdf-ready",
  "sign-report",
  "update-report",
]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const token = request.cookies.get(sessionCookieName)?.value ?? "";
    const legacyPayload = await getSitePayload(token, projectId);

    if (shouldUseRebuildSiteBridge()) {
      try {
        const rebuildAccessToken = getRebuildAccessTokenFromRequest(request);
        const bridgedPayload = await buildRebuildSitePayload(
          rebuildAccessToken,
          projectId,
          legacyPayload,
        );

        if (bridgedPayload) {
          return NextResponse.json(bridgedPayload);
        }
      } catch (error) {
        console.error("[site bridge] fallback to legacy payload", error);
      }
    }

    const payload = legacyPayload;
    return NextResponse.json(payload);
  } catch (error) {
    if (isApiError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Erreur suivi chantier." }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const token = request.cookies.get(sessionCookieName)?.value ?? "";
    const contentType = request.headers.get("content-type") ?? "";
    const payload = contentType.includes("multipart/form-data")
      ? await (async () => {
          const formData = await request.formData();
          const file = formData.get("file");

          if (!(file instanceof File)) {
            return NextResponse.json({ error: "Fichier photo manquant." }, { status: 400 });
          }

          const nextPayload = await uploadSitePhoto(token, projectId, {
            file,
            geo: String(formData.get("geo") ?? ""),
            lot: String(formData.get("lot") ?? ""),
            task: String(formData.get("task") ?? ""),
            title: String(formData.get("title") ?? ""),
            zone: String(formData.get("zone") ?? ""),
          });
          return NextResponse.json(nextPayload);
        })()
      : await (async () => {
          const body = (await request.json()) as {
            action?: string;
            payload?: Record<string, unknown>;
          };

          if (shouldUseRebuildSiteBridge() && rebuildReportActions.has(body.action ?? "")) {
            try {
              const rebuildAccessToken = getRebuildAccessTokenFromRequest(request);
              const bridged = await mutateRebuildSiteReports(
                rebuildAccessToken,
                projectId,
                body.action as
                  | "create-report"
                  | "mark-pdf-ready"
                  | "sign-report"
                  | "update-report",
                body.payload ?? {},
              );

              if (bridged) {
                const legacyPayload = await getSitePayload(token, projectId);
                const nextPayload = await buildRebuildSitePayload(
                  rebuildAccessToken,
                  projectId,
                  legacyPayload,
                );

                if (nextPayload) {
                  return NextResponse.json(nextPayload);
                }
              }
            } catch (error) {
              console.error("[site bridge] mutation fallback to legacy payload", error);
            }
          }

          const nextPayload = await mutateSitePayload(
            token,
            projectId,
            body.action ?? "",
            body.payload ?? {},
          );
          return NextResponse.json(nextPayload);
        })();
    return payload;
  } catch (error) {
    if (isApiError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Erreur action chantier." }, { status: 500 });
  }
}
