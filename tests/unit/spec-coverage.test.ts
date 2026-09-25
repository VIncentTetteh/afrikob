// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { matchRoute, ROUTE_RULES } from "@/lib/server/routes";

/**
 * Guards the app against the gateway's spec moving underneath it: every
 * operation must be reachable, and every rule must still exist upstream.
 */
const spec = JSON.parse(readFileSync(path.join(process.cwd(), "docs/api/swagger-v1.json"), "utf8")) as {
  paths: Record<string, Record<string, unknown>>;
};

/** Handled by our own auth routes rather than the generic proxy. */
const AUTH_ROUTES = new Set([
  "auth/token",
  "portal/auth/login",
  "portal/auth/logout",
  "portal/auth/verify-login-code",
  "portal/auth/forgot-password",
  "portal/auth/verify-code",
  "portal/auth/reset-password",
]);

/**
 * The unprefixed money endpoints answer only an API-key bearer token, so they
 * belong to a tenant's own integration; the portal uses the `tenant/` copies and
 * must never proxy these (ADR-0004).
 */
const isIntegrationOnly = (p: string) => p === "transactions" || p.startsWith("transactions/") || p.startsWith("payments/");

interface Operation {
  method: string;
  path: string;
}

const operations: Operation[] = Object.entries(spec.paths).flatMap(([route, methods]) =>
  Object.keys(methods).map((method) => ({
    method: method.toUpperCase(),
    // {tenantId} → a sample value, so the rule's pattern can be matched.
    path: route.replace(/^\/api\/v1\//, "").replace(/\{[^}]+\}/g, "sample-id"),
  })),
);

describe("gateway spec coverage", () => {
  it("finds operations in the snapshot", () => {
    expect(operations.length).toBeGreaterThan(40);
  });

  it.each(operations.map((o) => [`${o.method} ${o.path}`, o] as const))("%s is implemented", (_label, operation) => {
    const handled =
      AUTH_ROUTES.has(operation.path) ||
      isIntegrationOnly(operation.path) ||
      matchRoute(operation.method, operation.path) !== null;
    expect(handled, `${operation.method} /api/v1/${operation.path} is in the spec but not implemented`).toBe(true);
  });

  it("never proxies an integration-only endpoint", () => {
    const proxied = operations.filter((o) => isIntegrationOnly(o.path) && matchRoute(o.method, o.path) !== null);
    expect(proxied.map((o) => `${o.method} ${o.path}`)).toEqual([]);
  });

  it("gives the portal a tenant/ copy of every integration money endpoint except refunds", () => {
    const missing = operations
      .filter((o) => isIntegrationOnly(o.path) && !o.path.includes("refunds"))
      .filter((o) => matchRoute(o.method, `tenant/${o.path}`) === null)
      .map((o) => `${o.method} tenant/${o.path}`);
    expect(missing).toEqual([]);
  });

  it("has no rule for an endpoint the gateway no longer offers", () => {
    const specPatterns = new Set(operations.map((o) => `${o.method} ${o.path}`));
    const orphans = ROUTE_RULES.filter(
      (rule) => ![...specPatterns].some((key) => {
        const [method, p] = key.split(" ");
        return rule.method === method && rule.pattern.test(p);
      }),
    ).map((rule) => `${rule.method} ${rule.pattern.source}`);
    expect(orphans).toEqual([]);
  });
});
