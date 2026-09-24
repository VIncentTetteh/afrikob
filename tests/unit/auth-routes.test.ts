// @vitest-environment node
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callUpstream, cookieJar, json } from "./server-harness";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { POST as password } from "@/app/api/auth/password/route";
import { POST as verifyLogin } from "@/app/api/auth/verify-login/route";
import { GET as getSession } from "@/app/api/auth/session/route";
import { unsealSession } from "@/lib/session/seal";

const SECRET = process.env.SESSION_SECRET as string;
const PORTAL_USER = {
  userId: "usr-1",
  email: "ops@afrikob.com",
  displayName: "Doris Bosompem",
  userType: "Admin",
  tenantId: null,
  canMake: true,
  canCheck: false,
};
let ipCounter = 0;

const token = (claims: Record<string, unknown>) =>
  new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setExpirationTime("15m").sign(new TextEncoder().encode("k".repeat(32)));

function post(handler: (r: NextRequest) => Promise<Response>, url: string, body: unknown, ip = `10.0.0.${++ipCounter}`) {
  return handler(
    new NextRequest(`http://localhost${url}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }),
  );
}

const loginRequest = (body: unknown, ip?: string) => post(login, "/api/auth/login", body, ip);
const verifyRequest = (body: unknown, ip?: string) => post(verifyLogin, "/api/auth/verify-login", body, ip);
const LOGIN_STARTED = { statusCode: 0, data: { requiresVerification: true, maskedEmail: "o***@afrikob.com" } };

/** Password step: the gateway emails a code and returns no session. */
async function startLogin(ip?: string) {
  callUpstream.mockResolvedValueOnce(json(LOGIN_STARTED));
  return loginRequest({ env: "test", email: "ops@afrikob.com", password: "correct horse" }, ip);
}
const passwordRequest = (body: unknown, ip?: string) => post(password, "/api/auth/password", body, ip);
const storedSession = () => unsealSession(cookieJar.get("afk_session")?.value, SECRET);

beforeEach(() => {
  cookieJar.clear();
  callUpstream.mockReset();
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});

describe("portal login (email, password, then emailed code)", () => {
  it("emails a code and creates no session from the password alone", async () => {
    const res = await startLogin();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ requiresVerification: true, maskedEmail: "o***@afrikob.com" });

    const sent = callUpstream.mock.calls[0][0] as { path: string; body: string };
    expect(sent.path).toBe("portal/auth/login");
    expect(JSON.parse(sent.body)).toEqual({ email: "ops@afrikob.com", password: "correct horse" });

    // Nothing is signed in yet: only the sealed pending cookie exists.
    expect(await storedSession()).toBeNull();
    expect(cookieJar.has("afk_pending")).toBe(true);
    expect(cookieJar.get("afk_pending")?.options).toMatchObject({ httpOnly: true, sameSite: "strict" });
    expect((await getSession()).status).toBe(401);
  });

  it("activates the session only once the code checks out", async () => {
    await startLogin();
    callUpstream.mockResolvedValueOnce(
      json({ statusCode: 0, data: PORTAL_USER }, 200, { "set-cookie": "afk.portal=abc123; Path=/; HttpOnly; SameSite=Lax" }),
    );
    const res = await verifyRequest({ code: "654321" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ role: "platform", label: "Doris Bosompem", mode: "portal", canCheck: false });

    const sent = callUpstream.mock.calls[1][0] as { path: string; body: string };
    expect(sent.path).toBe("portal/auth/verify-login-code");
    // The email comes from the sealed pending cookie, not the browser.
    expect(JSON.parse(sent.body)).toEqual({ email: "ops@afrikob.com", code: "654321" });

    const session = await storedSession();
    expect(session?.credential).toEqual({ kind: "cookie", cookie: "afk.portal=abc123" });
    expect(session?.userId).toBe("usr-1");
    expect(cookieJar.get("afk_session")?.value).not.toContain("abc123");
    expect(cookieJar.get("afk_csrf")?.options).toMatchObject({ httpOnly: false });
    expect(cookieJar.has("afk_pending")).toBe(false);
  });

  it("replays a cookie issued at the password step when verification adds none", async () => {
    callUpstream.mockResolvedValueOnce(json(LOGIN_STARTED, 200, { "set-cookie": "afk.flow=step1; Path=/" }));
    await loginRequest({ env: "test", email: "ops@afrikob.com", password: "correct horse" });
    callUpstream.mockResolvedValueOnce(json({ statusCode: 0, data: PORTAL_USER }));
    await verifyRequest({ code: "654321" });
    expect((callUpstream.mock.calls[1][0] as { headers: Record<string, string> }).headers.Cookie).toBe("afk.flow=step1");
    expect((await storedSession())?.credential).toEqual({ kind: "cookie", cookie: "afk.flow=step1" });
  });

  it("keeps the pending sign-in alive when the code is wrong", async () => {
    await startLogin();
    callUpstream.mockResolvedValueOnce(json({ title: "Unauthorized", detail: "That code is not valid." }, 401));
    const res = await verifyRequest({ code: "000000" });
    expect(res.status).toBe(401);
    expect((await res.json()).message).toBe("That code is not valid.");
    expect(await storedSession()).toBeNull();
    expect(cookieJar.has("afk_pending")).toBe(true);
  });

  it("rejects a malformed code and a verification with nothing pending", async () => {
    await startLogin();
    expect((await verifyRequest({ code: "!!" })).status).toBe(400);
    expect(callUpstream).toHaveBeenCalledTimes(1);

    cookieJar.clear();
    const stale = await verifyRequest({ code: "654321" });
    expect(stale.status).toBe(419);
    expect((await stale.json()).message).toMatch(/expired/);
  });

  it("refuses when a verified code yields no session", async () => {
    await startLogin();
    callUpstream.mockResolvedValueOnce(json({ statusCode: 0, data: PORTAL_USER }));
    const res = await verifyRequest({ code: "654321" });
    expect(res.status).toBe(502);
    expect((await res.json()).message).toMatch(/did not start a session/);
    expect(await storedSession()).toBeNull();
  });

  it("signs in directly when the gateway skips verification", async () => {
    callUpstream.mockResolvedValueOnce(
      json({ statusCode: 0, data: { requiresVerification: false, ...PORTAL_USER } }, 200, { "set-cookie": "afk.portal=direct" }),
    );
    const res = await loginRequest({ env: "test", email: "ops@afrikob.com", password: "correct horse" });
    expect(res.status).toBe(200);
    expect((await storedSession())?.credential).toEqual({ kind: "cookie", cookie: "afk.portal=direct" });
    expect(cookieJar.has("afk_pending")).toBe(false);
  });

  it("returns 401 on bad credentials and 400 on a malformed request", async () => {
    callUpstream.mockResolvedValueOnce(json({ title: "Unauthorized", detail: "Incorrect email or password." }, 401));
    const denied = await loginRequest({ env: "test", email: "ops@afrikob.com", password: "wrong" });
    expect(denied.status).toBe(401);
    expect((await denied.json()).message).toBe("Incorrect email or password.");
    expect(cookieJar.has("afk_pending")).toBe(false);

    expect((await loginRequest({ env: "test", email: "not-an-email", password: "x" })).status).toBe(400);
    expect((await loginRequest({ env: "test" })).status).toBe(400);
    expect(cookieJar.size).toBe(0);
  });
});

describe("API-key login", () => {
  it("exchanges the key for a bearer session and detects the role", async () => {
    const jwt = await token({ role: "merchant", tenantId: "ten-9", name: "Afikob API" });
    callUpstream
      .mockResolvedValueOnce(json({ statusCode: 0, data: { accessToken: jwt } }))
      .mockResolvedValueOnce(json({ statusCode: 1, message: "Access denied" }, 403));
    const res = await loginRequest({ env: "test", apiKey: "tenant_key_9999" });
    expect(await res.json()).toMatchObject({ role: "tenant", tenantId: "ten-9", mode: "apikey" });
    expect(callUpstream.mock.calls[0][0]).toMatchObject({ path: "auth/token", headers: { "X-API-Key": "tenant_key_9999" } });
    expect(callUpstream.mock.calls[1][0]).toMatchObject({ method: "GET", path: "admin/tenants" });

    const session = await storedSession();
    expect(session?.credential).toEqual({ kind: "bearer", jwt });
    expect(JSON.stringify(session)).not.toContain("tenant_key_9999");
  });

  it("rejects a key the gateway refuses, and surfaces gateway failures", async () => {
    callUpstream.mockResolvedValueOnce(json({ statusCode: 1, message: "Access denied" }, 403));
    expect((await loginRequest({ env: "test", apiKey: "wrong_key_123" })).status).toBe(401);

    callUpstream.mockResolvedValueOnce(json({ statusCode: 0, data: {} }));
    expect((await loginRequest({ env: "test", apiKey: "no_token_key_1" })).status).toBe(401);

    callUpstream.mockRejectedValueOnce(new Error("ECONNRESET"));
    expect((await loginRequest({ env: "test", apiKey: "network_err_key" })).status).toBe(502);
    expect(cookieJar.size).toBe(0);
  });

  it("rejects an environment that is not configured", async () => {
    const res = await loginRequest({ env: "live", apiKey: "long_enough_key" });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/live environment is not configured/);
    expect(callUpstream).not.toHaveBeenCalled();
  });

  it("rate limits repeated attempts from one address", async () => {
    callUpstream.mockImplementation(async () => json({ message: "denied" }, 403));
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await loginRequest({ env: "test", apiKey: "brute_force_key" }, "9.9.9.9")).status);
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});

describe("password reset", () => {
  it("relays each step to the matching gateway route", async () => {
    callUpstream.mockResolvedValueOnce(json({ statusCode: 0, data: { maskedEmail: "o**@afrikob.com" } }));
    const forgot = await passwordRequest({ step: "forgot", env: "test", email: "ops@afrikob.com" });
    expect(forgot.status).toBe(200);
    expect(callUpstream.mock.calls[0][0]).toMatchObject({ path: "portal/auth/forgot-password" });
    expect(JSON.parse((callUpstream.mock.calls[0][0] as { body: string }).body)).toEqual({ email: "ops@afrikob.com" });

    callUpstream.mockResolvedValueOnce(json({ statusCode: 0, data: { valid: true } }));
    await passwordRequest({ step: "verify", env: "test", email: "ops@afrikob.com", code: "123456" });
    expect(callUpstream.mock.calls[1][0]).toMatchObject({ path: "portal/auth/verify-code" });

    callUpstream.mockResolvedValueOnce(json({ statusCode: 0, data: PORTAL_USER }));
    const reset = await passwordRequest({
      step: "reset",
      env: "test",
      email: "ops@afrikob.com",
      code: "123456",
      newPassword: "a-good-password",
      confirmPassword: "a-good-password",
    });
    expect(reset.status).toBe(200);
    expect(callUpstream.mock.calls[2][0]).toMatchObject({ path: "portal/auth/reset-password" });
    // Resetting a password must not sign anyone in.
    expect(cookieJar.size).toBe(0);
  });

  it("validates codes, password length and confirmation before calling the gateway", async () => {
    expect((await passwordRequest({ step: "verify", env: "test", email: "ops@afrikob.com", code: "!!" })).status).toBe(400);
    expect(
      (await passwordRequest({ step: "reset", env: "test", email: "o@a.com", code: "123456", newPassword: "short", confirmPassword: "short" }))
        .status,
    ).toBe(400);
    const mismatch = await passwordRequest({
      step: "reset",
      env: "test",
      email: "o@a.com",
      code: "123456",
      newPassword: "a-good-password",
      confirmPassword: "different-password",
    });
    expect(mismatch.status).toBe(400);
    expect((await mismatch.json()).message).toBe("The passwords do not match.");
    expect(callUpstream).not.toHaveBeenCalled();
  });

  it("reports a rejected code without leaking gateway details", async () => {
    callUpstream.mockResolvedValueOnce(json({ title: "Bad Request", detail: "Code expired" }, 400));
    const res = await passwordRequest({ step: "verify", env: "test", email: "ops@afrikob.com", code: "999999" });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe("Code expired");
  });
});

describe("session and logout", () => {
  it("exposes only public fields, then ends the gateway session on sign-out", async () => {
    expect((await getSession()).status).toBe(401);

    await startLogin();
    callUpstream.mockResolvedValueOnce(
      json({ statusCode: 0, data: PORTAL_USER }, 200, { "set-cookie": "afk.portal=abc123; Path=/" }),
    );
    await verifyRequest({ code: "654321" });

    const res = await getSession();
    const body = await res.json();
    expect(body).toMatchObject({ role: "platform", mode: "portal", env: "test", environments: ["test"] });
    expect(JSON.stringify(body)).not.toContain("abc123");
    expect(res.headers.get("cache-control")).toBe("no-store");

    callUpstream.mockResolvedValueOnce(json({ statusCode: 0, data: { loggedOut: true } }));
    await logout();
    expect(callUpstream.mock.calls.at(-1)?.[0]).toMatchObject({
      path: "portal/auth/logout",
      headers: { Cookie: "afk.portal=abc123" },
    });
    expect(cookieJar.size).toBe(0);
    expect((await getSession()).status).toBe(401);
  });

  it("signs out locally even if the gateway is unreachable", async () => {
    await startLogin();
    callUpstream.mockResolvedValueOnce(
      json({ statusCode: 0, data: PORTAL_USER }, 200, { "set-cookie": "afk.portal=abc123" }),
    );
    await verifyRequest({ code: "654321" });
    callUpstream.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    expect((await logout()).status).toBe(200);
    expect(cookieJar.size).toBe(0);
  });
});
