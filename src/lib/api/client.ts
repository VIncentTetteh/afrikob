import type { z } from "zod";
import { readCsrfToken } from "./csrf";
import { ApiError } from "./errors";
import { flattenValidationErrors, isEnvelope, STATUS_CODE_SUCCESS } from "./schemas/envelope";
import { CSRF_HEADER } from "@/lib/session/types";

export const PROXY_BASE = "/api/afrikob";

type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions<S extends z.ZodType> {
  query?: Query;
  body?: unknown;
  headers?: Record<string, string>;
  /** Schema applied to the unwrapped `data` payload. */
  schema: S;
  signal?: AbortSignal;
}

/**
 * Some admin actions are gated by maker-checker and return 202 with an
 * approval request instead of the resource.
 */
export interface PendingApproval {
  pendingApproval: true;
  approvalRequestId: string | null;
  message: string;
}

export type Result<T> = { pending?: undefined; data: T } | ({ pending: PendingApproval } & { data?: undefined });

/** Listeners notified on 401 so the app can redirect to sign-in once. */
const unauthorizedListeners = new Set<() => void>();
export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

export function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return `${PROXY_BASE}/${path.replace(/^\/+/, "")}${qs ? `?${qs}` : ""}`;
}

function toApiError(status: number, body: unknown, requestId: string | null): ApiError {
  if (isEnvelope(body)) {
    return new ApiError({
      status,
      message: body.message || `Request failed (${status})`,
      statusCode: body.statusCode ?? null,
      errors: (body.errors ?? []).map((e) => (typeof e === "string" ? e : JSON.stringify(e))),
      fieldErrors: flattenValidationErrors(body.validationErrors),
      requestId,
    });
  }
  const rec = (body ?? {}) as Record<string, unknown>;
  // ProblemDetails from the gateway.
  const message =
    typeof rec.detail === "string" && rec.detail
      ? rec.detail
      : typeof rec.title === "string" && rec.title
        ? rec.title
        : `Request failed (${status})`;
  return new ApiError({ status, message, fieldErrors: flattenValidationErrors(rec.errors), requestId });
}

function readPending(body: unknown): PendingApproval | null {
  const payload = isEnvelope(body) ? body.data : body;
  if (!payload || typeof payload !== "object") return null;
  const rec = payload as Record<string, unknown>;
  if (rec.pendingApproval !== true) return null;
  return {
    pendingApproval: true,
    approvalRequestId: typeof rec.approvalRequestId === "string" ? rec.approvalRequestId : null,
    message: (isEnvelope(body) && body.message) || "Sent for approval.",
  };
}

async function send(
  method: string,
  path: string,
  opts: { query?: Query; body?: unknown; headers?: Record<string, string>; signal?: AbortSignal },
): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json", ...opts.headers };
  if (method !== "GET") {
    headers["Content-Type"] = "application/json";
    const csrf = readCsrfToken();
    if (csrf) headers[CSRF_HEADER] = csrf;
  }
  return fetch(buildUrl(path, opts.query), {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    credentials: "same-origin",
    signal: opts.signal,
  });
}

/** What the gateway said alongside a payload, kept for money movements. */
export interface GatewayMeta {
  httpStatus: number;
  /** Envelope StatusCode: 0 is success, 1 failure; 2-7 are undocumented. */
  statusCode: number | null;
  message: string | null;
}

/** A held action (maker-checker 202), or the payload with what the gateway said about it. */
export type Executed<T> = { pending: PendingApproval } | { data: T; meta: GatewayMeta };

async function execute<S extends z.ZodType>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  opts: RequestOptions<S>,
): Promise<Executed<z.infer<S>>> {
  const res = await send(method, path, opts);
  const requestId = res.headers.get("x-request-id");
  const text = res.status === 204 ? "" : await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    if (res.status === 401) unauthorizedListeners.forEach((l) => l());
    throw toApiError(res.status, body, requestId);
  }

  const pending = res.status === 202 ? readPending(body) : null;
  if (pending) return { pending };

  const statusCode = isEnvelope(body) && body.statusCode != null && Number.isFinite(Number(body.statusCode)) ? Number(body.statusCode) : null;
  if (statusCode !== null && statusCode !== STATUS_CODE_SUCCESS) {
    // A non-success code with no payload is a failure; with a payload it is
    // extra information (for example a queued transaction), so let it through
    // and let the caller read `meta`.
    if (isEnvelope(body) && (body.data === null || body.data === undefined)) throw toApiError(422, body, requestId);
  }

  const payload = isEnvelope(body) ? (body.data ?? null) : body;
  const parsed = opts.schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError({
      status: 500,
      message: "The gateway returned data in an unexpected format.",
      errors: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`),
      requestId,
    });
  }
  return {
    data: parsed.data,
    meta: { httpStatus: res.status, statusCode, message: isEnvelope(body) ? (body.message ?? null) : null },
  };
}

/**
 * Typed request through the BFF proxy. Unwraps the gateway envelope, validates
 * `data`, and reports a maker-checker 202 as a pending result rather than data.
 */
export async function requestResult<S extends z.ZodType>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  opts: RequestOptions<S>,
): Promise<Result<z.infer<S>>> {
  const result = await execute(method, path, opts);
  return "pending" in result ? { pending: result.pending } : { data: result.data };
}

/**
 * For money movements: the payload together with what the gateway said about
 * it, so a "Failed" or queued payment is never shown as a plain success.
 */
export async function requestOutcome<S extends z.ZodType>(
  method: "POST",
  path: string,
  opts: RequestOptions<S>,
): Promise<Executed<z.infer<S>>> {
  return execute(method, path, opts);
}

/** Same as requestResult, but a pending-approval response is surfaced as an error. */
export async function request<S extends z.ZodType>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  opts: RequestOptions<S>,
): Promise<z.infer<S>> {
  const result = await requestResult(method, path, opts);
  if (result.pending) {
    throw new ApiError({ status: 202, message: result.pending.message, statusCode: "pending_approval" });
  }
  return result.data;
}

/** Downloads a file route (report exports) and returns the blob plus its filename. */
export async function download(path: string, query?: Query): Promise<{ blob: Blob; filename: string }> {
  const res = await send("GET", path, { query });
  if (!res.ok) {
    if (res.status === 401) unauthorizedListeners.forEach((l) => l());
    const body = await res.json().catch(() => null);
    throw toApiError(res.status, body, res.headers.get("x-request-id"));
  }
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  return {
    blob: await res.blob(),
    filename: decodeURIComponent(match?.[1] ?? `${path.split("/").pop() ?? "report"}.csv`),
  };
}
