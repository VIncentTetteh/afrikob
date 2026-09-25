// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callUpstream, cookieJar, json } from "./server-harness";
import { GET, PATCH, POST } from "@/app/api/afrikob/[...path]/route";
import { sealSession, unsealSession } from "@/lib/session/seal";
import type { SessionData } from "@/lib/session/types";

const SECRET = process.env.SESSION_SECRET as string;
const CSRF = "csrf-token-abc";
const GATEWAY_COOKIE = "afk.portal=abc123";
const TENANT_COOKIE = "afk.portal=tenant-user";
const DISBURSEMENT = {
  clientTransactionId: "PAY-0001",
  accountNumber: "0241234567",
  institutionCode: "MTN",
  amount: 25.5,
  currency: "GHS",
  reference: "September salary",
  accountName: "Ama Mensah",
};

function baseSession(overrides: Partial<SessionData> = {}): SessionData {
  const now = Math.floor(Date.now() / 1000);
  return {
    credential: { kind: "cookie", cookie: TENANT_COOKIE },
    role: "tenant",
    env: "test",
    tenantId: "ten-1",
    userId: "u-tenant",
    label: "Ops User",
    canMake: true,
    canCheck: true,
    iat: now,
    exp: now + 600,
    ...overrides,
  };
}

async function signIn(overrides: Partial<SessionData> = {}) {
  const session = baseSession(overrides);
  cookieJar.set("afk_session", { name: "afk_session", value: await sealSession(session, SECRET) });
  cookieJar.set("afk_csrf", { name: "afk_csrf", value: CSRF });
  return session;
}

const signInAsAdmin = (overrides: Partial<SessionData> = {}) =>
  signIn({ credential: { kind: "cookie", cookie: GATEWAY_COOKIE }, role: "platform", label: "Doris Bosompem", ...overrides });

