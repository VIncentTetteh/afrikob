import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/server/logger";
import { envelopeError, readUpstreamBody } from "@/lib/server/respond";
import { FORWARDED_HEADERS, matchRoute, mayUse, type RouteRule } from "@/lib/server/routes";
import { clearSession, readSession, slideSession, verifyCsrf } from "@/lib/server/session";
import { callUpstream } from "@/lib/server/upstream";
import { describeUpstreamError } from "@/lib/server/upstream-error";
import { mergeCookies, readSetCookies } from "@/lib/session/cookies";
import { CSRF_HEADER, type SessionData } from "@/lib/session/types";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const SAFE_METHODS = new Set(["GET", "HEAD"]);
const EXPIRED_MESSAGE = "Your session has expired. Please sign in again.";

type Ctx = { params: Promise<{ path: string[] }> };

/** The gateway authorises every call by the portal session cookie it set at sign-in. */
function authHeaders(session: SessionData): Record<string, string> {
  return { Cookie: session.credential.cookie };
}

/** A cheap read the signed-in role is always entitled to. */
const PROBE_PATH: Record<SessionData["role"], string> = {
  platform: "admin/tenants",
  "tenant-admin": "tenant-admin/tenant",
  tenant: "tenant/payments/get-all-banks",
};

/**
 * A 401 can mean the session died, or just that this endpoint refuses this
 * caller. Before signing anyone out mid-task, check the session itself.
 *
 * Only an outright rejection of the probe proves the credential is gone.
 * Anything else — a refusal on that one route, a rate limit, a gateway error,
 * a connection that never completed — says nothing about the session, so it
 * counts as alive. Signing someone out on that evidence loses their work for
 * no reason; if the session really has ended, the next call says so anyway.
 */
async function sessionStillAlive(session: SessionData, failedPath: string): Promise<boolean> {
  const probePath = PROBE_PATH[session.role];
  if (failedPath === probePath) return false;
  try {
    const res = await callUpstream({
      env: session.env,
      method: "GET",
      path: probePath,
      headers: authHeaders(session),
    });
    await res.body?.cancel();
    return !isUnauthenticated(res.status);
  } catch {
    return true;
  }
}

type BodyCheck = { ok: true; body: string | undefined } | { ok: false; message: string; fields: Record<string, string[]> };

/**
 * Re-validates a write against the same schema the browser used, and forwards
 * only the parsed result: unknown fields are dropped and values normalised. A
 * route with no schema takes no body, so none is forwarded.
 */
function validateBody(schema: RouteRule["body"], raw: string): BodyCheck {
  if (!schema) return { ok: true, body: undefined };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, message: "The request body is not valid JSON.", fields: {} };
  }
  const parsed = schema.safeParse(json);
  if (parsed.success) return { ok: true, body: JSON.stringify(parsed.data) };
  const fields: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join(".") || "body";
    (fields[key] ??= []).push(issue.message);
  }
  return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the details you entered.", fields };
}

/** The gateway redirects an unauthenticated API call to its sign-in page. */
function isUnauthenticated(status: number): boolean {
  return status === 401 || (status >= 300 && status < 400);
}

/**
 * Backend-for-frontend proxy: the browser never sees the gateway credential or host.
 * Enforces session, CSRF, route allowlist and admin role before forwarding.
 */
