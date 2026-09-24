import "server-only";

/**
 * Node's fetch reports every connection problem as "fetch failed" and hides the
 * reason in `error.cause`. This turns that into something a log reader and an
 * operator can act on.
 */
export interface UpstreamFailure {
  /** HTTP status to answer the browser with. */
  status: number;
  /** Message shown to the person signing in. */
  message: string;
  /** Low-level code for the log line, e.g. ERR_TLS_CERT_ALTNAME_INVALID. */
  code: string;
}

const TLS_CODES = new Set([
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "CERT_HAS_EXPIRED",
  "ERR_SSL_WRONG_VERSION_NUMBER",
]);

const UNREACHABLE_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
]);

function causeCode(error: unknown): string {
  const cause = (error as { cause?: { code?: string; message?: string } })?.cause;
  return cause?.code ?? cause?.message ?? (error instanceof Error ? error.message : String(error));
}

export function describeUpstreamError(error: unknown): UpstreamFailure {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return { status: 504, message: "The gateway took too long to answer.", code: "TIMEOUT" };
  }
  const code = causeCode(error);
  if (TLS_CODES.has(code)) {
    return {
      status: 502,
      message:
        "The gateway's certificate could not be verified for that address. Point AFRIKOB_API_URL_* at the hostname on the certificate.",
      code,
    };
  }
  if (UNREACHABLE_CODES.has(code)) {
    return { status: 502, message: "Could not reach the payment gateway.", code };
  }
  return { status: 502, message: "Could not reach the payment gateway.", code };
}
