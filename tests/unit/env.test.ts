// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEYS = [
  "AFRIKOB_API_URL_TEST",
  "AFRIKOB_API_URL_LIVE",
  "AFRIKOB_PUBLIC_API_URL_TEST",
  "AFRIKOB_PUBLIC_API_URL_LIVE",
  "AFRIKOB_TLS_SERVERNAME",
  "AFRIKOB_CA_CERT",
  "SESSION_SECRET",
];
let saved: Record<string, string | undefined> = {};

async function loadEnv() {
  // The module caches its parse, so each case needs a fresh copy.
  vi.resetModules();
  return import("@/lib/env");
}

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
});

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("server environment", () => {
  it("treats a blank value as unset", async () => {
    process.env.AFRIKOB_TLS_SERVERNAME = "";
    process.env.AFRIKOB_CA_CERT = "  ";
    process.env.AFRIKOB_API_URL_LIVE = "";
    const { serverEnv, availableEnvironments } = await loadEnv();
    expect(serverEnv().AFRIKOB_TLS_SERVERNAME).toBeUndefined();
    expect(serverEnv().AFRIKOB_CA_CERT).toBeUndefined();
    expect(availableEnvironments()).toEqual(["test"]);
  });

  it("keeps a real servername", async () => {
    process.env.AFRIKOB_TLS_SERVERNAME = "myghcard.com";
    const { serverEnv } = await loadEnv();
    expect(serverEnv().AFRIKOB_TLS_SERVERNAME).toBe("myghcard.com");
  });

  it("refuses a short session secret", async () => {
    process.env.SESSION_SECRET = "too-short";
    const { serverEnv } = await loadEnv();
    expect(() => serverEnv()).toThrow(/SESSION_SECRET/);
  });
});

describe("the gateway address shown to integrators", () => {
  it("swaps a bare IP for the certificate's name, so their TLS client accepts it", async () => {
    process.env.AFRIKOB_API_URL_TEST = "https://173.225.107.94:3115/";
    process.env.AFRIKOB_TLS_SERVERNAME = "myghcard.com";
    const { publicApiUrl } = await loadEnv();
    expect(publicApiUrl("test")).toBe("https://myghcard.com:3115");
  });

  it("keeps a hostname as it is, and prefers an explicit public URL", async () => {
    process.env.AFRIKOB_API_URL_TEST = "https://gateway.internal:3115";
    process.env.AFRIKOB_TLS_SERVERNAME = "myghcard.com";
    let { publicApiUrl } = await loadEnv();
    expect(publicApiUrl("test")).toBe("https://gateway.internal:3115");

    process.env.AFRIKOB_PUBLIC_API_URL_TEST = "https://api.afrikob.com/";
    ({ publicApiUrl } = await loadEnv());
    expect(publicApiUrl("test")).toBe("https://api.afrikob.com");
  });
});
