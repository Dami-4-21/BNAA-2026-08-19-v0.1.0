import { NextRequest, NextResponse } from "next/server";

import { readUploadedFile } from "@/lib/backend/files";
import { sessionCookieName } from "@/lib/backend/session";
import { getDocumentVersionFile, isApiError } from "@/lib/backend/service";

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ documentId: string; projectId: string; versionId: string }>;
  },
) {
  try {
    const { projectId, documentId, versionId } = await params;
    const token = request.cookies.get(sessionCookieName)?.value ?? "";
    const asset = await getDocumentVersionFile(
      token,
      projectId,
      documentId,
      decodeURIComponent(versionId),
    );
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

    return NextResponse.json({ error: "Erreur lecture revision documentaire." }, { status: 500 });
  }
}