async function handler(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const started = Date.now();
  const { path: segments } = await params;
  const path = segments.map(encodeURIComponent).join("/");
  const method = request.method.toUpperCase();

  const session = await readSession();
  if (!session) return envelopeError(401, EXPIRED_MESSAGE, { requestId });
  if (!SAFE_METHODS.has(method) && !(await verifyCsrf(request.headers.get(CSRF_HEADER)))) {
    return envelopeError(403, "Invalid CSRF token.", { requestId });
  }
  const rule = matchRoute(method, path);
  if (!rule) return envelopeError(404, "Unknown endpoint.", { requestId });
  if (!mayUse(session.role, rule.scope)) {
    const message =
      rule.scope === "money"
        ? "Money screens belong to a tenant's own users. Staff see movements through Reports."
        : "Your sign-in does not cover this area.";
    return envelopeError(403, message, { requestId });
  }

  // The gateway identifies the actor from the session; it no longer takes an
  // audit header, so nothing about the caller is sent from the browser.
  const headers: Record<string, string> = { ...authHeaders(session), "X-Request-Id": requestId };
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers[name] = value;
  }

  let body: string | undefined;
  if (!SAFE_METHODS.has(method)) {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return envelopeError(413, "Request body too large.", { requestId });
    const checked = validateBody(rule.body, raw);
    if (!checked.ok) {
      logger.warn("proxy refused an invalid body", { requestId, method, route: rule.pattern.source, fields: Object.keys(checked.fields) });
      return envelopeError(400, checked.message, { requestId, validationErrors: checked.fields });
    }
    body = checked.body;
  }

  try {
    const send = () =>
      callUpstream({
        env: session.env,
        method,
        path,
        search: request.nextUrl.search,
        headers,
        body,
      });

    let upstream = await send();
    // The gateway sometimes answers one read with 401 while the very next call
    // on the same credential succeeds. A single retry of a safe request costs
    // little and spares a working session; unsafe methods are never repeated.
    if (isUnauthenticated(upstream.status) && SAFE_METHODS.has(method)) {
      await upstream.body?.cancel();
      upstream = await send();
    }
    logger.info("proxy", {
      requestId,
      method,
      route: rule.pattern.source,
      status: upstream.status,
      duration_ms: Date.now() - started,
    });

    // Only 401 means the session is dead. A 403 is this call being refused —
    // signing the person out over it would end a working session.
    if (isUnauthenticated(upstream.status)) {
      if (await sessionStillAlive(session, path)) {
        logger.warn("gateway refused one call, session still good", {
          requestId,
          method,
          route: rule.pattern.source,
          upstreamStatus: upstream.status,
        });
        return envelopeError(403, "The gateway would not allow this request for your account.", { requestId });
      }
      logger.warn("session ended by gateway", {
        requestId,
        method,
        route: rule.pattern.source,
        upstreamStatus: upstream.status,
      });
      await clearSession();
      return envelopeError(401, EXPIRED_MESSAGE, { requestId });
    }
    if (upstream.status === 403) {
      logger.warn("gateway refused the call", { requestId, method, route: rule.pattern.source });
    }
    // The gateway may rotate its session cookie on any response; keep the newest.
    const rotated = readSetCookies(upstream.headers);
    const credentialChanged = rotated.length > 0;
    if (credentialChanged) {
      session.credential = { kind: "cookie", cookie: mergeCookies(session.credential.cookie, rotated) };
    }
    await slideSession(session, credentialChanged);

    if (rule.binary) {
      return new NextResponse(upstream.body, {
        status: upstream.status,
        headers: {
          "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
          "Content-Disposition": upstream.headers.get("content-disposition") ?? `attachment; filename="${path.split("/").pop()}.csv"`,
          "x-request-id": requestId,
          "Cache-Control": "no-store",
        },
      });
    }

    if (upstream.status === 204) {
      return new NextResponse(null, { status: 204, headers: { "x-request-id": requestId } });
    }

    const { json, text } = await readUpstreamBody(upstream);
    if (json === undefined) {
      return envelopeError(upstream.ok ? 502 : upstream.status, text.slice(0, 200) || "Unexpected gateway response.", {
        requestId,
      });
    }
    return NextResponse.json(json, {
      status: upstream.status,
      headers: { "x-request-id": requestId, "Cache-Control": "no-store" },
    });
  } catch (error) {
    const failure = describeUpstreamError(error);
    logger.error("proxy failed", {
      requestId,
      method,
      route: rule.pattern.source,
      duration_ms: Date.now() - started,
      code: failure.code,
    });
    return envelopeError(failure.status, failure.message, { requestId });
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