function call(method: "GET" | "POST" | "PATCH", path: string, init: { body?: unknown; headers?: Record<string, string>; search?: string } = {}) {
  const req = new NextRequest(`http://localhost/api/afrikob/${path}${init.search ?? ""}`, {
    method,
    headers: { "content-type": "application/json", ...init.headers },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const ctx = { params: Promise.resolve({ path: path.split("/") }) };
  const handler = method === "GET" ? GET : method === "PATCH" ? PATCH : POST;
  return handler(req, ctx);
}

const storedSession = () => unsealSession(cookieJar.get("afk_session")?.value, SECRET);

beforeEach(() => {
  cookieJar.clear();
  callUpstream.mockReset();
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});

describe("BFF proxy", () => {
  it("returns 401 without a session", async () => {
    expect((await call("GET", "tenant/transactions")).status).toBe(401);
    expect(callUpstream).not.toHaveBeenCalled();
  });

  it("takes a tenant user's password session straight to their money", async () => {
    await signIn();
    callUpstream.mockResolvedValue(json({ statusCode: 0, data: [] }));
    const res = await call("GET", "tenant/transactions", { search: "?page=2&size=10" });
    expect(res.status).toBe(200);
    expect(callUpstream).toHaveBeenCalledWith(
      expect.objectContaining({ search: "?page=2&size=10", headers: expect.objectContaining({ Cookie: TENANT_COOKIE }) }),
    );
    // No API key or bearer token is involved in a portal session.
    expect((callUpstream.mock.calls[0][0] as { headers: Record<string, string> }).headers.Authorization).toBeUndefined();
  });

  it("replays the gateway session cookie for portal sessions", async () => {
    await signInAsAdmin();
    callUpstream.mockResolvedValue(json({ statusCode: 0, data: [] }));
    await call("GET", "admin/tenants");
    const sent = (callUpstream.mock.calls[0][0] as { headers: Record<string, string> }).headers;
    expect(sent.Cookie).toBe(GATEWAY_COOKIE);
    expect(sent.Authorization).toBeUndefined();
  });

  it("stores a rotated gateway cookie for later calls", async () => {
    await signInAsAdmin();
    callUpstream.mockResolvedValue(
      json({ statusCode: 0, data: [] }, 200, { "set-cookie": "afk.portal=rotated; Path=/; HttpOnly" }),
    );
    await call("GET", "admin/tenants");
    const stored = await storedSession();
    expect(stored?.credential).toEqual({ kind: "cookie", cookie: "afk.portal=rotated" });
  });

  it("rejects writes without a matching CSRF header", async () => {
    await signIn();
    expect((await call("POST", "tenant/payments/status-check", { body: {} })).status).toBe(403);
    expect((await call("POST", "tenant/payments/status-check", { body: {}, headers: { "x-csrf-token": "wrong-token-abc" } })).status).toBe(403);
    expect(callUpstream).not.toHaveBeenCalled();
  });

  it("forwards only allowlisted headers on writes", async () => {
    await signIn();
    callUpstream.mockResolvedValue(json({ statusCode: 0, data: {} }));
    await call("POST", "tenant/payments/bulk-disbursements", {
      body: { disbursements: [DISBURSEMENT] },
      headers: { "x-csrf-token": CSRF, clientbatchid: "BATCH-1", "x-admin-user": "spoofed", "cookie": "evil=1" },
    });
    const req = callUpstream.mock.calls[0][0] as { path: string; headers: Record<string, string>; body: string };
    expect(req.path).toBe("tenant/payments/bulk-disbursements");
    expect(req.headers.clientbatchid).toBe("BATCH-1");
    expect(req.headers["X-Admin-User"]).toBeUndefined();
    // The browser's own cookie header never reaches the gateway; only the sealed one does.
    expect(req.headers.Cookie).toBe(TENANT_COOKIE);
    expect(JSON.parse(req.body)).toEqual({ disbursements: [DISBURSEMENT] });
  });

  it("blocks unknown routes and admin routes for tenants", async () => {
    await signIn();
    expect((await call("GET", "internal/secrets")).status).toBe(404);
    expect((await call("GET", "admin/tenants")).status).toBe(403);
    expect((await call("PATCH", "admin/users/u1", { headers: { "x-csrf-token": CSRF }, body: {} })).status).toBe(403);
    expect(callUpstream).not.toHaveBeenCalled();
  });

  it("no longer sends X-Admin-User: the gateway takes the actor from the session", async () => {
    await signInAsAdmin();
    callUpstream.mockResolvedValue(json({ statusCode: 0, data: {} }));
    await call("POST", "admin/refunds/r1/approve", { headers: { "x-csrf-token": CSRF } });
    const sent = (callUpstream.mock.calls[0][0] as { headers: Record<string, string> }).headers;
    expect(sent["X-Admin-User"]).toBeUndefined();
    expect(sent.Cookie).toBe(GATEWAY_COOKIE);
  });

  it("keeps each area to its own role", async () => {
    await signIn({ role: "tenant-admin" });
    callUpstream.mockImplementation(async () => json({ statusCode: 0, data: [] }));
    expect((await call("GET", "admin/tenants")).status).toBe(403);
    expect((await call("GET", "tenant-admin/tenant")).status).toBe(200);
    // A tenant's administrator runs the money too, on the same password session.
    expect((await call("GET", "tenant/transactions")).status).toBe(200);

    callUpstream.mockClear();
    await signInAsAdmin();
    // Afrikob staff have no tenant context, so money routes are refused early.
    const money = await call("GET", "tenant/transactions");
    expect(money.status).toBe(403);
    expect((await money.json()).message).toMatch(/Reports/);
    expect((await call("GET", "tenant-admin/tenant")).status).toBe(403);
    expect(callUpstream).not.toHaveBeenCalled();
  });

  it("reads the gateway's redirect to its login page as signed out", async () => {
    await signInAsAdmin();
    // ASP.NET answers an unauthenticated API call with 302 to /Account/Login.
    const redirected = new Response(null, { status: 302, headers: { location: "/Account/Login" } });
    callUpstream
      .mockResolvedValueOnce(redirected)
      .mockResolvedValueOnce(new Response(null, { status: 302 }))
      .mockResolvedValueOnce(new Response(null, { status: 302 }));
    const res = await call("GET", "admin/refunds");
    expect(res.status).toBe(401);
    expect((await res.json()).message).toMatch(/session has expired/i);
    expect(cookieJar.has("afk_session")).toBe(false);
  });

  it("clears a portal session when a 401 is confirmed by a failing probe", async () => {
    await signInAsAdmin();
    callUpstream
      .mockResolvedValueOnce(json({ message: "expired" }, 401))
      .mockResolvedValueOnce(json({ message: "expired" }, 401))
      .mockResolvedValueOnce(json({ message: "expired" }, 401));
    expect((await call("GET", "admin/refunds")).status).toBe(401);
    expect((callUpstream.mock.calls[2][0] as { path: string }).path).toBe("admin/tenants");
    expect(cookieJar.has("afk_session")).toBe(false);
  });

  it("keeps a working session when only one endpoint answers 401", async () => {
    await signInAsAdmin();
    callUpstream
      .mockResolvedValueOnce(json({ message: "no tenant context" }, 401))
      .mockResolvedValueOnce(json({ message: "no tenant context" }, 401))
      .mockResolvedValueOnce(json({ statusCode: 0, data: [] }));
    const res = await call("GET", "admin/refunds");
    expect(res.status).toBe(403);
    expect((callUpstream.mock.calls[2][0] as { path: string }).path).toBe("admin/tenants");
    expect(cookieJar.has("afk_session")).toBe(true);
  });

  it("does not probe when the probe endpoint itself is the one refusing", async () => {
    await signInAsAdmin();
    callUpstream
      .mockResolvedValueOnce(json({ message: "expired" }, 401))
      .mockResolvedValueOnce(json({ message: "expired" }, 401));
    expect((await call("GET", "admin/tenants")).status).toBe(401);
    // Retried once, then judged without a probe: it is the probe route itself.
    expect(callUpstream).toHaveBeenCalledTimes(2);
    expect(cookieJar.has("afk_session")).toBe(false);
  });

  it("keeps the session when the gateway refuses one call with 403", async () => {
    await signInAsAdmin();
    callUpstream.mockResolvedValue(json({ statusCode: 1, message: "Access denied" }, 403));
    const res = await call("GET", "admin/tenants");
    expect(res.status).toBe(403);
    expect((await res.json()).message).toBe("Access denied");
    // One refused endpoint must not sign an admin out of everything else.
    expect(cookieJar.has("afk_session")).toBe(true);
  });

  it("slides a portal session once it is past half its life", async () => {
    const now = Math.floor(Date.now() / 1000);
    await signInAsAdmin({ iat: now - 3600, exp: now + 60 });
    callUpstream.mockResolvedValue(json({ statusCode: 0, data: [] }));
    await call("GET", "admin/tenants");
    const stored = await storedSession();
    expect(stored?.exp).toBeGreaterThan(now + 60);
  });

  it("streams report downloads without parsing them", async () => {
    await signInAsAdmin();
    callUpstream.mockResolvedValue(
      new Response("date,amount\n2026-09-16,10", {
        status: 200,
        headers: { "content-type": "text/csv", "content-disposition": 'attachment; filename="collections.csv"' },
      }),
    );
    const res = await call("GET", "admin/reports/collections", { search: "?tenantId=ten-1" });
    expect(res.headers.get("content-type")).toBe("text/csv");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="collections.csv"');
    expect(await res.text()).toBe("date,amount\n2026-09-16,10");
  });

  it("passes 204 through with no body", async () => {
    await signInAsAdmin();
    callUpstream.mockResolvedValue(new Response(null, { status: 204 }));
    const res = await call("POST", "admin/refunds/r1/approve", { headers: { "x-csrf-token": CSRF } });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  it("passes gateway errors through and wraps non-JSON bodies", async () => {
    await signIn();
    callUpstream.mockResolvedValueOnce(json({ statusCode: 1, message: "Insufficient funds" }, 400));
    const res = await call("GET", "tenant/payments/disbursement-balance");
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe("Insufficient funds");

    callUpstream.mockResolvedValueOnce(new Response("<html>IIS</html>", { status: 500 }));
    expect((await call("GET", "tenant/payments/disbursement-balance")).status).toBe(500);

    callUpstream.mockResolvedValueOnce(new Response("not json", { status: 200 }));
    expect((await call("GET", "tenant/payments/disbursement-balance")).status).toBe(502);
  });

  it("maps timeouts to 504, and explains a certificate problem", async () => {
    await signIn();
    callUpstream.mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"));
    expect((await call("GET", "tenant/transactions")).status).toBe(504);

    const tls = new Error("fetch failed");
    (tls as Error & { cause?: unknown }).cause = { code: "ERR_TLS_CERT_ALTNAME_INVALID" };
    callUpstream.mockRejectedValueOnce(tls);
    const res = await call("GET", "tenant/transactions");
    expect(res.status).toBe(502);
    expect((await res.json()).message).toMatch(/certificate could not be verified/);
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });

  it("rejects oversized bodies", async () => {
    await signIn();
    const res = await call("POST", "tenant/payments/bulk-disbursements", {
      body: { pad: "x".repeat(2 * 1024 * 1024 + 10) },
      headers: { "x-csrf-token": CSRF },
    });
    expect(res.status).toBe(413);
  });
});

/** Browser validation can be bypassed, so the proxy checks every write again. */
describe("server-side validation of writes", () => {
  it("refuses an invalid money request before it reaches the gateway", async () => {
    await signIn();
    const res = await call("POST", "tenant/payments/disbursement", {
      headers: { "x-csrf-token": CSRF },
      body: { ...DISBURSEMENT, amount: "10.555", currency: "USD" },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(Object.keys(body.validationErrors)).toEqual(expect.arrayContaining(["amount", "currency"]));
    expect(callUpstream).not.toHaveBeenCalled();
  });

  it("forwards only the parsed body: extra fields dropped, values normalised", async () => {
    await signIn();
    callUpstream.mockResolvedValue(json({ statusCode: 0, data: {} }));
    await call("POST", "tenant/payments/collection", {
      headers: { "x-csrf-token": CSRF },
      body: {
        clientTransactionId: "COL-0002",
        walletNumber: "+233 24 123 4567",
        institutionCode: "mtn",
        amount: "1,250.50",
        currency: "ghs",
        reference: "Invoice 2",
        tenantId: "someone-else",
      },
    });
    const sent = JSON.parse((callUpstream.mock.calls[0][0] as { body: string }).body);
    expect(sent).toEqual({
      clientTransactionId: "COL-0002",
      walletNumber: "0241234567",
      institutionCode: "MTN",
      amount: 1250.5,
      currency: "GHS",
      reference: "Invoice 2",
    });
  });

  it("sends no body on a write that takes none, and rejects malformed JSON", async () => {
    await signInAsAdmin();
    callUpstream.mockResolvedValue(json({ statusCode: 0, data: {} }));
    await call("POST", "admin/refunds/r1/approve", { headers: { "x-csrf-token": CSRF }, body: { sneaky: true } });
    expect((callUpstream.mock.calls[0][0] as { body?: string }).body).toBeUndefined();

    const req = new NextRequest("http://localhost/api/afrikob/admin/tenants", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": CSRF },
      body: "{not json",
    });
    const res = await POST(req, { params: Promise.resolve({ path: ["admin", "tenants"] }) });
    expect(res.status).toBe(400);
  });
});

/**
 * Seen in production: the gateway answered `payments/collection-balance` with
 * 401 while `payments/disbursement-balance` returned 200 on the same token
 * seconds earlier. Nothing about that means the session ended, and treating it
 * as a sign-out threw a working merchant out of the dashboard.
 */
describe("not mistaking a bad moment for a dead session", () => {
  it("retries a safe call once, and carries on when the second try works", async () => {
    await signIn();
    callUpstream
      .mockResolvedValueOnce(json({ message: "expired" }, 401))
      .mockResolvedValueOnce(json({ statusCode: 0, data: { availableBalance: 5 } }));

    const res = await call("GET", "tenant/payments/collection-balance");

    expect(res.status).toBe(200);
    expect(callUpstream).toHaveBeenCalledTimes(2);
    expect(cookieJar.has("afk_session")).toBe(true);
  });

  it("never repeats a call that moves money", async () => {
    await signIn();
    callUpstream
      .mockResolvedValueOnce(json({ message: "expired" }, 401))
      .mockResolvedValueOnce(json({ statusCode: 0, data: [] }));

    const collection = { clientTransactionId: "COL-0001", walletNumber: "0241234567", institutionCode: "MTN", amount: 1, currency: "GHS", reference: "Invoice 1" };
    const res = await call("POST", "tenant/payments/collection", { headers: { "x-csrf-token": CSRF }, body: collection });

    // One attempt and nothing more. The payment is never sent twice; the only
    // other call is the read-only probe that shows the session is still good.
    const paths = callUpstream.mock.calls.map((c) => (c[0] as { path: string }).path);
    expect(paths).toEqual(["tenant/payments/collection", "tenant/payments/get-all-banks"]);
    expect(res.status).toBe(403);
    expect(cookieJar.has("afk_session")).toBe(true);
  });

  it("keeps the session when the probe cannot be reached at all", async () => {
    await signInAsAdmin();
    callUpstream
      .mockResolvedValueOnce(json({ message: "expired" }, 401))
      .mockResolvedValueOnce(json({ message: "expired" }, 401))
      .mockRejectedValueOnce(new Error("fetch failed"));

    const res = await call("GET", "admin/refunds");

    expect(res.status).toBe(403);
    expect(cookieJar.has("afk_session")).toBe(true);
  });

  it("keeps the session when the probe is rate limited or erroring", async () => {
    for (const status of [429, 500]) {
      await signInAsAdmin();
      callUpstream
        .mockResolvedValueOnce(json({ message: "expired" }, 401))
        .mockResolvedValueOnce(json({ message: "expired" }, 401))
        .mockResolvedValueOnce(json({ message: "slow down" }, status));

      const res = await call("GET", "admin/refunds");

      expect(res.status).toBe(403);
      expect(cookieJar.has("afk_session")).toBe(true);
    }
  });
});

/** A tenant's password session follows the same rules as a staff one. */
describe("tenant portal sessions", () => {
  it("ends the session once the probe confirms the gateway forgot it", async () => {
    await signIn();
    callUpstream.mockResolvedValue(json({ message: "Unauthorized" }, 401));

    const res = await call("GET", "tenant/payments/disbursement-balance");

    expect(res.status).toBe(401);
    expect((callUpstream.mock.calls[2][0] as { path: string }).path).toBe("tenant/payments/get-all-banks");
    expect(cookieJar.has("afk_session")).toBe(false);
  });

  it("probes a tenant administrator against their own tenant record", async () => {
    await signIn({ role: "tenant-admin" });
    callUpstream
      .mockResolvedValueOnce(json({ message: "no" }, 401))
      .mockResolvedValueOnce(json({ message: "no" }, 401))
      .mockResolvedValueOnce(json({ statusCode: 0, data: {} }));

    expect((await call("GET", "tenant/transactions")).status).toBe(403);
    expect((callUpstream.mock.calls[2][0] as { path: string }).path).toBe("tenant-admin/tenant");
    expect(cookieJar.has("afk_session")).toBe(true);
  });

  it("ends the session at its own expiry without asking the gateway", async () => {
    const now = Math.floor(Date.now() / 1000);
    await signIn({ iat: now - 600, exp: now - 1 });

    expect((await call("GET", "tenant/transactions")).status).toBe(401);
    expect(callUpstream).not.toHaveBeenCalled();
  });

  it("treats a session sealed for a retired API-key sign-in as signed out", async () => {
    const now = Math.floor(Date.now() / 1000);
    const legacy = { ...baseSession(), credential: { kind: "bearer", jwt: "old.jwt" } } as unknown as SessionData;
    cookieJar.set("afk_session", { name: "afk_session", value: await sealSession(legacy, SECRET) });
    expect(legacy.exp).toBeGreaterThan(now);

    expect((await call("GET", "tenant/transactions")).status).toBe(401);
    expect(callUpstream).not.toHaveBeenCalled();
  });
});
