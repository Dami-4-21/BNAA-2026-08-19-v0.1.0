import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
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

@Injectable()
export class TenantDatabaseService {
  private readonly pool: Pool;

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

    try {
      await client.query("BEGIN");
      await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${this.quoteIdentifier(schemaName)}`);

      for (const tableName of TENANT_TABLES) {
        await client.query(
          `CREATE TABLE IF NOT EXISTS ${this.qualify(schemaName, tableName)} (LIKE tenant_template.${this.quoteIdentifier(tableName)} INCLUDING ALL)`,
        );
      }

      await client.query(
        `ALTER TABLE ${this.qualify(schemaName, "project_members")}
          DROP CONSTRAINT IF EXISTS project_members_project_id_fkey,
          ADD CONSTRAINT project_members_project_id_fkey
          FOREIGN KEY (project_id) REFERENCES ${this.qualify(schemaName, "projects")}(id) ON DELETE CASCADE`,
      );
      await client.query(
        `ALTER TABLE ${this.qualify(schemaName, "daily_reports")}
          DROP CONSTRAINT IF EXISTS daily_reports_project_id_fkey,
          ADD CONSTRAINT daily_reports_project_id_fkey
          FOREIGN KEY (project_id) REFERENCES ${this.qualify(schemaName, "projects")}(id)`,
      );
      await client.query(
        `ALTER TABLE ${this.qualify(schemaName, "photos")}
          DROP CONSTRAINT IF EXISTS photos_project_id_fkey,
          ADD CONSTRAINT photos_project_id_fkey
          FOREIGN KEY (project_id) REFERENCES ${this.qualify(schemaName, "projects")}(id),
          DROP CONSTRAINT IF EXISTS photos_report_id_fkey,
          ADD CONSTRAINT photos_report_id_fkey
          FOREIGN KEY (report_id) REFERENCES ${this.qualify(schemaName, "daily_reports")}(id)`,
      );
      await client.query(
        `ALTER TABLE ${this.qualify(schemaName, "ncr")}
          DROP CONSTRAINT IF EXISTS ncr_project_id_fkey,
          ADD CONSTRAINT ncr_project_id_fkey
          FOREIGN KEY (project_id) REFERENCES ${this.qualify(schemaName, "projects")}(id)`,
      );
      await client.query(
        `ALTER TABLE ${this.qualify(schemaName, "ncr_photos")}
          DROP CONSTRAINT IF EXISTS ncr_photos_ncr_id_fkey,
          ADD CONSTRAINT ncr_photos_ncr_id_fkey
          FOREIGN KEY (ncr_id) REFERENCES ${this.qualify(schemaName, "ncr")}(id)`,
      );
      await client.query(
        `ALTER TABLE ${this.qualify(schemaName, "documents")}
          DROP CONSTRAINT IF EXISTS documents_project_id_fkey,
          ADD CONSTRAINT documents_project_id_fkey
          FOREIGN KEY (project_id) REFERENCES ${this.qualify(schemaName, "projects")}(id)`,
      );
      await client.query(
        `ALTER TABLE ${this.qualify(schemaName, "document_versions")}
          DROP CONSTRAINT IF EXISTS document_versions_document_id_fkey,
          ADD CONSTRAINT document_versions_document_id_fkey
          FOREIGN KEY (document_id) REFERENCES ${this.qualify(schemaName, "documents")}(id)`,
      );
      await client.query(
        `ALTER TABLE ${this.qualify(schemaName, "document_distributions")}
          DROP CONSTRAINT IF EXISTS document_distributions_document_id_fkey,
          ADD CONSTRAINT document_distributions_document_id_fkey
          FOREIGN KEY (document_id) REFERENCES ${this.qualify(schemaName, "documents")}(id),
          DROP CONSTRAINT IF EXISTS document_distributions_version_id_fkey,
          ADD CONSTRAINT document_distributions_version_id_fkey
          FOREIGN KEY (version_id) REFERENCES ${this.qualify(schemaName, "document_versions")}(id)`,
      );
      await client.query(
        `ALTER TABLE ${this.qualify(schemaName, "statements")}
          DROP CONSTRAINT IF EXISTS statements_project_id_fkey,
          ADD CONSTRAINT statements_project_id_fkey
          FOREIGN KEY (project_id) REFERENCES ${this.qualify(schemaName, "projects")}(id)`,
      );
      await client.query(
        `ALTER TABLE ${this.qualify(schemaName, "invoices")}
          DROP CONSTRAINT IF EXISTS invoices_project_id_fkey,
          ADD CONSTRAINT invoices_project_id_fkey
          FOREIGN KEY (project_id) REFERENCES ${this.qualify(schemaName, "projects")}(id),
          DROP CONSTRAINT IF EXISTS invoices_statement_id_fkey,
          ADD CONSTRAINT invoices_statement_id_fkey
          FOREIGN KEY (statement_id) REFERENCES ${this.qualify(schemaName, "statements")}(id)`,
      );
      await client.query(
        `ALTER TABLE ${this.qualify(schemaName, "payments")}
          DROP CONSTRAINT IF EXISTS payments_invoice_id_fkey,
          ADD CONSTRAINT payments_invoice_id_fkey
          FOREIGN KEY (invoice_id) REFERENCES ${this.qualify(schemaName, "invoices")}(id)`,
      );
      await client.query(
        `ALTER TABLE ${this.qualify(schemaName, "notifications")}
          DROP CONSTRAINT IF EXISTS notifications_project_id_fkey,
          ADD CONSTRAINT notifications_project_id_fkey
          FOREIGN KEY (project_id) REFERENCES ${this.qualify(schemaName, "projects")}(id)`,
      );

      await client.query(
        `CREATE OR REPLACE FUNCTION ${this.qualify(schemaName, "update_document_search")}()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.search_vector :=
            to_tsvector(
              'french',
              COALESCE(NEW.name, '') || ' ' ||
              COALESCE(NEW.doc_type::text, '') || ' ' ||
              COALESCE(NEW.phase::text, '')
            );
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql`,
      );

      await client.query(
        `DROP TRIGGER IF EXISTS trig_document_search ON ${this.qualify(schemaName, "documents")}`,
      );
      await client.query(
        `CREATE TRIGGER trig_document_search
          BEFORE INSERT OR UPDATE ON ${this.qualify(schemaName, "documents")}
          FOR EACH ROW
          EXECUTE FUNCTION ${this.qualify(schemaName, "update_document_search")}()`,
      );

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

  private qualify(schemaName: string, objectName: string) {
    return `${this.quoteIdentifier(schemaName)}.${this.quoteIdentifier(objectName)}`;
  }
}
