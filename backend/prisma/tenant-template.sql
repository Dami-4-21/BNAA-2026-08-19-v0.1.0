-- BnaaSaaS tenant schema contract.
-- This file is the migration-driven baseline applied to each tenant schema.
-- Placeholders:
--   __SCHEMA__      => quoted schema identifier, ex: "tenant_xxx"
--   __SCHEMA_NAME__ => schema name string literal, ex: 'tenant_xxx'

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ProjectStatus'
      AND n.nspname = __SCHEMA_NAME__
  ) THEN
    EXECUTE 'CREATE TYPE __SCHEMA__."ProjectStatus" AS ENUM (''active'', ''configuration'', ''closed'')';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'DailyReportStatus'
      AND n.nspname = __SCHEMA_NAME__
  ) THEN
    EXECUTE 'CREATE TYPE __SCHEMA__."DailyReportStatus" AS ENUM (''draft'', ''pending_signature'', ''signed'')';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'WeatherCode'
      AND n.nspname = __SCHEMA_NAME__
  ) THEN
    EXECUTE 'CREATE TYPE __SCHEMA__."WeatherCode" AS ENUM (''sunny'', ''cloudy'', ''rain'', ''strong_wind'')';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'NcrSeverity'
      AND n.nspname = __SCHEMA_NAME__
  ) THEN
    EXECUTE 'CREATE TYPE __SCHEMA__."NcrSeverity" AS ENUM (''low'', ''medium'', ''high'')';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'NcrStatus'
      AND n.nspname = __SCHEMA_NAME__
  ) THEN
    EXECUTE 'CREATE TYPE __SCHEMA__."NcrStatus" AS ENUM (''open'', ''in_progress'', ''closed'')';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'DocumentStatus'
      AND n.nspname = __SCHEMA_NAME__
  ) THEN
    EXECUTE 'CREATE TYPE __SCHEMA__."DocumentStatus" AS ENUM (''active'', ''obsolete'')';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'DocumentPhase'
      AND n.nspname = __SCHEMA_NAME__
  ) THEN
    EXECUTE 'CREATE TYPE __SCHEMA__."DocumentPhase" AS ENUM (''APS'', ''APD'', ''EXE'', ''DOE'')';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'DocumentType'
      AND n.nspname = __SCHEMA_NAME__
  ) THEN
    EXECUTE 'CREATE TYPE __SCHEMA__."DocumentType" AS ENUM (''plan'', ''spec'', ''calculation'', ''report'', ''other'')';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'DocumentVersionStatus'
      AND n.nspname = __SCHEMA_NAME__
  ) THEN
    EXECUTE 'CREATE TYPE __SCHEMA__."DocumentVersionStatus" AS ENUM (''pending'', ''active'')';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'StatementStatus'
      AND n.nspname = __SCHEMA_NAME__
  ) THEN
    EXECUTE 'CREATE TYPE __SCHEMA__."StatementStatus" AS ENUM (''draft'', ''pending_validation'', ''validated'')';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'InvoiceStatus'
      AND n.nspname = __SCHEMA_NAME__
  ) THEN
    EXECUTE 'CREATE TYPE __SCHEMA__."InvoiceStatus" AS ENUM (''issued'', ''partially_paid'', ''paid'', ''overdue'', ''litigious'')';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS __SCHEMA__.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50),
  status __SCHEMA__."ProjectStatus" NOT NULL DEFAULT 'active',
  governorate VARCHAR(100),
  city VARCHAR(100),
  gps_lat NUMERIC(10,7),
  gps_lng NUMERIC(10,7),
  contract_amount_ht NUMERIC(15,3),
  start_date DATE,
  end_date DATE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS __SCHEMA__.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES __SCHEMA__.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role VARCHAR(20) NOT NULL,
  added_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

