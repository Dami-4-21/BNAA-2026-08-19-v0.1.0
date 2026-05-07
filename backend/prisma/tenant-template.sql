-- This SQL complements prisma/schema.prisma for the tenant template schema.
-- Runtime tenant provisioning should duplicate this shape into tenant_{tenantId}
-- and then rely on SET search_path per request.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION tenant_template.update_document_search()
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_document_search ON tenant_template.documents;

CREATE TRIGGER trig_document_search
BEFORE INSERT OR UPDATE ON tenant_template.documents
FOR EACH ROW
EXECUTE FUNCTION tenant_template.update_document_search();
