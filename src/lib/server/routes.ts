import type { AuthMode, Role } from "@/lib/session/types";

/**
 * Allowlist of upstream routes the BFF proxy may reach, transcribed from the
 * Afrikob Swagger v1 spec (docs/api/swagger-v1.json). Paths are relative to /api/v1/.
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Who a route belongs to:
 * - `platform`: Afrikob staff only (`admin/*`).
 * - `tenant-admin`: a tenant's own administrator (`tenant-admin/*`).
 * - `money`: payments and transactions, for anyone with tenant context.
 */
export type RouteScope = "platform" | "tenant-admin" | "money";

export interface RouteRule {
  method: HttpMethod;
  pattern: RegExp;
  scope: RouteScope;
  /** Response is a file download and must not be parsed as JSON. */
  binary?: boolean;
}

const SEG = "[A-Za-z0-9._~:@-]+";

const r = (method: HttpMethod, path: string, scope: RouteScope, options: { binary?: boolean } = {}): RouteRule => ({
  method,
  pattern: new RegExp(`^${path.replaceAll("{}", SEG)}$`),
  scope,
  binary: options.binary ?? false,
});

export const ROUTE_RULES: readonly RouteRule[] = [
  // Platform: tenants & credentials
  r("GET", "admin/tenants", "platform"),
  r("POST", "admin/tenants", "platform"),
  r("POST", "admin/tenants/{}/credentials", "platform"),
  r("GET", "admin/tenants/{}/fees", "platform"),
  r("POST", "admin/tenants/{}/fees", "platform"),
  r("DELETE", "admin/tenants/{}/fees/{}", "platform"),
  // Platform: refunds
  r("GET", "admin/refunds", "platform"),
  r("POST", "admin/refunds/{}/approve", "platform"),
  r("POST", "admin/refunds/{}/reject", "platform"),
  r("POST", "admin/refunds/{}/complete", "platform"),
  // Platform: wallets
  r("GET", "admin/wallets/{}", "platform"),
  r("POST", "admin/wallets/{}/topup", "platform"),
  // Platform: portal users
  r("GET", "admin/users", "platform"),
  r("POST", "admin/users", "platform"),
  r("GET", "admin/users/{}", "platform"),
  r("PATCH", "admin/users/{}", "platform"),
  r("POST", "admin/users/{}/activate", "platform"),
  r("POST", "admin/users/{}/deactivate", "platform"),
  r("POST", "admin/users/{}/set-password", "platform"),
  // Platform: reports (the non-list routes stream a file)
  r("GET", "admin/reports/collections", "platform", { binary: true }),
  r("GET", "admin/reports/collections/list", "platform"),
  r("GET", "admin/reports/disbursements", "platform", { binary: true }),
  r("GET", "admin/reports/disbursements/list", "platform"),
  // Platform: approval rules and the approvals inbox
  r("GET", "admin/approval-policies", "platform"),
  r("POST", "admin/approval-policies", "platform"),
  r("DELETE", "admin/approval-policies/{}", "platform"),
  r("GET", "admin/approvals", "platform"),
  r("GET", "admin/approvals/{}", "platform"),
  r("POST", "admin/approvals/{}/decide", "platform"),
  // Tenant administration, by the tenant's own admin
  r("GET", "tenant-admin/tenant", "tenant-admin"),
  r("GET", "tenant-admin/users", "tenant-admin"),
  r("POST", "tenant-admin/users", "tenant-admin"),
  r("GET", "tenant-admin/users/{}", "tenant-admin"),
  r("PATCH", "tenant-admin/users/{}", "tenant-admin"),
  r("POST", "tenant-admin/users/{}/activate", "tenant-admin"),
  r("POST", "tenant-admin/users/{}/deactivate", "tenant-admin"),
  r("POST", "tenant-admin/users/{}/set-password", "tenant-admin"),
  r("POST", "tenant-admin/wallets/topup-request", "tenant-admin"),
  r("GET", "tenant-admin/approvals", "tenant-admin"),
  r("GET", "tenant-admin/approvals/{}", "tenant-admin"),
  r("POST", "tenant-admin/approvals/{}/decide", "tenant-admin"),
  // Refunds & transactions
  r("POST", "payments/{}/refunds", "money"),
  r("GET", "payments/{}/refunds", "money"),
  r("GET", "payments/refunds/{}", "money"),
  r("GET", "transactions/{}", "money"),
  r("GET", "transactions", "money"),
  // Payments
  r("GET", "payments/get-all-telcos", "money"),
  r("GET", "payments/get-all-banks", "money"),
  r("POST", "payments/verify-name", "money"),
  r("POST", "payments/status-check", "money"),
  r("POST", "payments/disbursement", "money"),
  r("POST", "payments/collection", "money"),
  r("GET", "payments/disbursement-balance", "money"),
  r("GET", "payments/collection-balance", "money"),
  r("POST", "payments/bulk-name-verify", "money"),
  r("POST", "payments/bulk-disbursements", "money"),
  r("GET", "payments/bulk-disbursements", "money"),
  r("GET", "payments/bulk-disbursements/{}", "money"),
  r("POST", "payments/bulk-disbursements/{}/reconcile", "money"),
  r("POST", "payments/bulk-disbursement-status", "money"),
];

/** Headers the browser may forward to the upstream (lower-case). */
export const FORWARDED_HEADERS = ["idempotency-key", "clientbatchid"] as const;

/**
 * Whether a signed-in session may use a route.
 *
 * Money is the awkward one: the gateway answers 401 on `/payments` and
 * `/transactions` for a portal cookie session, whoever holds it. Only the
 * bearer token minted from a tenant's API key carries the context those
 * endpoints need, so the credential decides, not the role.
 */
export function mayUse(session: { role: Role; mode: AuthMode }, scope: RouteScope): boolean {
  if (scope === "platform") return session.role === "platform";
  if (scope === "tenant-admin") return session.role === "tenant-admin";
  return session.mode === "apikey";
}

/**
 * Finds the rule for a request. Literal routes such as `admin/reports/collections/list`
 * must not be captured by `{}`-style patterns, which the anchored regexes guarantee.
 */
export function matchRoute(method: string, path: string): RouteRule | null {
  if (path.includes("..") || path.includes("//")) return null;
  return ROUTE_RULES.find((rule) => rule.method === method && rule.pattern.test(path)) ?? null;
}
