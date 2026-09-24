import { decodeJwt, type JWTPayload } from "jose";
import type { Role } from "./types";

const ROLE_CLAIM_KEYS = [
  "role",
  "roles",
  "scope",
  "scp",
  "http://schemas.microsoft.com/ws/2008/06/identity/claims/role",
] as const;
// The live gateway issues `tenant_code` (e.g. T001) rather than an id.
const TENANT_CLAIM_KEYS = ["tenantId", "tenant_id", "tid", "tenant", "TenantId", "tenant_code"] as const;
const LABEL_CLAIM_KEYS = [
  "name",
  "unique_name",
  "credentialName",
  "client_name",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
  "sub",
] as const;
const ADMIN_PATTERN = /\badmin\b/i;
/** Fallback lifetime if the upstream token carries no exp claim. */
const DEFAULT_TOKEN_TTL_SECONDS = 15 * 60;

export interface TokenInsights {
  roleHint: Role | null;
  tenantId: string | null;
  label: string;
  exp: number;
}

function asStrings(value: unknown): string[] {
  if (typeof value === "string") return value.split(/[\s,]+/).filter(Boolean);
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [];
}

function firstString(payload: JWTPayload, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

/**
 * Reads role/tenant/label hints from an upstream JWT without verifying it
 * (the gateway verifies its own tokens; we only use claims for UI routing).
 */
export function inspectToken(jwt: string, nowSeconds: number): TokenInsights {
  let payload: JWTPayload = {};
  try {
    payload = decodeJwt(jwt);
  } catch {
    // Opaque token: fall back to probing and defaults.
  }
  const roleValues = ROLE_CLAIM_KEYS.flatMap((k) => asStrings(payload[k]));
  const isAdminClaim = roleValues.some((r) => ADMIN_PATTERN.test(r)) || payload["is_admin"] === true;
  const tenantId = firstString(payload, TENANT_CLAIM_KEYS);
  let roleHint: Role | null = null;
  if (isAdminClaim) roleHint = "platform";
  else if (roleValues.length > 0) roleHint = "tenant";
  const exp = typeof payload.exp === "number" ? payload.exp : nowSeconds + DEFAULT_TOKEN_TTL_SECONDS;
  return {
    roleHint,
    tenantId,
    label: firstString(payload, LABEL_CLAIM_KEYS) ?? (tenantId ? `Tenant ${tenantId}` : "API client"),
    exp,
  };
}

/** Extracts the JWT string from a token endpoint response of unknown shape. */
export function extractToken(body: unknown): string | null {
  if (typeof body === "string") return body.split(".").length === 3 ? body : null;
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  for (const key of ["accessToken", "access_token", "token", "jwt", "bearerToken"]) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "data" in record ? extractToken(record.data) : null;
}
