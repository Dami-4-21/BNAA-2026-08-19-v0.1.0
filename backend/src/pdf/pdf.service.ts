import { Injectable } from "@nestjs/common";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

type ReportPdfInput = {
  activities: string;
  createdBy: string;
  createdAt: string;
  incidents: Array<{ action?: string; severity?: string; type?: string }>;
  notes: string;
  photoCount: number;
  progressByLot: Array<{ label?: string; lot?: string; progress?: number; task?: string }>;
  projectId: string;
  projectName: string;
  reportDate: string;
  reportId: string;
  signedAt?: string | null;
  signedBy?: string | null;
  status: string;
  weather: string;
  workforceCount: number;
  workforceBreakdown: Array<{ count?: number; label?: string; trade?: string }>;
};

@Injectable()
export class PdfService {
  private readonly reportsDir = resolve(process.cwd(), "var", "pdf", "reports");

  buildReportPdfUrl(projectId: string, reportId: string) {
    return `/api/v1/projects/${projectId}/reports/${reportId}/pdf`;
  }

  async generateReportPdf(input: ReportPdfInput) {
    await mkdir(this.reportsDir, { recursive: true });
    const buffer = this.buildReportPdfBuffer(input);
    const filename = `${input.reportId}.pdf`;
    const filePath = join(this.reportsDir, filename);
    await writeFile(filePath, buffer);

    return {
      buffer,
      filePath,
      fileName: this.buildReportFileName(input),
      pdfUrl: this.buildReportPdfUrl(input.projectId, input.reportId),
    };
  }

  async readReportPdf(reportId: string) {
    return readFile(join(this.reportsDir, `${reportId}.pdf`));
  }

  hasReportPdfPath(reportId: string) {
    return join(this.reportsDir, `${reportId}.pdf`);
  }

  queueReportPdf(reportId: string) {
    return {
      mode: "inline",
      queue: "pdf",
      reportId,
    };
  }

  queueInvoicePdf(invoiceId: string) {
    return { mode: "scaffold", queue: "pdf", invoiceId };
  }

  private buildReportFileName(input: ReportPdfInput) {
    const safeProject = this.toAscii(input.projectName).replace(/[^a-zA-Z0-9]+/g, "-");
    return `${safeProject || "chantier"}-${input.reportDate}.pdf`;
  }

  private buildReportPdfBuffer(input: ReportPdfInput) {
    const lines = this.buildReportLines(input);
    const pageSize = 42;
    const pages: string[][] = [];
    for (let index = 0; index < lines.length; index += pageSize) {
      pages.push(lines.slice(index, index + pageSize));
    }

    const objects: string[] = [];
    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

    const pageReferences: string[] = [];
    let nextObjectId = 4;

    for (const pageLines of pages) {
      const pageObjectId = nextObjectId;
      const contentObjectId = nextObjectId + 1;
      nextObjectId += 2;

      pageReferences.push(`${pageObjectId} 0 R`);
      const content = this.buildPageContent(pageLines);
      objects[pageObjectId] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ` +
        `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`;
      objects[contentObjectId] =
        `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`;
    }

    objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageReferences.join(" ")}] >>`;

    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [0];

    for (let index = 1; index < objects.length; index += 1) {
      offsets[index] = Buffer.byteLength(pdf, "latin1");
      pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
    }

    const xrefOffset = Buffer.byteLength(pdf, "latin1");
    pdf += `xref\n0 ${objects.length}\n`;
    pdf += "0000000000 65535 f \n";
    for (let index = 1; index < objects.length; index += 1) {
      pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
    }

    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\n`;
    pdf += `startxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, "latin1");
  }

  private buildPageContent(lines: string[]) {
    const escapedLines = lines.map((line) => this.escapePdfText(this.toAscii(line)));
    return [
      "BT",
      "/F1 11 Tf",
      "14 TL",
      "50 800 Td",
      ...escapedLines.flatMap((line, index) =>
        index === 0 ? [`(${line}) Tj`] : ["T*", `(${line}) Tj`],
      ),
      "ET",
    ].join("\n");
  }

  private buildReportLines(input: ReportPdfInput) {
    const lines: string[] = [
      "BnaaSaaS - Rapport journalier de chantier",
      `Projet : ${input.projectName}`,
      `Date : ${input.reportDate}`,
      `Meteo : ${input.weather}`,
      `Statut : ${input.status}`,
      `Effectif present : ${input.workforceCount}`,
      `Photos jointes : ${input.photoCount}`,
      "",
      "Repartition effectif",
      ...this.ensureSectionLines(
        input.workforceBreakdown.map(
          (line) => `- ${(line.label ?? line.trade ?? "Equipe").trim()} : ${line.count ?? 0}`,
        ),
      ),
      "",
      "Avancement par lot",
      ...this.ensureSectionLines(
        input.progressByLot.map((line) => {
          const label = line.lot ?? line.label ?? line.task ?? "Lot";
          const progress =
            typeof line.progress === "number" ? `${Math.round(line.progress)}%` : "n/a";
          return `- ${label} : ${progress}`;
        }),
      ),
      "",
      "Activites",
      ...this.ensureSectionLines(this.wrapText(input.activities || "Aucune activite renseignee.")),
      "",
      "Incidents",
      ...this.ensureSectionLines(
        input.incidents.map((incident) =>
          [
            incident.type ?? "Incident",
            incident.severity ? `gravite ${incident.severity}` : null,
            incident.action ? `action ${incident.action}` : null,
          ]
            .filter(Boolean)
            .join(" - "),
        ),
      ),
      "",
      "Notes",
      ...this.ensureSectionLines(this.wrapText(input.notes || "Aucune note.")),
      "",
      `Cree par : ${input.createdBy}`,
      `Cree le : ${input.createdAt}`,
      `Signe par : ${input.signedBy ?? "Non signe"}`,
      `Date de signature : ${input.signedAt ?? "Non disponible"}`,
    ];

    return lines.flatMap((line) => this.wrapText(line, 92));
  }

  private ensureSectionLines(lines: string[]) {
    return lines.length > 0 ? lines : ["- Aucun element"];
  }

  private wrapText(value: string, maxLength = 92) {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized) {
      return [""];
    }

    const words = normalized.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (candidate.length <= maxLength) {
        currentLine = candidate;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  private escapePdfText(value: string) {
    return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  }

  private toAscii(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7E]/g, " ");
  }
}
