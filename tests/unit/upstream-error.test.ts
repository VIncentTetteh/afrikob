// @vitest-environment node
import { describe, expect, it } from "vitest";
import { describeUpstreamError } from "@/lib/server/upstream-error";

/** Node hides the real reason in error.cause and reports "fetch failed". */
function fetchFailed(code: string): Error {
  const error = new Error("fetch failed");
  (error as Error & { cause?: unknown }).cause = Object.assign(new Error(code), { code });
  return error;
}

describe("describeUpstreamError", () => {
  it("names the certificate problem and how to fix it", () => {
    const failure = describeUpstreamError(fetchFailed("ERR_TLS_CERT_ALTNAME_INVALID"));
    expect(failure).toMatchObject({ status: 502, code: "ERR_TLS_CERT_ALTNAME_INVALID" });
    expect(failure.message).toMatch(/certificate could not be verified/);
    expect(failure.message).toMatch(/AFRIKOB_API_URL/);
  });

  it.each(["DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "CERT_HAS_EXPIRED"])(
    "treats %s as a certificate problem",
    (code) => {
      expect(describeUpstreamError(fetchFailed(code)).message).toMatch(/certificate/);
    },
  );

  it.each(["ECONNREFUSED", "ENOTFOUND", "EHOSTUNREACH", "UND_ERR_CONNECT_TIMEOUT"])("reports %s as unreachable", (code) => {
    expect(describeUpstreamError(fetchFailed(code))).toEqual({
      status: 502,
      message: "Could not reach the payment gateway.",
      code,
    });
  });

  it("maps an abort timeout to 504", () => {
    expect(describeUpstreamError(new DOMException("timed out", "TimeoutError"))).toMatchObject({
      status: 504,
      code: "TIMEOUT",
    });
  });

  it("keeps an unknown reason in the log code without leaking it to the person", () => {
    const failure = describeUpstreamError(new Error("something odd"));
    expect(failure.code).toBe("something odd");
    expect(failure.message).toBe("Could not reach the payment gateway.");
  });
});
