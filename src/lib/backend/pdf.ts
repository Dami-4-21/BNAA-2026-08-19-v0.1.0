import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

type ToneKey = "black" | "muted" | "success" | "warning" | "danger";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_MARGIN = 48;
const FONT_SIZE_BODY = 10;
const FONT_SIZE_SMALL = 8;
const FONT_SIZE_SECTION = 12;
const FONT_SIZE_TITLE = 22;

const palette: Record<ToneKey, ReturnType<typeof rgb>> = {
  black: rgb(0.08, 0.08, 0.08),
  muted: rgb(0.42, 0.42, 0.42),
  success: rgb(0.1, 0.45, 0.24),
  warning: rgb(0.78, 0.45, 0.04),
  danger: rgb(0.7, 0.18, 0.18),
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-TN", {
    style: "currency",
    currency: "TND",
    maximumFractionDigits: 3,
  }).format(value);
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number) {
  const normalized = text.replace(/\r/g, "").split("\n");
  const lines: string[] = [];

  for (const paragraph of normalized) {
    const words = paragraph.split(/\s+/).filter(Boolean);

    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let current = "";

    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
        current = next;
      } else {
        if (current) {
          lines.push(current);
        }
        current = word;
      }
    }

    if (current) {
      lines.push(current);
    }
  }

  return lines;
}

function drawTextBlock(options: {
  color?: ToneKey;
  font: PDFFont;
  fontSize: number;
  maxWidth: number;
  page: PDFPage;
  text: string;
  x: number;
  y: number;
}) {
  const lines = wrapText(options.text, options.font, options.fontSize, options.maxWidth);
  let cursorY = options.y;

  for (const line of lines) {
    options.page.drawText(line, {
      x: options.x,
      y: cursorY,
      font: options.font,
      size: options.fontSize,
      color: palette[options.color ?? "black"],
    });
    cursorY -= options.fontSize + 4;
  }

  return cursorY;
}

function drawSectionTitle(page: PDFPage, font: PDFFont, title: string, y: number) {
  page.drawText(title, {
    x: PAGE_MARGIN,
    y,
    font,
    size: FONT_SIZE_SECTION,
    color: palette.black,
  });
  page.drawLine({
    start: { x: PAGE_MARGIN, y: y - 6 },
    end: { x: A4_WIDTH - PAGE_MARGIN, y: y - 6 },
    thickness: 1,
    color: rgb(0.88, 0.88, 0.88),
  });

  return y - 22;
}

function drawKeyValueGrid(options: {
  entries: Array<{ label: string; value: string }>;
  font: PDFFont;
  page: PDFPage;
  y: number;
}) {
  const columnWidth = (A4_WIDTH - PAGE_MARGIN * 2 - 16) / 2;
  const rowHeight = 42;
  let cursorY = options.y;

  for (let index = 0; index < options.entries.length; index += 2) {
    const row = options.entries.slice(index, index + 2);

    row.forEach((entry, columnIndex) => {
      const x = PAGE_MARGIN + columnIndex * (columnWidth + 16);
      options.page.drawRectangle({
        x,
        y: cursorY - rowHeight + 8,
        width: columnWidth,
        height: rowHeight,
        color: rgb(0.97, 0.97, 0.97),
        borderColor: rgb(0.9, 0.9, 0.9),
        borderWidth: 1,
      });
      options.page.drawText(entry.label.toUpperCase(), {
        x: x + 12,
        y: cursorY - 10,
        font: options.font,
        size: FONT_SIZE_SMALL,
        color: palette.muted,
      });
      options.page.drawText(entry.value, {
        x: x + 12,
        y: cursorY - 27,
        font: options.font,
        size: FONT_SIZE_BODY,
        color: palette.black,
      });
    });

    cursorY -= rowHeight + 10;
  }

  return cursorY;
}

function drawHeader(options: {
  code: string;
  page: PDFPage;
  projectName: string;
  subtitle: string;
  title: string;
  titleRight?: string;
}) {
  options.page.drawRectangle({
    x: 0,
    y: A4_HEIGHT - 120,
    width: A4_WIDTH,
    height: 120,
    color: rgb(0.97, 0.97, 0.97),
  });
  options.page.drawText("BNAASAAS", {
    x: PAGE_MARGIN,
    y: A4_HEIGHT - 42,
    size: 13,
    color: palette.black,
  });
  options.page.drawText(options.code, {
    x: A4_WIDTH - PAGE_MARGIN - 90,
    y: A4_HEIGHT - 42,
    size: 12,
    color: palette.muted,
  });
  options.page.drawText(options.title, {
    x: PAGE_MARGIN,
    y: A4_HEIGHT - 74,
    size: FONT_SIZE_TITLE,
    color: palette.black,
  });
  if (options.titleRight) {
    options.page.drawText(options.titleRight, {
      x: A4_WIDTH - PAGE_MARGIN - 150,
      y: A4_HEIGHT - 74,
      size: 12,
      color: palette.muted,
    });
  }
  options.page.drawText(`${options.projectName} - ${options.subtitle}`, {
    x: PAGE_MARGIN,
    y: A4_HEIGHT - 96,
    size: FONT_SIZE_BODY,
    color: palette.muted,
  });

  return A4_HEIGHT - 145;
}

