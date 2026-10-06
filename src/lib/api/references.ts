import type { PortalUser, Tenant } from "./schemas/models";

/** Resolve gateway foreign keys to labels suitable for tables and detail views. */
export function tenantLabel(tenantId: string | null | undefined, tenants: readonly Tenant[]): string {
  if (!tenantId) return "Afrikob";
  const tenant = tenants.find((item) => item.id === tenantId || item.code === tenantId);
  return tenant?.displayName ?? tenant?.code ?? tenantId;
}

export function personLabel(userId: string | null | undefined, users: readonly PortalUser[]): string {
  if (!userId) return "N/A";
  const person = users.find((item) => item.id === userId || item.email === userId);
  return person?.displayName ?? person?.email ?? userId;
}
