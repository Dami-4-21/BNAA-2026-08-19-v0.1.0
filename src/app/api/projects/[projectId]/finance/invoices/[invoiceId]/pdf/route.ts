import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName } from "@/lib/backend/session";
import { downloadInvoicePdf, isApiError } from "@/lib/backend/service";
import { getRebuildAccessTokenFromRequest } from "@/lib/rebuild-auth";
import {
  downloadRebuildInvoicePdf,
  shouldUseRebuildFinanceBridge,
} from "@/lib/rebuild-finance";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string; projectId: string }> },
) {
  try {
    const { invoiceId, projectId } = await params;
    const token = request.cookies.get(sessionCookieName)?.value ?? "";

    if (shouldUseRebuildFinanceBridge()) {
      const rebuildAccessToken = getRebuildAccessTokenFromRequest(request);
      const pdf = await downloadRebuildInvoicePdf(rebuildAccessToken, projectId, invoiceId);

      if (!pdf) {
        return NextResponse.json({ error: "Erreur generation PDF facture." }, { status: 500 });
      }

      return new NextResponse(Buffer.from(pdf.bytes), {
        headers: {
          "Content-Disposition": `attachment; filename="${pdf.fileName}"`,
          "Content-Type": pdf.mimeType,
        },
      });
    }

    const { bytes, fileName } = await downloadInvoicePdf(token, projectId, invoiceId);

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

    return NextResponse.json({ error: "Erreur generation PDF facture." }, { status: 500 });
  }
}
