import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName } from "@/lib/backend/session";
import {
  getDocumentsPayload,
  isApiError,
  mutateDocumentsPayload,
  uploadDocumentVersion,
} from "@/lib/backend/service";
import { getRebuildAccessTokenFromRequest } from "@/lib/rebuild-auth";
import {
  buildRebuildDocumentsPayload,
  mutateRebuildDocumentsPayload,
  publishRebuildDocumentVersion,
  shouldUseRebuildDocumentsBridge,
} from "@/lib/rebuild-documents";

const rebuildDocumentActions = new Set([
  "acknowledge",
  "distribute",
  "mark-obsolete",
  "toggle-offline",
  "update-metadata",
]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const token = request.cookies.get(sessionCookieName)?.value ?? "";

    if (shouldUseRebuildDocumentsBridge()) {
      try {
        const rebuildAccessToken = getRebuildAccessTokenFromRequest(request);
        const bridgedPayload = await buildRebuildDocumentsPayload(rebuildAccessToken, projectId);

        if (bridgedPayload) {
          return NextResponse.json(bridgedPayload);
        }
      } catch (error) {
        console.error("[documents bridge] fallback to legacy payload", error);
      }
    }

    const payload = await getDocumentsPayload(token, projectId);
    return NextResponse.json(payload);
  } catch (error) {
    if (isApiError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Erreur documents." }, { status: 500 });
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
            return NextResponse.json({ error: "Fichier document manquant." }, { status: 400 });
          }

          if (shouldUseRebuildDocumentsBridge()) {
            try {
              const rebuildAccessToken = getRebuildAccessTokenFromRequest(request);
              const bridgedPayload = await publishRebuildDocumentVersion(
                rebuildAccessToken,
                projectId,
                {
                  documentId: String(formData.get("documentId") ?? ""),
                  file,
                  format: String(formData.get("format") ?? ""),
                  revision: String(formData.get("revision") ?? ""),
                },
              );

              if (bridgedPayload) {
                return NextResponse.json(bridgedPayload);
              }
            } catch (error) {
              console.error("[documents bridge] publish fallback to legacy payload", error);
            }
          }

          const nextPayload = await uploadDocumentVersion(token, projectId, {
            documentId: String(formData.get("documentId") ?? ""),
            file,
            format: String(formData.get("format") ?? ""),
            revision: String(formData.get("revision") ?? ""),
          });
          return NextResponse.json(nextPayload);
        })()
      : await (async () => {
          const body = (await request.json()) as {
            action?: string;
            payload?: Record<string, unknown>;
          };

          if (shouldUseRebuildDocumentsBridge() && rebuildDocumentActions.has(body.action ?? "")) {
            try {
              const rebuildAccessToken = getRebuildAccessTokenFromRequest(request);
              const bridgedPayload = await mutateRebuildDocumentsPayload(
                rebuildAccessToken,
                projectId,
                body.action as
                  | "acknowledge"
                  | "distribute"
                  | "mark-obsolete"
                  | "toggle-offline"
                  | "update-metadata",
                {
                  documentId: String(body.payload?.documentId ?? ""),
                  ...body.payload,
                },
              );

              if (bridgedPayload) {
                return NextResponse.json(bridgedPayload);
              }
            } catch (error) {
              console.error("[documents bridge] mutation fallback to legacy payload", error);
            }
          }

          const nextPayload = await mutateDocumentsPayload(
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

    return NextResponse.json({ error: "Erreur action documentaire." }, { status: 500 });
  }
}
