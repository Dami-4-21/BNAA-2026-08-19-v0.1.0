import { Injectable } from "@nestjs/common";

@Injectable()
export class PdfService {
  queueReportPdf(reportId: string) {
    return { mode: "scaffold", queue: "pdf", reportId };
  }

  queueInvoicePdf(invoiceId: string) {
    return { mode: "scaffold", queue: "pdf", invoiceId };
  }
}
