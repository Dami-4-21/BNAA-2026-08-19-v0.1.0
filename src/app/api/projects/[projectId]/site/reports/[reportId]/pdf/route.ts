import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName } from "@/lib/backend/session";
import { downloadSiteReportPdf, isApiError } from "@/lib/backend/service";
import { getRebuildAccessTokenFromRequest } from "@/lib/rebuild-auth";
import {
  downloadRebuildSiteReportPdf,
  shouldUseRebuildSiteBridge,
} from "@/lib/rebuild-site";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; reportId: string }> },
) {
  try {
    const { projectId, reportId } = await params;

    if (shouldUseRebuildSiteBridge()) {
      try {
        const rebuildAccessToken = getRebuildAccessTokenFromRequest(request);
        const rebuildPdf = await downloadRebuildSiteReportPdf(
          rebuildAccessToken,
          projectId,
          reportId,
        );

        if (rebuildPdf) {
          return new NextResponse(Buffer.from(rebuildPdf.bytes), {
            headers: {
              "Content-Disposition": `attachment; filename="${rebuildPdf.fileName}"`,
              "Content-Type": "application/pdf",
            },
          });
        }
      } catch (error) {
        console.error("[site bridge] pdf fallback to legacy payload", error);
      }
    }

    const token = request.cookies.get(sessionCookieName)?.value ?? "";
    const { bytes, fileName } = await downloadSiteReportPdf(token, projectId, reportId);

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Type": "application/pdf",
      },
    });
  } catch (error) {
    if (isApiError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Erreur generation PDF chantier." }, { status: 500 });
  }
}