export async function buildDailyReportPdf(input: {
  generatedAt: string;
  generatedBy: string;
  project: {
    client: string;
    code: string;
    location: string;
    name: string;
  };
  report: {
    activities?: string;
    author: string;
    completeness: number;
    date: string;
    id: string;
    incidents?: string;
    note?: string;
    pdfReady: boolean;
    progress: number;
    progressByLot?: Array<{ lot: string; progress: number; task: string }>;
    signedByCt: boolean;
    signedByMoe: boolean;
    status: string;
    summary: string;
    weather: string;
    workforce: number;
  };
}) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = drawHeader({
    code: input.project.code,
    page,
    projectName: input.project.name,
    subtitle: "Rapport journalier de chantier",
    title: input.report.id,
    titleRight: formatDate(input.report.date),
  });

  y = drawKeyValueGrid({
    entries: [
      { label: "Projet", value: input.project.name },
      { label: "Client", value: input.project.client || "Non renseigne" },
      { label: "Localisation", value: input.project.location || "Non renseignee" },
      { label: "Conducteur", value: input.report.author },
      { label: "Meteo", value: input.report.weather },
      { label: "Effectif present", value: `${input.report.workforce} ouvriers` },
      { label: "Avancement global", value: `${input.report.progress}%` },
      { label: "Completude", value: `${input.report.completeness}%` },
      { label: "Statut", value: input.report.status },
      { label: "PDF", value: input.report.pdfReady ? "Pret" : "En attente" },
    ],
    font: regular,
    page,
    y,
  });

  y = drawSectionTitle(page, bold, "Activites realisees", y - 4);
  y = drawTextBlock({
    font: regular,
    fontSize: FONT_SIZE_BODY,
    maxWidth: A4_WIDTH - PAGE_MARGIN * 2,
    page,
    text: input.report.activities?.trim() || input.report.summary,
    x: PAGE_MARGIN,
    y,
  });

  y = drawSectionTitle(page, bold, "Incidents et blocages", y - 10);
  y = drawTextBlock({
    color: input.report.incidents?.trim() ? "warning" : "muted",
    font: regular,
    fontSize: FONT_SIZE_BODY,
    maxWidth: A4_WIDTH - PAGE_MARGIN * 2,
    page,
    text: input.report.incidents?.trim() || "Aucun incident declare sur ce rapport.",
    x: PAGE_MARGIN,
    y,
  });

  y = drawSectionTitle(page, bold, "Note chantier", y - 10);
  y = drawTextBlock({
    color: "muted",
    font: regular,
    fontSize: FONT_SIZE_BODY,
    maxWidth: A4_WIDTH - PAGE_MARGIN * 2,
    page,
    text: input.report.note?.trim() || "Pas de note complementaire.",
    x: PAGE_MARGIN,
    y,
  });

  if (input.report.progressByLot?.length) {
    y = drawSectionTitle(page, bold, "Avancement par lot", y - 10);
    input.report.progressByLot.slice(0, 8).forEach((item) => {
      page.drawText(item.lot, {
        x: PAGE_MARGIN,
        y,
        font: bold,
        size: FONT_SIZE_BODY,
        color: palette.black,
      });
      page.drawText(`${item.progress}% - ${item.task}`, {
        x: PAGE_MARGIN + 120,
        y,
        font: regular,
        size: FONT_SIZE_BODY,
        color: palette.muted,
      });
      y -= 16;
    });
  }

  y = Math.max(y - 30, 120);
  page.drawLine({
    start: { x: PAGE_MARGIN, y },
    end: { x: A4_WIDTH - PAGE_MARGIN, y },
    thickness: 1,
    color: rgb(0.88, 0.88, 0.88),
  });
  y -= 34;

  page.drawText("Signatures", {
    x: PAGE_MARGIN,
    y,
    font: bold,
    size: FONT_SIZE_SECTION,
    color: palette.black,
  });
  y -= 24;
  page.drawText(
    `Conducteur de travaux: ${input.report.signedByCt ? input.report.author : "En attente"}`,
    {
      x: PAGE_MARGIN,
      y,
      font: regular,
      size: FONT_SIZE_BODY,
      color: input.report.signedByCt ? palette.success : palette.warning,
    },
  );
  y -= 18;
  page.drawText(
    `Maitre d'oeuvre: ${input.report.signedByMoe ? "Valide dans l'application" : "En attente"}`,
    {
      x: PAGE_MARGIN,
      y,
      font: regular,
      size: FONT_SIZE_BODY,
      color: input.report.signedByMoe ? palette.success : palette.warning,
    },
  );
  y -= 30;
  page.drawText(`Genere le ${formatDateTime(input.generatedAt)} par ${input.generatedBy}`, {
    x: PAGE_MARGIN,
    y,
    font: regular,
    size: FONT_SIZE_SMALL,
    color: palette.muted,
  });

  return pdf.save();
}

