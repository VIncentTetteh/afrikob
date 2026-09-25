// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { firstAdminBody } from "@/components/admin/first-admin-sheet";
import { INTEGRATION_ENDPOINTS, integrationSamples } from "@/lib/api/integration";

describe("Developers page content", () => {
  it("only documents API-key endpoints that exist in the gateway spec", () => {
    const spec = JSON.parse(readFileSync(path.join(process.cwd(), "docs/api/swagger-v1.json"), "utf8")) as {
      paths: Record<string, Record<string, unknown>>;
    };
    for (const { method, path: route } of INTEGRATION_ENDPOINTS) {
      const operation = spec.paths[`/api/v1${route}`]?.[method.toLowerCase()];
      expect(operation, `${method} ${route}`).toBeDefined();
      // Integrators call the unprefixed endpoints; tenant/, admin and tenant-admin are portal-only.
      expect(/^\/(admin|tenant-admin|tenant)\//.test(route), route).toBe(false);
    }
  });

  it("keeps secrets out of the samples: they come from the caller's environment", () => {
    const code = integrationSamples("https://myghcard.com:3115").map((s) => s.code).join("\n");
    expect(code).toContain("https://myghcard.com:3115/api/v1/auth/token");
    expect(code).toContain('"X-API-Key: $AFRIKOB_API_KEY"');
    expect(code).toContain('"Authorization: Bearer $AFRIKOB_TOKEN"');
  });
});

describe("a new tenant's first administrator", () => {
  it("is a tenant user who administers the tenant and may submit and approve", () => {
    const body = firstAdminBody("3f1c2b7e-8a4d-4c6e-9b1a-2d5e7f9a0c11", { email: "ama@shop.gh", displayName: "Ama Mensah", password: "a-good-password1" });
    expect(body).toMatchObject({
      email: "ama@shop.gh",
      userType: "Tenant",
      tenantId: "3f1c2b7e-8a4d-4c6e-9b1a-2d5e7f9a0c11",
      isTenantAdmin: true,
      isPlatformAdmin: false,
      canMake: true,
      canCheck: true,
    });
  });
});