CREATE TABLE IF NOT EXISTS __SCHEMA__.daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES __SCHEMA__.projects(id),
  report_date DATE NOT NULL,
  weather __SCHEMA__."WeatherCode",
  workforce_count INTEGER NOT NULL DEFAULT 0,
  workforce_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  progress_by_lot JSONB NOT NULL DEFAULT '[]'::jsonb,
  activities TEXT,
  incidents JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  status __SCHEMA__."DailyReportStatus" NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL,
  signed_by UUID,
  signed_at TIMESTAMP,
  pdf_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, report_date)
);

CREATE TABLE IF NOT EXISTS __SCHEMA__.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES __SCHEMA__.daily_reports(id),
  project_id UUID NOT NULL REFERENCES __SCHEMA__.projects(id),
  file_url TEXT NOT NULL,
  file_key TEXT NOT NULL,
  thumbnail_url TEXT,
  gps_lat NUMERIC(10,7),
  gps_lng NUMERIC(10,7),
  location_label VARCHAR(255),
  task_tag VARCHAR(255),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  uploaded_by UUID NOT NULL,
  taken_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS __SCHEMA__.ncr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES __SCHEMA__.projects(id),
  reference VARCHAR(30),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  severity __SCHEMA__."NcrSeverity" NOT NULL DEFAULT 'medium',
  status __SCHEMA__."NcrStatus" NOT NULL DEFAULT 'open',
  assigned_to UUID,
  deadline DATE,
  evidence_url TEXT,
  created_by UUID NOT NULL,
  closed_by UUID,
  closed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS __SCHEMA__.ncr_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ncr_id UUID NOT NULL REFERENCES __SCHEMA__.ncr(id),
  file_url TEXT NOT NULL,
  file_key TEXT NOT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS __SCHEMA__.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES __SCHEMA__.projects(id),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100),
  lot VARCHAR(120),
  discipline VARCHAR(120),
  zone VARCHAR(120),
  phase __SCHEMA__."DocumentPhase",
  doc_type __SCHEMA__."DocumentType",
  source_module VARCHAR(50),
  source_record_id VARCHAR(120),
  parent_document_id UUID,
  hub_type VARCHAR(50),
  priority VARCHAR(20),
  visibility_scope JSONB NOT NULL DEFAULT '[]'::jsonb,
  offline_ready BOOLEAN NOT NULL DEFAULT false,
  last_distributed_at TIMESTAMP,
  storage_mode VARCHAR(40) NOT NULL DEFAULT 'managed',
  status __SCHEMA__."DocumentStatus" NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  search_vector tsvector
);

CREATE TABLE IF NOT EXISTS __SCHEMA__.document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES __SCHEMA__.documents(id),
  version_label VARCHAR(20) NOT NULL,
  file_url TEXT NOT NULL,
  file_key TEXT NOT NULL,
  file_name VARCHAR(255),
  file_size_mb NUMERIC(8,2),
  file_type VARCHAR(10),
  mime_type VARCHAR(120),
  version_note TEXT,
  is_current BOOLEAN NOT NULL DEFAULT true,
  status __SCHEMA__."DocumentVersionStatus" NOT NULL DEFAULT 'active',
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS __SCHEMA__.document_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES __SCHEMA__.documents(id),
  version_id UUID NOT NULL REFERENCES __SCHEMA__.document_versions(id),
  recipient_id UUID NOT NULL,
  audience VARCHAR(255),
  note TEXT,
  sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
  read_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS __SCHEMA__.statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES __SCHEMA__.projects(id),
  period_month DATE NOT NULL,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal_ht NUMERIC(15,3) NOT NULL DEFAULT 0,
  retention_pct NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  retention_amount NUMERIC(15,3) NOT NULL DEFAULT 0,
  advance_deduction NUMERIC(15,3) NOT NULL DEFAULT 0,
  net_payable_ht NUMERIC(15,3) NOT NULL DEFAULT 0,
  status __SCHEMA__."StatementStatus" NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL,
  validated_by UUID,
  validated_at TIMESTAMP,
  rejection_note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, period_month)
);