export async function buildInvoicePdf(input: {
  declarationStatus: string;
  generatedAt: string;
  generatedBy: string;
  invoice: {
    advanceDeduction: number;
    amountHt: number;
    amountTtc: number;
    dueDate: string;
    id: string;
    invoiceNumber: string;
    paidAt: string;
    periodMonth: string;
    project: string;
    retentionAmount: number;
    sourceProgress: number;
    status: string;
    tvaAmount: number;
    tvaRate: number;
    validatedByMo: boolean;
    validatedByMoe: boolean;
  };
  payments: Array<{
    amount: number;
    method: string;
    paidAt: string;
    reference: string;
  }>;
  project: {
    client: string;
    code: string;
    location: string;
    name: string;
  };
}) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = drawHeader({
    code: input.project.code,
    page,
    projectName: input.project.name,
    subtitle: "Facture client",
    title: input.invoice.invoiceNumber,
    titleRight: formatDate(input.invoice.periodMonth),
  });

  y = drawKeyValueGrid({
    entries: [
      { label: "Projet", value: input.invoice.project },
      { label: "Client", value: input.project.client || "Non renseigne" },
      { label: "Localisation", value: input.project.location || "Non renseignee" },
      { label: "Mois de facturation", value: formatDate(input.invoice.periodMonth) },
      { label: "Echeance", value: formatDate(input.invoice.dueDate) },
      { label: "Statut", value: input.invoice.status },
      { label: "Validation MOE", value: input.invoice.validatedByMoe ? "Validee" : "En attente" },
      { label: "Validation MO", value: input.invoice.validatedByMo ? "Validee" : "En attente" },
      { label: "Avancement source", value: `${input.invoice.sourceProgress}%` },
      { label: "TVA", value: `${input.invoice.tvaRate}%` },
    ],
    font: regular,
    page,
    y,
  });

  y = drawSectionTitle(page, bold, "Synthese financiere", y - 4);
  [
    ["Montant HT", formatCurrency(input.invoice.amountHt)],
    ["Retenue de garantie", `- ${formatCurrency(input.invoice.retentionAmount)}`],
    ["Deduction avance", `- ${formatCurrency(input.invoice.advanceDeduction)}`],
    ["Montant TVA", formatCurrency(input.invoice.tvaAmount)],
    ["Montant TTC", formatCurrency(input.invoice.amountTtc)],
  ].forEach(([label, value]) => {
    page.drawText(label, {
      x: PAGE_MARGIN,
      y,
      font: regular,
      size: FONT_SIZE_BODY,
      color: palette.black,
    });
    page.drawText(value, {
      x: A4_WIDTH - PAGE_MARGIN - 140,
      y,
      font: bold,
      size: FONT_SIZE_BODY,
      color: label === "Montant TTC" ? palette.success : palette.black,
    });
    y -= 18;
  });

  y = drawSectionTitle(page, bold, "Paiements enregistres", y - 12);
  if (input.payments.length === 0) {
    y = drawTextBlock({
      color: "muted",
      font: regular,
      fontSize: FONT_SIZE_BODY,
      maxWidth: A4_WIDTH - PAGE_MARGIN * 2,
      page,
      text: "Aucun paiement enregistre pour cette facture a ce jour.",
      x: PAGE_MARGIN,
      y,
    });
  } else {
    input.payments.slice(0, 8).forEach((payment) => {
      page.drawText(formatDateTime(payment.paidAt), {
        x: PAGE_MARGIN,
        y,
        font: regular,
        size: FONT_SIZE_BODY,
        color: palette.black,
      });
      page.drawText(`${payment.method} - ${payment.reference}`, {
        x: PAGE_MARGIN + 120,
        y,
        font: regular,
        size: FONT_SIZE_BODY,
        color: palette.muted,
      });
      page.drawText(formatCurrency(payment.amount), {
        x: A4_WIDTH - PAGE_MARGIN - 110,
        y,
        font: bold,
        size: FONT_SIZE_BODY,
        color: palette.success,
      });
      y -= 18;
    });
  }

  y = drawSectionTitle(page, bold, "Conformite & archivage", y - 10);
  y = drawTextBlock({
    color: "muted",
    font: regular,
    fontSize: FONT_SIZE_BODY,
    maxWidth: A4_WIDTH - PAGE_MARGIN * 2,
    page,
    text: `Declaration TVA: ${input.declarationStatus}. Facture generee depuis le projet ${input.project.code} et archivee dans l'application.`,
    x: PAGE_MARGIN,
    y,
  });

  y = Math.max(y - 18, 84);
  page.drawText(`Genere le ${formatDateTime(input.generatedAt)} par ${input.generatedBy}`, {
    x: PAGE_MARGIN,
    y,
    font: regular,
    size: FONT_SIZE_SMALL,
    color: palette.muted,
  });

  if (input.invoice.paidAt) {
    page.drawText(`Paiement complet constate le ${formatDateTime(input.invoice.paidAt)}`, {
      x: PAGE_MARGIN,
      y: y - 14,
      font: regular,
      size: FONT_SIZE_SMALL,
      color: palette.success,
    });
  }

  return pdf.save();
}
