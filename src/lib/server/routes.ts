import type { z } from "zod";
import * as Req from "@/lib/api/schemas/requests";
import { handlesMoney, type Role } from "@/lib/session/types";

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
  /**
   * Request body schema for a write. The proxy re-validates the body with it and
   * forwards only the parsed result: browser validation can be bypassed, this
   * cannot. A write without one is sent with no body at all.
   */
  body?: z.ZodType;
}

const SEG = "[A-Za-z0-9._~:@-]+";

const r = (
  method: HttpMethod,
  path: string,
  scope: RouteScope,
  options: { binary?: boolean; body?: z.ZodType } = {},
): RouteRule => ({
  method,
  pattern: new RegExp(`^${path.replaceAll("{}", SEG)}$`),
  scope,
  binary: options.binary ?? false,
  body: options.body,
});

export const ROUTE_RULES: readonly RouteRule[] = [
  // Platform: tenants & credentials
  r("GET", "admin/tenants", "platform"),
  r("POST", "admin/tenants", "platform", { body: Req.createTenantSchema }),
  r("POST", "admin/tenants/{}/credentials", "platform", { body: Req.issueCredentialSchema }),
  r("GET", "admin/tenants/{}/fees", "platform"),
  r("POST", "admin/tenants/{}/fees", "platform", { body: Req.upsertFeeSchema }),
  r("DELETE", "admin/tenants/{}/fees/{}", "platform"),
  // Platform: refunds
  r("GET", "admin/refunds", "platform"),
  r("POST", "admin/refunds/{}/approve", "platform"),
  r("POST", "admin/refunds/{}/reject", "platform", { body: Req.rejectRefundSchema }),
  r("POST", "admin/refunds/{}/complete", "platform", { body: Req.completeRefundSchema }),
  // Platform: wallets
  r("GET", "admin/wallets/{}", "platform"),
  r("POST", "admin/wallets/{}/topup", "platform", { body: Req.topUpSchema }),
  // Platform: portal users
  r("GET", "admin/users", "platform"),
  r("POST", "admin/users", "platform", { body: Req.createPortalUserSchema }),
  r("GET", "admin/users/{}", "platform"),
  r("PATCH", "admin/users/{}", "platform", { body: Req.updatePortalUserSchema }),
  r("POST", "admin/users/{}/activate", "platform"),
  r("POST", "admin/users/{}/deactivate", "platform"),
  r("POST", "admin/users/{}/set-password", "platform", { body: Req.adminSetPasswordSchema }),
  // Platform: reports (the non-list routes stream a file)
  r("GET", "admin/reports/collections", "platform", { binary: true }),
  r("GET", "admin/reports/collections/list", "platform"),
  r("GET", "admin/reports/disbursements", "platform", { binary: true }),
  r("GET", "admin/reports/disbursements/list", "platform"),
  // Platform: approval rules and the approvals inbox
  r("GET", "admin/approval-policies", "platform"),
  r("POST", "admin/approval-policies", "platform", { body: Req.upsertApprovalPolicySchema }),
  r("DELETE", "admin/approval-policies/{}", "platform"),
  r("GET", "admin/approvals", "platform"),
  r("GET", "admin/approvals/{}", "platform"),
  r("POST", "admin/approvals/{}/decide", "platform", { body: Req.decideApprovalSchema }),
  // Tenant administration, by the tenant's own admin
  r("GET", "tenant-admin/tenant", "tenant-admin"),
  r("GET", "tenant-admin/users", "tenant-admin"),
  r("POST", "tenant-admin/users", "tenant-admin", { body: Req.createTenantScopedUserSchema }),
  r("GET", "tenant-admin/users/{}", "tenant-admin"),
  r("PATCH", "tenant-admin/users/{}", "tenant-admin", { body: Req.updateTenantScopedUserSchema }),
  r("POST", "tenant-admin/users/{}/activate", "tenant-admin"),
  r("POST", "tenant-admin/users/{}/deactivate", "tenant-admin"),
  r("POST", "tenant-admin/users/{}/set-password", "tenant-admin", { body: Req.adminSetPasswordSchema }),
  r("POST", "tenant-admin/wallets/topup-request", "tenant-admin", { body: Req.topUpSchema }),
  r("GET", "tenant-admin/approvals", "tenant-admin"),
  r("GET", "tenant-admin/approvals/{}", "tenant-admin"),
  r("POST", "tenant-admin/approvals/{}/decide", "tenant-admin", { body: Req.decideApprovalSchema }),
  // A tenant's money, on their portal session. The unprefixed `payments/*` and
  // `transactions*` are for API-key integrations and are never proxied (ADR-0004).
  r("GET", "tenant/transactions/{}", "money"),
  r("GET", "tenant/transactions", "money"),
  r("GET", "tenant/payments/get-all-telcos", "money"),
  r("GET", "tenant/payments/get-all-banks", "money"),
  r("POST", "tenant/payments/verify-name", "money", { body: Req.nameVerifySchema }),
  r("POST", "tenant/payments/status-check", "money", { body: Req.statusCheckSchema }),
  r("POST", "tenant/payments/disbursement", "money", { body: Req.disbursementSchema }),
  r("POST", "tenant/payments/collection", "money", { body: Req.collectionSchema }),
  r("GET", "tenant/payments/disbursement-balance", "money"),
  r("GET", "tenant/payments/collection-balance", "money"),
  r("POST", "tenant/payments/bulk-name-verify", "money", { body: Req.bulkNameVerifySchema }),
  r("POST", "tenant/payments/bulk-disbursements", "money", { body: Req.bulkDisbursementSchema }),
  r("GET", "tenant/payments/bulk-disbursements", "money"),
  r("GET", "tenant/payments/bulk-disbursements/{}", "money"),
  r("POST", "tenant/payments/bulk-disbursements/{}/reconcile", "money"),
  r("POST", "tenant/payments/bulk-disbursement-status", "money", { body: Req.bulkStatusSchema }),
];

/** Headers the browser may forward to the upstream (lower-case). */
export const FORWARDED_HEADERS = ["idempotency-key", "clientbatchid"] as const;

/**
 * Whether a signed-in role may use a route. Money routes need tenant context,
 * which a tenant's portal session carries and a staff session does not.
 */
export function mayUse(role: Role, scope: RouteScope): boolean {
  if (scope === "platform") return role === "platform";
  if (scope === "tenant-admin") return role === "tenant-admin";
  return handlesMoney(role);
}

/**
 * Finds the rule for a request. Literal routes such as `admin/reports/collections/list`
 * must not be captured by `{}`-style patterns, which the anchored regexes guarantee.
 */
export function matchRoute(method: string, path: string): RouteRule | null {
  if (path.includes("..") || path.includes("//")) return null;
  return ROUTE_RULES.find((rule) => rule.method === method && rule.pattern.test(path)) ?? null;
}