CREATE TABLE IF NOT EXISTS __SCHEMA__.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES __SCHEMA__.projects(id),
  statement_id UUID REFERENCES __SCHEMA__.statements(id),
  invoice_number VARCHAR(20) NOT NULL UNIQUE,
  period_month DATE NOT NULL,
  amount_ht NUMERIC(15,3) NOT NULL,
  tva_rate NUMERIC(5,2) NOT NULL DEFAULT 19.00,
  tva_amount NUMERIC(15,3) NOT NULL,
  amount_ttc NUMERIC(15,3) NOT NULL,
  amount_paid NUMERIC(15,3) NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  status __SCHEMA__."InvoiceStatus" NOT NULL DEFAULT 'issued',
  pdf_url TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS __SCHEMA__.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES __SCHEMA__.invoices(id),
  amount NUMERIC(15,3) NOT NULL,
  payment_date DATE NOT NULL,
  bank_reference VARCHAR(255),
  notes TEXT,
  recorded_by UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS __SCHEMA__.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID REFERENCES __SCHEMA__.projects(id),
  type VARCHAR(60) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE __SCHEMA__.daily_reports
  ADD COLUMN IF NOT EXISTS progress_by_lot JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE __SCHEMA__.ncr
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

ALTER TABLE __SCHEMA__.documents
  ADD COLUMN IF NOT EXISTS code VARCHAR(100),
  ADD COLUMN IF NOT EXISTS lot VARCHAR(120),
  ADD COLUMN IF NOT EXISTS discipline VARCHAR(120),
  ADD COLUMN IF NOT EXISTS zone VARCHAR(120),
  ADD COLUMN IF NOT EXISTS source_module VARCHAR(50),
  ADD COLUMN IF NOT EXISTS source_record_id VARCHAR(120),
  ADD COLUMN IF NOT EXISTS parent_document_id UUID,
  ADD COLUMN IF NOT EXISTS hub_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20),
  ADD COLUMN IF NOT EXISTS visibility_scope JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS offline_ready BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_distributed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS storage_mode VARCHAR(40) NOT NULL DEFAULT 'managed';

ALTER TABLE __SCHEMA__.document_versions
  ADD COLUMN IF NOT EXISTS file_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(120);

ALTER TABLE __SCHEMA__.document_distributions
  ADD COLUMN IF NOT EXISTS audience VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_reports_project_date
  ON __SCHEMA__.daily_reports(project_id, report_date DESC);

CREATE INDEX IF NOT EXISTS idx_photos_project
  ON __SCHEMA__.photos(project_id, taken_at DESC);

CREATE INDEX IF NOT EXISTS idx_photos_report
  ON __SCHEMA__.photos(report_id);

CREATE INDEX IF NOT EXISTS idx_docs_project
  ON __SCHEMA__.documents(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_docs_source
  ON __SCHEMA__.documents(project_id, source_module, source_record_id);

CREATE INDEX IF NOT EXISTS idx_docs_fts
  ON __SCHEMA__.documents USING GIN(search_vector);

CREATE INDEX IF NOT EXISTS idx_versions_document
  ON __SCHEMA__.document_versions(document_id, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifs_user
  ON __SCHEMA__.notifications(user_id, created_at DESC, is_read);

CREATE OR REPLACE FUNCTION __SCHEMA__.update_document_search()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    to_tsvector(
      'french',
      COALESCE(NEW.name, '') || ' ' ||
      COALESCE(NEW.code, '') || ' ' ||
      COALESCE(NEW.lot, '') || ' ' ||
      COALESCE(NEW.discipline, '') || ' ' ||
      COALESCE(NEW.hub_type, '') || ' ' ||
      COALESCE(NEW.doc_type::text, '') || ' ' ||
      COALESCE(NEW.phase::text, '')
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_document_search ON __SCHEMA__.documents;

CREATE TRIGGER trig_document_search
BEFORE INSERT OR UPDATE ON __SCHEMA__.documents
FOR EACH ROW
EXECUTE FUNCTION __SCHEMA__.update_document_search();
