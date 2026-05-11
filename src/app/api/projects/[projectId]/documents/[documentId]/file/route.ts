import { NextRequest, NextResponse } from "next/server";

import { readUploadedFile } from "@/lib/backend/files";
import { sessionCookieName } from "@/lib/backend/session";
import { getDocumentFile, isApiError } from "@/lib/backend/service";
import { getRebuildAccessTokenFromRequest } from "@/lib/rebuild-auth";
import {
  downloadRebuildDocumentFile,
  shouldUseRebuildDocumentsBridge,
} from "@/lib/rebuild-documents";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string; projectId: string }> },
) {
  try {
    const { projectId, documentId } = await params;

    if (shouldUseRebuildDocumentsBridge()) {
      const rebuildAccessToken = getRebuildAccessTokenFromRequest(request);
      const asset = await downloadRebuildDocumentFile(rebuildAccessToken, projectId, documentId);

      if (!asset) {
        return NextResponse.json({ error: "Erreur lecture document." }, { status: 500 });
      }

      return new NextResponse(new Uint8Array(asset.bytes), {
        headers: {
          "Cache-Control": "private, max-age=300",
          "Content-Disposition": `attachment; filename="${asset.fileName}"`,
          "Content-Type": asset.mimeType,
        },
      });
    }

    const token = request.cookies.get(sessionCookieName)?.value ?? "";
    const asset = await getDocumentFile(token, projectId, documentId);
    const bytes = await readUploadedFile(asset.filePath);

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Cache-Control": "private, max-age=300",
        "Content-Disposition": `attachment; filename="${asset.fileName}"`,
        "Content-Type": asset.mimeType,
      },
    });
  } catch (error) {
    if (isApiError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Erreur lecture document." }, { status: 500 });
  }
}
