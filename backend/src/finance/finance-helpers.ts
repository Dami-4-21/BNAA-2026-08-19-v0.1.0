import { BadRequestException } from "@nestjs/common";

import { pilotProjects } from "@/bootstrap/pilot-catalog";

const pilotProjectByBackendId = new Map(
  pilotProjects.map((project) => [project.backendId, project]),
);
const pilotProjectByName = new Map(
  pilotProjects.map((project) => [normalizeLookupKey(project.name), project]),
);

export const FINANCE_DOCUMENT_VISIBILITY = ["ADMIN", "CO", "CP", "MO"] as const;
export const FINANCE_DOCUMENT_PHASE = "EXE";
export const FINANCE_DOCUMENT_LOT = "Justificatifs finance";
export const FINANCE_DOCUMENT_DISCIPLINE = "Finance";

export function resolvePilotProject(projectId: string, projectName?: string | null) {
  return (
    pilotProjectByBackendId.get(projectId) ??
    pilotProjectByName.get(normalizeLookupKey(projectName ?? "")) ??
    null
  );
}

export function resolveProjectCode(projectId: string, projectName?: string | null) {
  const seed = resolvePilotProject(projectId, projectName);
  if (seed) {
    return seed.code.replace(/[^A-Za-z0-9]/g, "");
  }

  return projectId.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase() || "PRJ";
}

export function resolveProjectClient(projectId: string, projectName?: string | null) {
  return resolvePilotProject(projectId, projectName)?.client ?? projectName ?? "Client BNAA";
}

export function resolveProjectBudget(projectId: string, projectName?: string | null) {
  return roundTo(resolvePilotProject(projectId, projectName)?.budgetTnd ?? 0, 3);
}

export function resolveProjectSpent(projectId: string, projectName?: string | null) {
  return roundTo(resolvePilotProject(projectId, projectName)?.spentTnd ?? 0, 3);
}

export function resolveProjectStatus(projectId: string, projectName?: string | null) {
  return resolvePilotProject(projectId, projectName)?.status ?? "En execution";
}

export function normalizeDate(input: string) {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException("Invalid date.");
  }

  return parsed.toISOString().slice(0, 10);
}

export function normalizePeriodMonth(input: string) {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException("Invalid billing period.");
  }

  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

export function formatDateOnly(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const raw = String(value ?? "").trim();
  if (!raw) {
    return raw;
  }

  return raw.length >= 10 ? raw.slice(0, 10) : raw;
}

export function toNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  return 0;
}

export function roundTo(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function buildMonthEnd(periodMonth: string) {
  const parsed = new Date(periodMonth);
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
}

export function buildFinancePeriodKey(periodMonth: string) {
  return normalizeDate(periodMonth).slice(0, 7).replace("-", "");
}

export function buildStatementDocumentCode(
  projectId: string,
  projectName: string,
  periodMonth: string,
) {
  return `DM-${resolveProjectCode(projectId, projectName)}-${buildFinancePeriodKey(periodMonth)}`;
}

export function buildPaymentDocumentCode(invoiceNumber: string, paymentSequence: number) {
  return `PAY-${invoiceNumber}-${String(paymentSequence).padStart(2, "0")}`;
}

export function normalizeLookupKey(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
