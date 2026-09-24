import "server-only";
import { NextResponse } from "next/server";

/** Failure value used by the gateway envelope (observed: statusCode 1 on 403). */
export const ENVELOPE_FAILURE_CODE = 1;

/** Returns an error in the same envelope shape the gateway uses, so the client has one parser. */
export function envelopeError(
  status: number,
  message: string,
  extra: { requestId?: string; errors?: string[] } = {},
): NextResponse {
  return NextResponse.json(
    {
      statusCode: ENVELOPE_FAILURE_CODE,
      message,
      data: null,
      transactionReference: null,
      timestamp: new Date().toISOString(),
      errors: extra.errors ?? [],
      validationErrors: null,
      metadata: extra.requestId ? { requestId: extra.requestId } : {},
    },
    { status, headers: extra.requestId ? { "x-request-id": extra.requestId } : undefined },
  );
}

/** Safely parses an upstream body as JSON, returning the raw text when it is not JSON. */
export async function readUpstreamBody(res: Response): Promise<{ json: unknown; text: string }> {
  const text = await res.text();
  try {
    return { json: text ? JSON.parse(text) : null, text };
  } catch {
    return { json: undefined, text };
  }
}

/**
 * Pulls a human message out of a gateway body: the envelope's `message`, or
 * ProblemDetails' `detail` (more specific) before its `title`.
 */
export function upstreamMessage(json: unknown, fallback: string): string {
  if (json && typeof json === "object") {
    const rec = json as Record<string, unknown>;
    for (const key of ["message", "detail", "title", "error"]) {
      if (typeof rec[key] === "string" && rec[key]) return rec[key] as string;
    }
  }
  return fallback;
}
