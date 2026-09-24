import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/server/logger";
import { describeUpstreamError } from "@/lib/server/upstream-error";
import { buildPortalSession } from "@/lib/server/portal-session";
import { allowRequest } from "@/lib/server/rate-limit";
import { envelopeError, readUpstreamBody, upstreamMessage } from "@/lib/server/respond";
import { clearPendingLogin, readPendingLogin, writeSession } from "@/lib/server/session";
import { callUpstream } from "@/lib/server/upstream";
import { mergeCookies, readSetCookies, toCookieHeader } from "@/lib/session/cookies";
import { readPortalUser } from "@/lib/session/portal";
import { toPublicSession } from "@/lib/session/types";

const ATTEMPTS_PER_WINDOW = 8;
const WINDOW_MS = 10 * 60 * 1000;
/** No pending sign-in: the browser must start again at the password step. */
const PENDING_EXPIRED_STATUS = 419;

const bodySchema = z.object({ code: z.string().trim().regex(/^[A-Za-z0-9-]{4,12}$/, "Enter the code from your email") });

/**
 * Second half of the portal sign-in: only a valid emailed code turns the
 * pending sign-in into a session. The email comes from the sealed pending
 * cookie, never from the client.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!allowRequest(`verify-login:${ip}`, ATTEMPTS_PER_WINDOW, WINDOW_MS)) {
    return envelopeError(429, "Too many attempts. Start again in a few minutes.", { requestId });
  }

  const pending = await readPendingLogin();
  if (!pending) {
    return envelopeError(PENDING_EXPIRED_STATUS, "That sign-in expired. Enter your email and password again.", { requestId });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return envelopeError(400, parsed.error.issues[0]?.message ?? "Enter the code from your email.", { requestId });
  }

  try {
    const upstream = await callUpstream({
      env: pending.env,
      method: "POST",
      path: "portal/auth/verify-login-code",
      headers: pending.cookie ? { Cookie: pending.cookie } : {},
      body: JSON.stringify({ email: pending.email, code: parsed.data.code }),
    });
    const { json } = await readUpstreamBody(upstream);
    if (!upstream.ok) {
      logger.warn("login code rejected", { requestId, upstreamStatus: upstream.status });
      return envelopeError(
        upstream.status === 401 || upstream.status === 400 ? 401 : 502,
        upstreamMessage(json, "That code is not valid. Check your email and try again."),
        { requestId },
      );
    }

    // The session cookie normally arrives here; the password step may have set one too.
    const issued = readSetCookies(upstream.headers);
    const cookie = issued.length
      ? pending.cookie
        ? mergeCookies(pending.cookie, issued)
        : toCookieHeader(issued)
      : pending.cookie;
    const user = readPortalUser(json);
    if (!cookie || !user) {
      logger.error("verified code did not yield a session", { requestId, hasCookie: Boolean(cookie), hasUser: Boolean(user) });
      return envelopeError(502, "The gateway did not start a session. Contact support.", { requestId });
    }

    const session = await buildPortalSession(pending.env, cookie, user);
    await writeSession(session);
    await clearPendingLogin();
    logger.info("login verified", { requestId, role: session.role, env: pending.env });
    return NextResponse.json(toPublicSession(session));
  } catch (error) {
    const failure = describeUpstreamError(error);
    logger.error("verify login failed", { requestId, code: failure.code });
    return envelopeError(failure.status, failure.message, { requestId });
  }
}
