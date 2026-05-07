export function buildInvoiceNumber(year: number, sequence: number) {
  return `${year}-${String(sequence).padStart(3, "0")}`;
}
