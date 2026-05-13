import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";

import { pilotProjects } from "@/bootstrap/pilot-catalog";
import { AuthenticatedUser } from "@/common/types/authenticated-user.interface";
import { CreateStatementDto } from "@/finance/dto/create-statement.dto";
import { SiteScopeService } from "@/site-reports/site-scope.service";

const DEFAULT_RETENTION_PCT = 5;
const DEFAULT_ADVANCE_DEDUCTION = 0;

const pilotBudgetByProjectId = new Map(
  pilotProjects.map((project) => [project.backendId, project.budgetTnd]),
);

type StatementRow = {
  advance_deduction: number | string;
  created_at: string;
  created_by: string;
  id: string;
  line_items: unknown;
  net_payable_ht: number | string;
  period_month: string;
  project_id: string;
  project_name?: string | null;
  rejection_note: string | null;
  retention_amount: number | string;
  retention_pct: number | string;
  status: string;
  subtotal_ht: number | string;
  validated_at: string | null;
  validated_by: string | null;
};

type ProjectRow = {
  contract_amount_ht: number | string | null;
  id: string;
  name: string;
};

type ReportRow = {
  id: string;
  progress_by_lot: unknown;
  report_date: string;
  status: string;
};

type StatementLineItem = {
  amountHt: number;
  calculationMode: "equal-lot-weight-fallback";
  lot: string;
  progressPct: number;
  tasks: string[];
};

type StatementCalculation = {
  advanceDeduction: number;
  contractAmountHt: number;
  lineItems: StatementLineItem[];
  netPayableHt: number;
  overallProgressPct: number;
  retentionAmount: number;
  retentionPct: number;
  sourceReport: {
    id: string;
    reportDate: string;
    status: string;
  };
  subtotalHt: number;
};

type ParsedProgressLine = {
  lot: string;
  progressPct: number;
  task: string;
};

@Injectable()
export class StatementsService {
  constructor(private readonly siteScope: SiteScopeService) {}

