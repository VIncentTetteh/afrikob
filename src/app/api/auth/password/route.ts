import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { availableEnvironments, API_ENVIRONMENTS } from "@/lib/env";
import { logger } from "@/lib/server/logger";
import { describeUpstreamError } from "@/lib/server/upstream-error";
import { allowRequest } from "@/lib/server/rate-limit";
import { envelopeError, readUpstreamBody, upstreamMessage } from "@/lib/server/respond";
import { callUpstream } from "@/lib/server/upstream";

/**
 * Public password-reset relay: forgot-password → verify-code → reset-password.
 * These gateway routes need no session, so they cannot go through the
 * session-protected proxy; this route validates and rate limits them instead.
 */
const ATTEMPTS_PER_WINDOW = 8;
const WINDOW_MS = 10 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 256;
const CODE = /^[A-Za-z0-9-]{4,12}$/;

const password = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(MAX_PASSWORD_LENGTH);

const bodySchema = z.discriminatedUnion("step", [
  z.object({ step: z.literal("forgot"), env: z.enum(API_ENVIRONMENTS), email: z.email() }),
  z.object({ step: z.literal("verify"), env: z.enum(API_ENVIRONMENTS), email: z.email(), code: z.string().regex(CODE, "Enter the code from your email") }),
  z.object({
    step: z.literal("reset"),
    env: z.enum(API_ENVIRONMENTS),
    email: z.email(),
    code: z.string().regex(CODE),
    newPassword: password,
    confirmPassword: password,
  }),
]);

const UPSTREAM_PATH = {
  forgot: "portal/auth/forgot-password",
  verify: "portal/auth/verify-code",
  reset: "portal/auth/reset-password",
} as const;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!allowRequest(`password:${ip}`, ATTEMPTS_PER_WINDOW, WINDOW_MS)) {
    return envelopeError(429, "Too many attempts. Try again later.", { requestId });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return envelopeError(400, parsed.error.issues[0]?.message ?? "Check the details you entered.", { requestId });
  }
  const input = parsed.data;
  const { step, env } = input;
  if (!availableEnvironments().includes(env)) {
    return envelopeError(400, `The ${env} environment is not configured.`, { requestId });
  }
  if (input.step === "reset" && input.newPassword !== input.confirmPassword) {
    return envelopeError(400, "The passwords do not match.", { requestId });
  }
  const payload =
    input.step === "forgot"
      ? { email: input.email }
      : input.step === "verify"
        ? { email: input.email, code: input.code }
        : { email: input.email, code: input.code, newPassword: input.newPassword, confirmPassword: input.confirmPassword };

  try {
    const upstream = await callUpstream({
      env,
      method: "POST",
      path: UPSTREAM_PATH[step],
      headers: {},
      body: JSON.stringify(payload),
    });
    const { json } = await readUpstreamBody(upstream);
    logger.info("password step", { requestId, step, status: upstream.status });
    if (!upstream.ok) {
      return envelopeError(upstream.status === 400 ? 400 : 502, upstreamMessage(json, "That didn't work. Check the code and try again."), { requestId });
    }
    return NextResponse.json(json, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const failure = describeUpstreamError(error);
    logger.error("password step failed", { requestId, step, code: failure.code });
    return envelopeError(failure.status, failure.message, { requestId });
  }
}
