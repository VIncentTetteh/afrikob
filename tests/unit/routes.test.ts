import { describe, expect, it } from "vitest";
import { matchRoute, mayUse, ROUTE_RULES } from "@/lib/server/routes";

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
    const portal = (role: "platform" | "tenant-admin" | "tenant") => ({ role, mode: "portal" as const });
    const key = { role: "tenant" as const, mode: "apikey" as const };

    expect(mayUse(portal("platform"), "platform")).toBe(true);
    expect(mayUse(portal("tenant-admin"), "platform")).toBe(false);
    expect(mayUse(key, "platform")).toBe(false);

    expect(mayUse(portal("tenant-admin"), "tenant-admin")).toBe(true);
    expect(mayUse(portal("tenant"), "tenant-admin")).toBe(false);
    expect(mayUse(portal("platform"), "tenant-admin")).toBe(false);
  });

  it("allows money only to an API-key session", () => {
    // Verified live: the gateway answers 401 on /payments and /transactions for
    // a password session, whoever holds it.
    expect(mayUse({ role: "tenant", mode: "apikey" }, "money")).toBe(true);
    expect(mayUse({ role: "tenant", mode: "portal" }, "money")).toBe(false);
    expect(mayUse({ role: "tenant-admin", mode: "portal" }, "money")).toBe(false);
    expect(mayUse({ role: "platform", mode: "portal" }, "money")).toBe(false);
  });

  it("flags report downloads as binary, but not the table variants", () => {
    expect(matchRoute("GET", "admin/reports/collections")?.binary).toBe(true);
    expect(matchRoute("GET", "admin/reports/disbursements")?.binary).toBe(true);
    expect(matchRoute("GET", "admin/reports/collections/list")?.binary).toBe(false);
  });
});