  async list(currentUser: AuthenticatedUser, projectId: string) {
    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      const result = await client.query<StatementRow>(
        `SELECT
           s.id,
           s.project_id,
           p.name AS project_name,
           s.period_month,
           s.line_items,
           s.subtotal_ht,
           s.retention_pct,
           s.retention_amount,
           s.advance_deduction,
           s.net_payable_ht,
           s.status,
           s.created_by,
           s.validated_by,
           s.validated_at,
           s.rejection_note,
           s.created_at
         FROM statements s
         INNER JOIN projects p
           ON p.id = s.project_id
         WHERE s.project_id = $1
         ORDER BY s.period_month DESC, s.created_at DESC`,
        [projectId],
      );

      return {
        items: result.rows.map((row) => this.mapStatementRow(row)),
      };
    });
  }

  async detail(currentUser: AuthenticatedUser, projectId: string, statementId: string) {
    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      const statement = await this.getStatement(client, projectId, statementId);

      return {
        item: this.mapStatementRow(statement),
      };
    });
  }

  async create(currentUser: AuthenticatedUser, projectId: string, payload: CreateStatementDto) {
    return this.siteScope.withProjectAccess(currentUser, projectId, async (client) => {
      const periodMonth = normalizePeriodMonth(payload.periodMonth);
      const existing = await client.query<{ id: string }>(
        `SELECT id
         FROM statements
         WHERE project_id = $1 AND period_month = $2
         LIMIT 1`,
        [projectId, periodMonth],
      );

      if (existing.rowCount) {
        throw new ConflictException("A monthly statement already exists for this project and period.");
      }

      const project = await this.getProject(client, projectId);
      const sourceReport = await this.findLatestReport(client, projectId, periodMonth);

      if (!sourceReport) {
        throw new BadRequestException(
          "No chantier report is available to calculate the monthly statement for this period.",
        );
      }

      const calculation = this.calculateStatement(project, sourceReport, payload);
      const statementId = uuidv4();

      await client.query(
        `INSERT INTO statements (
          id,
          project_id,
          period_month,
          line_items,
          subtotal_ht,
          retention_pct,
          retention_amount,
          advance_deduction,
          net_payable_ht,
          status,
          created_by
        ) VALUES (
          $1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, 'draft', $10
        )`,
        [
          statementId,
          projectId,
          periodMonth,
          JSON.stringify(calculation.lineItems),
          calculation.subtotalHt,
          calculation.retentionPct,
          calculation.retentionAmount,
          calculation.advanceDeduction,
          calculation.netPayableHt,
          currentUser.sub,
        ],
      );

      const created = await this.getStatement(client, projectId, statementId);

      return {
        item: this.mapStatementRow(created),
        calculation: {
          contractAmountHt: calculation.contractAmountHt,
          overallProgressPct: calculation.overallProgressPct,
          sourceReport: calculation.sourceReport,
        },
      };
    });
  }

  private async getProject(client: PoolClient, projectId: string) {
    const result = await client.query<ProjectRow>(
      `SELECT id, name, contract_amount_ht
       FROM projects
       WHERE id = $1
       LIMIT 1`,
      [projectId],
    );

    if (!result.rowCount) {
      throw new NotFoundException("Project not found.");
    }

    return result.rows[0];
  }

  private async getStatement(client: PoolClient, projectId: string, statementId: string) {
    const result = await client.query<StatementRow>(
      `SELECT
         s.id,
         s.project_id,
         p.name AS project_name,
         s.period_month,
         s.line_items,
         s.subtotal_ht,
         s.retention_pct,
         s.retention_amount,
         s.advance_deduction,
         s.net_payable_ht,
         s.status,
         s.created_by,
         s.validated_by,
         s.validated_at,
         s.rejection_note,
         s.created_at
       FROM statements s
       INNER JOIN projects p
         ON p.id = s.project_id
       WHERE s.project_id = $1
         AND s.id = $2
       LIMIT 1`,
      [projectId, statementId],
    );

    if (!result.rowCount) {
      throw new NotFoundException("Statement not found.");
    }

    return result.rows[0];
  }

  private async findLatestReport(
    client: PoolClient,
    projectId: string,
    periodMonth: string,
  ): Promise<ReportRow | null> {
    const periodEnd = endOfMonth(periodMonth);
    const result = await client.query<ReportRow>(
      `SELECT id, report_date, status, progress_by_lot
       FROM daily_reports
       WHERE project_id = $1
         AND report_date <= $2
       ORDER BY report_date DESC,
         CASE status
           WHEN 'signed' THEN 0
           WHEN 'pending_signature' THEN 1
           ELSE 2
         END ASC
       LIMIT 1`,
      [projectId, periodEnd],
    );

    return result.rows[0] ?? null;
  }

  private calculateStatement(
    project: ProjectRow,
    sourceReport: ReportRow,
    payload: CreateStatementDto,
  ): StatementCalculation {
    const contractAmountHt = this.resolveContractAmount(project);
    if (contractAmountHt <= 0) {
      throw new BadRequestException(
        "The project contract amount is missing. Add it before generating the monthly statement.",
      );
    }

    const progressLines = parseProgressLines(sourceReport.progress_by_lot);
    if (progressLines.length === 0) {
      throw new BadRequestException(
        "The latest chantier report does not contain usable lot progress for finance automation.",
      );
    }

    const groupedByLot = new Map<
      string,
      {
        progress: number[];
        tasks: Set<string>;
      }
    >();

    for (const line of progressLines) {
      const entry = groupedByLot.get(line.lot) ?? {
        progress: [],
        tasks: new Set<string>(),
      };
      entry.progress.push(line.progressPct);
      if (line.task) {
        entry.tasks.add(line.task);
      }
      groupedByLot.set(line.lot, entry);
    }

    const lotCount = groupedByLot.size;
    if (lotCount === 0) {
      throw new BadRequestException(
        "The latest chantier report does not contain any lot progress that can be billed.",
      );
    }

    const equalLotShare = contractAmountHt / lotCount;
    const lineItems = [...groupedByLot.entries()].map(([lot, entry]) => {
      const progressPct = roundTo(entry.progress.reduce((sum, value) => sum + value, 0) / entry.progress.length, 2);
      const amountHt = roundTo(equalLotShare * (progressPct / 100), 3);

      return {
        amountHt,
        calculationMode: "equal-lot-weight-fallback" as const,
        lot,
        progressPct,
        tasks: [...entry.tasks],
      };
    });

    const subtotalHt = roundTo(
      lineItems.reduce((sum, item) => sum + item.amountHt, 0),
      3,
    );
    const retentionPct = roundTo(payload.retentionPct ?? DEFAULT_RETENTION_PCT, 2);
    const advanceDeduction = roundTo(
      payload.advanceDeduction ?? DEFAULT_ADVANCE_DEDUCTION,
      3,
    );
    const retentionAmount = roundTo(subtotalHt * (retentionPct / 100), 3);
    const netPayableHt = roundTo(
      Math.max(subtotalHt - retentionAmount - advanceDeduction, 0),
      3,
    );
    const overallProgressPct = roundTo(
      lineItems.reduce((sum, item) => sum + item.progressPct, 0) / lineItems.length,
      2,
    );

    return {
      advanceDeduction,
      contractAmountHt,
      lineItems,
      netPayableHt,
      overallProgressPct,
      retentionAmount,
      retentionPct,
      sourceReport: {
        id: sourceReport.id,
        reportDate: formatDateOnly(sourceReport.report_date),
        status: sourceReport.status,
      },
      subtotalHt,
    };
  }

  private resolveContractAmount(project: ProjectRow) {
    const explicitAmount = toNumber(project.contract_amount_ht);
    if (explicitAmount > 0) {
      return explicitAmount;
    }

    return roundTo(pilotBudgetByProjectId.get(project.id) ?? 0, 3);
  }

  private mapStatementRow(row: StatementRow) {
    return {
      advanceDeduction: toNumber(row.advance_deduction),
      createdAt: row.created_at,
      createdBy: row.created_by,
      id: row.id,
      lineItems: parseStatementLineItems(row.line_items),
      netPayableHt: toNumber(row.net_payable_ht),
      periodMonth: formatDateOnly(row.period_month),
      projectId: row.project_id,
      projectName: row.project_name ?? null,
      rejectionNote: row.rejection_note,
      retentionAmount: toNumber(row.retention_amount),
      retentionPct: toNumber(row.retention_pct),
      status: row.status,
      subtotalHt: toNumber(row.subtotal_ht),
      validatedAt: row.validated_at,
      validatedBy: row.validated_by,
    };
  }
}

