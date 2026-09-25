import { describe, expect, it } from "vitest";
import { matchRoute, mayUse, ROUTE_RULES } from "@/lib/server/routes";

describe("route allowlist", () => {
  it("covers the staff, tenant-admin and tenant portal operations", () => {
    // 41 staff and tenant-admin rules, plus the 16 tenant/ money copies.
    expect(ROUTE_RULES).toHaveLength(57);
  });

  it.each([
    ["GET", "admin/tenants", "platform"],
    ["POST", "admin/refunds/abc-1/approve", "platform"],
    ["DELETE", "admin/tenants/t1/fees/COLLECTION", "platform"],
    ["GET", "admin/users", "platform"],
    ["PATCH", "admin/users/u1", "platform"],
    ["POST", "admin/users/u1/set-password", "platform"],
    ["GET", "admin/reports/collections/list", "platform"],
    ["GET", "tenant-admin/tenant", "tenant-admin"],
    ["POST", "tenant-admin/wallets/topup-request", "tenant-admin"],
    ["GET", "tenant/payments/get-all-banks", "money"],
    ["GET", "tenant/payments/collection-balance", "money"],
    ["GET", "tenant/transactions", "money"],
    ["GET", "tenant/transactions/TX-1", "money"],
    ["POST", "tenant/payments/bulk-disbursements/B1/reconcile", "money"],
  ])("%s %s belongs to %s", (method, path, scope) => {
    expect(matchRoute(method, path)?.scope).toBe(scope);
  });

  it("does not let a parameterised pattern capture literal routes with the wrong method", () => {
    expect(matchRoute("POST", "admin/tenants/t1/fees/COLLECTION")).toBeNull();
    expect(matchRoute("GET", "admin/reports/collections/list")?.pattern.source).toContain("list");
  });

  it.each([
    ["GET", "auth/token"],
    ["GET", "admin/tenants/../secrets"],
    ["GET", "admin//tenants"],
    ["PUT", "admin/tenants"],
    ["GET", "admin/tenants/x/y/z"],
    ["GET", "internal/metrics"],
    ["GET", "tenant-admin/wallets"],
    ["POST", "payments/checkout"],
    ["POST", "payments/disbursement-status"],
    ["POST", "portal/auth/login"],
    ["POST", "portal/auth/verify-login-code"],
    // Integration-only: the gateway serves these to an API key, not a portal session.
    ["GET", "transactions"],
    ["GET", "payments/collection-balance"],
    ["POST", "payments/disbursement"],
    // No tenant/ refunds on the gateway yet.
    ["POST", "payments/TX-1/refunds"],
    ["POST", "tenant/payments/TX-1/refunds"],
  ])("rejects %s %s", (method, path) => {
    expect(matchRoute(method, path)).toBeNull();
  });

  it("lets each role reach only its own area", () => {
    expect(mayUse("platform", "platform")).toBe(true);
    expect(mayUse("tenant-admin", "platform")).toBe(false);
    expect(mayUse("tenant", "platform")).toBe(false);

    expect(mayUse("tenant-admin", "tenant-admin")).toBe(true);
    expect(mayUse("tenant", "tenant-admin")).toBe(false);
    expect(mayUse("platform", "tenant-admin")).toBe(false);
  });

  it("gives money to anyone with tenant context, and not to staff", () => {
    expect(mayUse("tenant", "money")).toBe(true);
    expect(mayUse("tenant-admin", "money")).toBe(true);
    // Staff have no tenant; they read movements through admin reports.
    expect(mayUse("platform", "money")).toBe(false);
  });

  it("flags report downloads as binary, but not the table variants", () => {
    expect(matchRoute("GET", "admin/reports/collections")?.binary).toBe(true);
    expect(matchRoute("GET", "admin/reports/disbursements")?.binary).toBe(true);
    expect(matchRoute("GET", "admin/reports/collections/list")?.binary).toBe(false);
  });
});
