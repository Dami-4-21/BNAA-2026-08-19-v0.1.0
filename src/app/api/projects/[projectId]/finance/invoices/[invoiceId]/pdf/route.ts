import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName } from "@/lib/backend/session";
import { downloadInvoicePdf, isApiError } from "@/lib/backend/service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string; projectId: string }> },
) {
  try {
    const { invoiceId, projectId } = await params;
    const token = request.cookies.get(sessionCookieName)?.value ?? "";
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
