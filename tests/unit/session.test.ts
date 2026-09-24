// @vitest-environment node
import { EncryptJWT, SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { extractToken, inspectToken } from "@/lib/session/claims";
import { mergeCookies, readSetCookies, toCookieHeader } from "@/lib/session/cookies";
import { readPortalUser, toIdentity, withTenantAdmin } from "@/lib/session/portal";
import { sealSession, unsealSession } from "@/lib/session/seal";
import { authMode, toPublicSession, type SessionData } from "@/lib/session/types";

const SECRET = "unit-test-secret-unit-test-secret-000";
const now = Math.floor(Date.now() / 1000);

const portalSession: SessionData = {
  credential: { kind: "cookie", cookie: "afk.portal=abc123; XSRF=zz" },
  role: "platform",
  env: "test",
  tenantId: null,
  userId: "usr-1",
  label: "Doris Bosompem",
  canMake: true,
  canCheck: true,
  iat: now,
  exp: now + 600,
};

const tenantSession: SessionData = { ...portalSession, credential: { kind: "bearer", jwt: "a.b.c" }, role: "tenant", userId: null };

async function jwt(claims: Record<string, unknown>): Promise<string> {
  return new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).sign(new TextEncoder().encode("k".repeat(32)));
}

describe("session sealing", () => {
  it("round-trips both credential kinds", async () => {
    expect(await unsealSession(await sealSession(portalSession, SECRET), SECRET)).toEqual(portalSession);
    expect(await unsealSession(await sealSession(tenantSession, SECRET), SECRET)).toEqual(tenantSession);
  });

  it("rejects wrong secret, garbage, missing and expired tokens", async () => {
    const sealed = await sealSession(portalSession, SECRET);
    expect(await unsealSession(sealed, `${SECRET}x`)).toBeNull();
    expect(await unsealSession("garbage", SECRET)).toBeNull();
    expect(await unsealSession(undefined, SECRET)).toBeNull();
    expect(await unsealSession(await sealSession({ ...portalSession, exp: now - 10 }, SECRET), SECRET)).toBeNull();
  });

  it("rejects payloads with an invalid role or credential", async () => {
    const key = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(SECRET)));
    const forge = async (payload: Record<string, unknown>) =>
      new EncryptJWT(payload).setProtectedHeader({ alg: "dir", enc: "A256GCM" }).setExpirationTime(now + 60).encrypt(key);
    expect(await unsealSession(await forge({ ...portalSession, role: "root" }), SECRET)).toBeNull();
    expect(await unsealSession(await forge({ ...portalSession, credential: { kind: "cookie" } }), SECRET)).toBeNull();
    expect(await unsealSession(await forge({ ...portalSession, credential: { kind: "bearer", jwt: "" } }), SECRET)).toBeNull();
  });

  it("never exposes the upstream credential to the browser", () => {
    const publicSession = toPublicSession(portalSession);
    expect(JSON.stringify(publicSession)).not.toContain("abc123");
    expect(publicSession).toMatchObject({ mode: "portal", role: "platform", canCheck: true });
    expect(authMode(tenantSession)).toBe("apikey");
  });
});

describe("gateway cookies", () => {
  it("reduces Set-Cookie lines to a Cookie header", () => {
    expect(
      toCookieHeader([
        "afk.portal=abc123; Path=/; HttpOnly; SameSite=Lax",
        "XSRF-TOKEN=zz; Path=/",
        "broken",
      ]),
    ).toBe("afk.portal=abc123; XSRF-TOKEN=zz");
    expect(toCookieHeader([])).toBe("");
  });

  it("merges rotated cookies, newest winning", () => {
    expect(mergeCookies("afk.portal=old; other=1", ["afk.portal=new; Path=/"])).toBe("afk.portal=new; other=1");
    expect(mergeCookies("afk.portal=old", [])).toBe("afk.portal=old");
  });

  it("ignores a blanked cookie rather than losing the credential", () => {
    expect(mergeCookies("afk.portal=live", ["afk.portal=; Expires=Thu, 01 Jan 1970 00:00:00 GMT"])).toBe("afk.portal=live");
    expect(mergeCookies("afk.portal=live", ["extra=; Path=/"])).toBe("afk.portal=live; extra=");
  });

  it("reads Set-Cookie with or without getSetCookie", () => {
    const headers = new Headers();
    headers.append("set-cookie", "a=1");
    expect(readSetCookies(headers)).toEqual(["a=1"]);
    const legacy = { get: () => "b=2" } as unknown as Headers;
    expect(readSetCookies(legacy)).toEqual(["b=2"]);
  });
});

