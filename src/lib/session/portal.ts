import { z } from "zod";
import type { Role } from "./types";

/** PortalUserResponse from the gateway (Swagger: PortalUserResponseApiResponse.data). */
export const portalUserSchema = z
  .object({
    userId: z.string().nullish(),
    email: z.string().nullish(),
    displayName: z.string().nullish(),
    userType: z.string().nullish(),
    tenantId: z.string().nullish(),
    canMake: z.boolean().nullish(),
    canCheck: z.boolean().nullish(),
  })
  .loose();

export type PortalUser = z.infer<typeof portalUserSchema>;

export interface PortalIdentity {
  userId: string | null;
  role: Role;
  tenantId: string | null;
  label: string;
  canMake: boolean;
  canCheck: boolean;
}

/**
 * Maps a portal user onto the session. A user with no tenant is Afrikob staff;
 * a tenant-scoped one is an ordinary tenant user until a probe of
 * `tenant-admin/tenant` proves otherwise (the login response carries no admin
 * flag), which the caller applies with `withTenantAdmin`.
 */
export function toIdentity(user: PortalUser): PortalIdentity {
  return {
    userId: user.userId ?? null,
    role: user.tenantId ? "tenant" : "platform",
    tenantId: user.tenantId ?? null,
    label: user.displayName?.trim() || user.email?.trim() || "Portal user",
    canMake: user.canMake ?? true,
    canCheck: user.canCheck ?? true,
  };
}

/** Promotes a tenant user once the gateway confirms they administer the tenant. */
export function withTenantAdmin(identity: PortalIdentity, isTenantAdmin: boolean): PortalIdentity {
  return isTenantAdmin && identity.role === "tenant" ? { ...identity, role: "tenant-admin" } : identity;
}

/** Pulls the user object out of an envelope, or from the body itself. */
export function readPortalUser(body: unknown): PortalUser | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const candidate = "data" in record && record.data && typeof record.data === "object" ? record.data : record;
  const parsed = portalUserSchema.safeParse(candidate);
  if (!parsed.success) return null;
  const user = parsed.data;
  return user.userId || user.email || user.userType ? user : null;
}