function normalizePeriodMonth(input: string) {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException("Invalid billing period.");
  }

  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

function endOfMonth(periodMonth: string) {
  const parsed = new Date(periodMonth);
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
}

function parseProgressLines(raw: unknown): ParsedProgressLine[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const lot = String(record.lot ?? "").trim();
      const task = String(record.task ?? "").trim();
      const progressPct = clampProgress(record.progress);

      if (!lot || progressPct === null) {
        return null;
      }

      return {
        lot,
        progressPct,
        task,
      };
    })
    .filter((item): item is ParsedProgressLine => item !== null);
}

function clampProgress(value: unknown) {
  const numeric = toNumber(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.min(100, Math.max(0, numeric));
}

function parseStatementLineItems(raw: unknown): StatementLineItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const lot = String(record.lot ?? "").trim();
      if (!lot) {
        return null;
      }

      const tasks = Array.isArray(record.tasks)
        ? record.tasks
            .map((task) => String(task ?? "").trim())
            .filter((task) => task.length > 0)
        : [];

      return {
        amountHt: roundTo(toNumber(record.amountHt), 3),
        calculationMode: "equal-lot-weight-fallback" as const,
        lot,
        progressPct: roundTo(toNumber(record.progressPct), 2),
        tasks,
      };
    })
    .filter((item): item is StatementLineItem => item !== null);
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  return 0;
}

function roundTo(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function formatDateOnly(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const raw = String(value ?? "").trim();
  if (!raw) {
    return raw;
  }

  return raw.length >= 10 ? raw.slice(0, 10) : raw;
}
