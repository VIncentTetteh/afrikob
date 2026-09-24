import { describe, expect, it } from "vitest";
import { matchRoute, roleMayUse, ROUTE_RULES } from "@/lib/server/routes";

describe("route allowlist", () => {
  it("covers every non-auth spec operation", () => {
    expect(ROUTE_RULES).toHaveLength(60);
  });

  it.each([
    ["GET", "admin/tenants", "platform"],
    ["POST", "admin/refunds/abc-1/approve", "platform"],
    ["DELETE", "admin/tenants/t1/fees/COLLECTION", "platform"],
    ["GET", "payments/get-all-banks", "money"],
    ["GET", "admin/users", "platform"],
    ["PATCH", "admin/users/u1", "platform"],
    ["POST", "admin/users/u1/set-password", "platform"],
    ["GET", "admin/reports/collections/list", "platform"],
    ["GET", "payments/collection-balance", "money"],
    ["POST", "payments/TX-1/refunds", "money"],
    ["GET", "transactions", "money"],
    ["POST", "payments/bulk-disbursements/B1/reconcile", "money"],
  ])("%s %s belongs to %s", (method, path, scope) => {
    expect(matchRoute(method, path)?.scope).toBe(scope);
  });

  it("does not let a parameterised pattern capture literal routes with the wrong method", () => {
    expect(matchRoute("POST", "payments/get-all-banks")).toBeNull();
    expect(matchRoute("GET", "payments/get-all-banks")?.pattern.source).toContain("get-all-banks");
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
  ])("rejects %s %s", (method, path) => {
    expect(matchRoute(method, path)).toBeNull();
  });

  it("lets each role reach only its own area", () => {
    expect(roleMayUse("platform", "platform")).toBe(true);
    expect(roleMayUse("tenant-admin", "platform")).toBe(false);
    expect(roleMayUse("tenant", "platform")).toBe(false);

    expect(roleMayUse("tenant-admin", "tenant-admin")).toBe(true);
    expect(roleMayUse("tenant", "tenant-admin")).toBe(false);
    expect(roleMayUse("platform", "tenant-admin")).toBe(false);

    // Money needs tenant context, which Afrikob staff do not have.
    expect(roleMayUse("tenant", "money")).toBe(true);
    expect(roleMayUse("tenant-admin", "money")).toBe(true);
    expect(roleMayUse("platform", "money")).toBe(false);
  });

  it("flags report downloads as binary, but not the table variants", () => {
    expect(matchRoute("GET", "admin/reports/collections")?.binary).toBe(true);
    expect(matchRoute("GET", "admin/reports/disbursements")?.binary).toBe(true);
    expect(matchRoute("GET", "admin/reports/collections/list")?.binary).toBe(false);
  });
});
