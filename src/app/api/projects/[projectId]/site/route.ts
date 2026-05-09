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
  mutateRebuildSiteNcr,
  shouldUseRebuildSiteBridge,
  uploadRebuildSitePhoto,
} from "@/lib/rebuild-site";

const rebuildReportActions = new Set([
  "create-report",
  "mark-pdf-ready",
  "sign-report",
  "update-report",
]);
const rebuildNcrActions = new Set(["close-ncr", "create-ncr"]);

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

          const photoPayload = {
            file,
            geo: String(formData.get("geo") ?? ""),
            lot: String(formData.get("lot") ?? ""),
            task: String(formData.get("task") ?? ""),
            title: String(formData.get("title") ?? ""),
            zone: String(formData.get("zone") ?? ""),
          };

          if (shouldUseRebuildSiteBridge()) {
            try {
              const rebuildAccessToken = getRebuildAccessTokenFromRequest(request);
              const bridged = await uploadRebuildSitePhoto(
                rebuildAccessToken,
                projectId,
                photoPayload,
              );

              if (bridged) {
                const legacyPayload = await getSitePayload(token, projectId);
                legacyPayload.draftPhoto = {
                  geo: photoPayload.geo,
                  lot: photoPayload.lot,
                  task: photoPayload.task,
                  title: photoPayload.title,
                  zone: photoPayload.zone,
                };
                const nextPayload = await buildRebuildSitePayload(
                  rebuildAccessToken,
                  projectId,
                  legacyPayload,
                );

                if (nextPayload) {
                  return NextResponse.json(nextPayload);
                }

                return NextResponse.json(legacyPayload);
              }
            } catch (error) {
              console.error("[site bridge] photo upload fallback to legacy payload", error);
            }
          }

          const nextPayload = await uploadSitePhoto(token, projectId, photoPayload);
          return NextResponse.json(nextPayload);
        })()
      : await (async () => {
          const body = (await request.json()) as {
            action?: string;
            payload?: Record<string, unknown>;
          };

          if (shouldUseRebuildSiteBridge()) {
            try {
              const rebuildAccessToken = getRebuildAccessTokenFromRequest(request);
              let bridged = false;

              if (rebuildReportActions.has(body.action ?? "")) {
                bridged = await mutateRebuildSiteReports(
                  rebuildAccessToken,
                  projectId,
                  body.action as
                    | "create-report"
                    | "mark-pdf-ready"
                    | "sign-report"
                    | "update-report",
                  body.payload ?? {},
                );
              } else if (rebuildNcrActions.has(body.action ?? "")) {
                bridged = await mutateRebuildSiteNcr(
                  rebuildAccessToken,
                  projectId,
                  body.action as "close-ncr" | "create-ncr",
                  body.payload ?? {},
                );
              }

              if (bridged) {
                const legacyPayload = await getSitePayload(token, projectId);
                if (body.action === "create-ncr") {
                  const draftNcr = body.payload?.draftNcr;
                  if (draftNcr && typeof draftNcr === "object") {
                    legacyPayload.draftNcr = {
                      description: String((draftNcr as Record<string, unknown>).description ?? ""),
                      dueDate: String((draftNcr as Record<string, unknown>).dueDate ?? ""),
                      owner: String((draftNcr as Record<string, unknown>).owner ?? ""),
                      photoAttached: Boolean(
                        (draftNcr as Record<string, unknown>).photoAttached ?? false,
                      ),
                      severity: String((draftNcr as Record<string, unknown>).severity ?? ""),
                      title: String((draftNcr as Record<string, unknown>).title ?? ""),
                    };
                  }
                }
                const nextPayload = await buildRebuildSitePayload(
                  rebuildAccessToken,
                  projectId,
                  legacyPayload,
                );

                if (nextPayload) {
                  return NextResponse.json(nextPayload);
                }

                return NextResponse.json(legacyPayload);
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
