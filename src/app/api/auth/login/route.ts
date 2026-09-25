import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { availableEnvironments, API_ENVIRONMENTS, type ApiEnvironment } from "@/lib/env";
import { logger } from "@/lib/server/logger";
import { describeUpstreamError } from "@/lib/server/upstream-error";
import { allowRequest } from "@/lib/server/rate-limit";
import { envelopeError, readUpstreamBody, upstreamMessage } from "@/lib/server/respond";
import { buildPortalSession, type LoginOutcome } from "@/lib/server/portal-session";
import { clearPendingLogin, nowSeconds, PENDING_LOGIN_SECONDS, writePendingLogin, writeSession } from "@/lib/server/session";
import { callUpstream } from "@/lib/server/upstream";
import { readSetCookies, toCookieHeader } from "@/lib/session/cookies";
import { readPortalUser } from "@/lib/session/portal";
import { toPublicSession } from "@/lib/session/types";
import { emailAddress } from "@/lib/validation/fields";

const LOGIN_ATTEMPTS_PER_WINDOW = 10;
const LOGIN_WINDOW_MS = 5 * 60 * 1000;
const MAX_PASSWORD_LENGTH = 256;

/** Everyone signs in with email and password; API keys never open a portal session. */
const credentialsSchema = z.object({
  env: z.enum(API_ENVIRONMENTS),
  email: emailAddress,
  password: z.string().min(1, "Enter your password").max(MAX_PASSWORD_LENGTH),
});

/**
 * Portal password step. The gateway emails a one-time code and returns
 * `{ requiresVerification, maskedEmail }`; no session exists until that code is
 * verified at /api/auth/verify-login, so this only parks a pending sign-in.
 */
async function portalLogin(env: ApiEnvironment, email: string, password: string, requestId: string): Promise<LoginOutcome> {
  const res = await callUpstream({
    env,
    method: "POST",
    path: "portal/auth/login",
    headers: {},
    body: JSON.stringify({ email, password }),
  });
  const { json } = await readUpstreamBody(res);
  if (!res.ok) {
    return {
      error: envelopeError(res.status === 401 ? 401 : 502, upstreamMessage(json, "Incorrect email or password."), { requestId }),
    };
  }

  const payload = (isRecord(json) && isRecord(json.data) ? json.data : isRecord(json) ? json : {}) as Record<string, unknown>;
  const cookie = toCookieHeader(readSetCookies(res.headers)) || null;

  // A gateway that skips the emailed code must return the user here instead.
  if (payload.requiresVerification === false) {
    const user = readPortalUser(json);
    if (!user || !cookie) {
      logger.error("login skipped verification without a session", { requestId });
      return { error: envelopeError(502, "The gateway did not start a session. Contact support.", { requestId }) };
    }
    return { session: await buildPortalSession(env, cookie, user) };
  }

  const iat = nowSeconds();
  await writePendingLogin({
    email,
    env,
    maskedEmail: typeof payload.maskedEmail === "string" ? payload.maskedEmail : null,
    cookie,
    exp: iat + PENDING_LOGIN_SECONDS,
  });
  logger.info("login awaiting code", { requestId, env });
  return {
    pending: {
      requiresVerification: true as const,
      maskedEmail: typeof payload.maskedEmail === "string" ? payload.maskedEmail : null,
      expiresIn: PENDING_LOGIN_SECONDS,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!allowRequest(`login:${ip}`, LOGIN_ATTEMPTS_PER_WINDOW, LOGIN_WINDOW_MS)) {
    return envelopeError(429, "Too many sign-in attempts. Try again in a few minutes.", { requestId });
  }

  const parsed = credentialsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return envelopeError(400, "Enter your email and password.", { requestId });
  const credentials = parsed.data;
  if (!availableEnvironments().includes(credentials.env)) {
    return envelopeError(400, `The ${credentials.env} environment is not configured.`, { requestId });
  }

  try {
    await clearPendingLogin();
    const result = await portalLogin(credentials.env, credentials.email, credentials.password, requestId);
    if (result.error) {
      logger.warn("login rejected", { requestId, env: credentials.env });
      return result.error;
    }
    if (result.pending) return NextResponse.json(result.pending);
    await writeSession(result.session);
    logger.info("login succeeded", { requestId, role: result.session.role, env: credentials.env });
    return NextResponse.json(toPublicSession(result.session));
  } catch (error) {
    const failure = describeUpstreamError(error);
    logger.error("login failed", { requestId, code: failure.code });
    return envelopeError(failure.status, failure.message, { requestId });
  }
}