describe("portal identity", () => {
  it("treats a user with no tenant as Afrikob staff", () => {
    expect(toIdentity({ userType: "Admin", displayName: "Doris", userId: "u1" })).toMatchObject({ role: "platform", label: "Doris" });
    expect(toIdentity({ userType: "PlatformOps" }).role).toBe("platform");
    expect(toIdentity({}).role).toBe("platform");
    expect(toIdentity({}).label).toBe("Portal user");
  });

  it("promotes a tenant user only once the gateway confirms it", () => {
    const tenant = toIdentity({ tenantId: "ten-1" });
    expect(withTenantAdmin(tenant, true).role).toBe("tenant-admin");
    expect(withTenantAdmin(tenant, false).role).toBe("tenant");
    // Afrikob staff are never demoted into a tenant.
    expect(withTenantAdmin(toIdentity({}), true).role).toBe("platform");
  });

  it("treats tenant-scoped users as tenants and defaults capabilities", () => {
    const identity = toIdentity({ userType: "Merchant", tenantId: "ten-1", email: "ops@afikob.com" });
    expect(identity).toMatchObject({ role: "tenant", tenantId: "ten-1", label: "ops@afikob.com", canMake: true, canCheck: true });
    expect(toIdentity({ userType: "Finance", canMake: true, canCheck: false, tenantId: "t" }).canCheck).toBe(false);
    expect(toIdentity({}).label).toBe("Portal user");
  });

  it("reads the user from an envelope or a bare body", () => {
    expect(readPortalUser({ data: { userId: "u1", email: "a@b.com" } })?.userId).toBe("u1");
    expect(readPortalUser({ userId: "u2" })?.userId).toBe("u2");
    expect(readPortalUser({ data: null })).toBeNull();
    expect(readPortalUser("nope")).toBeNull();
  });
});

describe("token claims (API-key sessions)", () => {
  it("detects admin, tenant, label and expiry", async () => {
    expect(inspectToken(await jwt({ role: "Admin" }), now).roleHint).toBe("platform");
    expect(inspectToken(await jwt({ roles: ["viewer", "platform admin"] }), now).roleHint).toBe("platform");
    expect(inspectToken(await jwt({ is_admin: true }), now).roleHint).toBe("platform");
    const tenant = inspectToken(await jwt({ role: "merchant", tenantId: "ten-1", name: "Afikob API", exp: now + 900 }), now);
    expect(tenant).toEqual({ roleHint: "tenant", tenantId: "ten-1", label: "Afikob API", exp: now + 900 });
    const opaque = inspectToken("opaque", now);
    expect(opaque.roleHint).toBeNull();
    expect(opaque.exp).toBe(now + 900);
  });

  it("reads the tenant from the gateway's tenant_code claim", async () => {
    // The live gateway issues tenant_code (T001), not a tenantId.
    expect(inspectToken(await jwt({ tenant_code: "T001", sub: "key-1" }), now).tenantId).toBe("T001");
  });

  it("extracts a token from common response shapes", () => {
    expect(extractToken({ accessToken: "t1" })).toBe("t1");
    expect(extractToken({ data: { token: "t2" } })).toBe("t2");
    expect(extractToken("x.y.z")).toBe("x.y.z");
    expect(extractToken("not-a-jwt")).toBeNull();
    expect(extractToken(42)).toBeNull();
  });
});
