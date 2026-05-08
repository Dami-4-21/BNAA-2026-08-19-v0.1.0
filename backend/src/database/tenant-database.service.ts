import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool, PoolClient } from "pg";

const TENANT_TABLES = [
  "projects",
  "project_members",
  "daily_reports",
  "photos",
  "ncr",
  "ncr_photos",
  "documents",
  "document_versions",
  "document_distributions",
  "statements",
  "invoices",
  "payments",
  "notifications",
] as const;

const TENANT_SCHEMA_CONTRACT_NAME = "tenant-schema";
const TENANT_SCHEMA_CONTRACT_VERSION = "2025-05-mvp-v2";
const TENANT_SCHEMA_CONTRACT_PATH = resolve(
  __dirname,
  "../../prisma/tenant-template.sql",
);

type TenantSchemaContract = {
  checksum: string;
  sql: string;
  version: string;
};

@Injectable()
export class TenantDatabaseService {
  private readonly pool: Pool;
  private contractPromise?: Promise<TenantSchemaContract>;

  constructor(configService: ConfigService) {
    this.pool = new Pool({
      connectionString: configService.getOrThrow<string>("DATABASE_URL"),
    });
  }

  async withTenantSchema<T>(
    schemaName: string,
    handler: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(
        `SET LOCAL search_path TO ${this.quoteIdentifier(schemaName)}, public`,
      );
      const result = await handler(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async provisionTenantSchema(schemaName: string) {
    const client = await this.pool.connect();
    const contract = await this.loadTenantSchemaContract();

    try {
      await client.query("BEGIN");
      await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${this.quoteIdentifier(schemaName)}`);
      await this.ensureContractMetadataTable(client, schemaName);

      const missingTablesBeforeApply = await this.getMissingTenantTables(client, schemaName);
      const appliedChecksum = await this.getAppliedContractChecksum(client, schemaName);

      if (
        appliedChecksum !== contract.checksum ||
        missingTablesBeforeApply.length > 0
      ) {
        await client.query(this.renderContract(contract.sql, schemaName));
        const missingTablesAfterApply = await this.getMissingTenantTables(client, schemaName);

        if (missingTablesAfterApply.length > 0) {
          throw new Error(
            `Tenant schema contract incomplete for ${schemaName}: missing ${missingTablesAfterApply.join(", ")}`,
          );
        }

        await this.recordAppliedContract(client, schemaName, contract);
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async dropTenantSchema(schemaName: string) {
    const client = await this.pool.connect();

    try {
      await client.query(`DROP SCHEMA IF EXISTS ${this.quoteIdentifier(schemaName)} CASCADE`);
    } finally {
      client.release();
    }
  }

  quoteIdentifier(value: string) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  private quoteLiteral(value: string) {
    return `'${value.replaceAll("'", "''")}'`;
  }

  private qualify(schemaName: string, objectName: string) {
    return `${this.quoteIdentifier(schemaName)}.${this.quoteIdentifier(objectName)}`;
  }

  private async loadTenantSchemaContract(): Promise<TenantSchemaContract> {
    this.contractPromise ??= readFile(TENANT_SCHEMA_CONTRACT_PATH, "utf8").then((sql) => ({
      checksum: createHash("sha256").update(sql).digest("hex"),
      sql,
      version: TENANT_SCHEMA_CONTRACT_VERSION,
    }));

    return this.contractPromise;
  }

  private renderContract(contractSql: string, schemaName: string) {
    return contractSql
      .replaceAll("__SCHEMA_NAME__", this.quoteLiteral(schemaName))
      .replaceAll("__SCHEMA__", this.quoteIdentifier(schemaName));
  }

  private async ensureContractMetadataTable(client: PoolClient, schemaName: string) {
    await client.query(
      `CREATE TABLE IF NOT EXISTS ${this.qualify(schemaName, "_schema_contracts")} (
        contract_name VARCHAR(100) PRIMARY KEY,
        contract_version VARCHAR(50) NOT NULL,
        contract_checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    );
  }

  private async getAppliedContractChecksum(client: PoolClient, schemaName: string) {
    const result = await client.query<{ contract_checksum: string }>(
      `SELECT contract_checksum
       FROM ${this.qualify(schemaName, "_schema_contracts")}
       WHERE contract_name = $1
       LIMIT 1`,
      [TENANT_SCHEMA_CONTRACT_NAME],
    );

    return result.rows[0]?.contract_checksum ?? null;
  }

  private async getMissingTenantTables(client: PoolClient, schemaName: string) {
    const result = await client.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = $1
         AND table_name = ANY($2::text[])`,
      [schemaName, [...TENANT_TABLES]],
    );

    const existingTables = new Set(result.rows.map((row) => row.table_name));
    return TENANT_TABLES.filter((tableName) => !existingTables.has(tableName));
  }

  private async recordAppliedContract(
    client: PoolClient,
    schemaName: string,
    contract: TenantSchemaContract,
  ) {
    await client.query(
      `INSERT INTO ${this.qualify(schemaName, "_schema_contracts")} (
        contract_name,
        contract_version,
        contract_checksum,
        applied_at
      ) VALUES ($1, $2, $3, NOW())
      ON CONFLICT (contract_name)
      DO UPDATE SET
        contract_version = EXCLUDED.contract_version,
        contract_checksum = EXCLUDED.contract_checksum,
        applied_at = EXCLUDED.applied_at`,
      [TENANT_SCHEMA_CONTRACT_NAME, contract.version, contract.checksum],
    );
  }
}
