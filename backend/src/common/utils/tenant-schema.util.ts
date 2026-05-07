export function buildTenantSchemaName(tenantId: string) {
  const compactTenantId = tenantId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return `tenant_${compactTenantId}`;
}

export function buildTenantSlug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
