import type { Executed } from "./client";
import { statusTone } from "./schemas/normalize";

export type OutcomeTone = "success" | "pending" | "failed";

export interface Outcome<T> {
  tone: OutcomeTone;
  title: string;
  /** The gateway's own words, when it gave any. */
  detail: string | null;
  data: T | null;
}

const KNOWN_FAILURE = 1;

/**
 * How a money movement actually ended, from the gateway's envelope and the
 * payload's own status. Anything short of an explicit success is reported as
 * pending: the provider may still settle it, and a status check will tell.
 */
export function paymentOutcome<T extends { status?: string | null; message?: string | null; errorMessage?: string | null }>(
  result: Executed<T>,
  noun: string,
): Outcome<T> {
  if ("pending" in result) {
    return { tone: "pending", title: `${noun} sent for approval`, detail: result.pending.message, data: null };
  }
  const { data, meta } = result;
  const detail = data.message ?? data.errorMessage ?? meta.message ?? null;
  const tone = statusTone(data.status ?? null);
  if (meta.statusCode === KNOWN_FAILURE || tone === "failed") {
    return { tone: "failed", title: `${noun} failed`, detail, data };
  }
  if (tone === "success" && (meta.statusCode === null || meta.statusCode === 0) && meta.httpStatus !== 202) {
    return { tone: "success", title: `${noun} completed`, detail, data };
  }
  return { tone: "pending", title: `${noun} accepted, waiting for the provider`, detail, data };
}
