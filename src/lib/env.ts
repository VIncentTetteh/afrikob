import "server-only";
import { z } from "zod";

export const API_ENVIRONMENTS = ["test", "live"] as const;
export type ApiEnvironment = (typeof API_ENVIRONMENTS)[number];

const MIN_SECRET_LENGTH = 32;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_PORTAL_SESSION_MINUTES = 60;

/** Treats a blank value the same as an unset one, as .env files often carry "KEY=". */
const optionalText = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().optional());

const envSchema = z
  .object({
    AFRIKOB_API_URL_TEST: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.url().optional()),
    AFRIKOB_API_URL_LIVE: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.url().optional()),
    SESSION_SECRET: z.string().min(MIN_SECRET_LENGTH, "SESSION_SECRET must be at least 32 chars"),
    AFRIKOB_CA_CERT: optionalText,
    /**
     * Hostname to verify the gateway's TLS certificate against, when the URL
     * uses a bare IP. The certificate on 173.225.107.94:3115 is issued for
     * myghcard.com, so without this Node rejects it (ERR_TLS_CERT_ALTNAME_INVALID).
     */
    AFRIKOB_TLS_SERVERNAME: optionalText,
    /**
     * The gateway address shown to tenants on the Developers page, per environment.
     * Optional: without it the upstream URL is shown, with a bare IP swapped for
     * AFRIKOB_TLS_SERVERNAME so integrators get a name their TLS client accepts.
     */
    AFRIKOB_PUBLIC_API_URL_TEST: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.url().optional()),
    AFRIKOB_PUBLIC_API_URL_LIVE: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.url().optional()),
    AFRIKOB_TIMEOUT_MS: z.coerce.number().int().positive().default(DEFAULT_TIMEOUT_MS),
    /** Lifetime of a portal (email/password) session; keep at or below the gateway's idle timeout. */
    AFRIKOB_PORTAL_SESSION_MINUTES: z.coerce
      .number()
      .int()
      .positive()
      .max(24 * 60)
      .default(DEFAULT_PORTAL_SESSION_MINUTES),
  })
  .refine((e) => e.AFRIKOB_API_URL_TEST || e.AFRIKOB_API_URL_LIVE, {
    message: "At least one of AFRIKOB_API_URL_TEST / AFRIKOB_API_URL_LIVE must be set",
  });

export type ServerEnv = z.infer<typeof envSchema>;

let cached: ServerEnv | undefined;

/** Validated server environment. Throws on misconfiguration so failures are loud at first use. */
export function serverEnv(): ServerEnv {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid server environment: ${z.prettifyError(parsed.error)}`);
    }
    cached = parsed.data;
  }
  return cached;
}

/** Environments that have an upstream URL configured. */
export function availableEnvironments(): ApiEnvironment[] {
  const env = serverEnv();
  return API_ENVIRONMENTS.filter((e) =>
    e === "test" ? Boolean(env.AFRIKOB_API_URL_TEST) : Boolean(env.AFRIKOB_API_URL_LIVE),
  );
}

/** Upstream base URL (no trailing slash) for an environment. */
export function apiBaseUrl(environment: ApiEnvironment): string {
  const env = serverEnv();
  const url = environment === "test" ? env.AFRIKOB_API_URL_TEST : env.AFRIKOB_API_URL_LIVE;
  if (!url) throw new Error(`No upstream URL configured for environment "${environment}"`);
  return url.replace(/\/+$/, "");
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * The gateway base URL (no trailing slash) a tenant's own systems should call.
 * Never secret, but only derived on the server so the upstream stays configurable.
 */
export function publicApiUrl(environment: ApiEnvironment): string {
  const env = serverEnv();
  const explicit = environment === "test" ? env.AFRIKOB_PUBLIC_API_URL_TEST : env.AFRIKOB_PUBLIC_API_URL_LIVE;
  if (explicit) return explicit.replace(/\/+$/, "");
  const url = new URL(apiBaseUrl(environment));
  if (IPV4.test(url.hostname) && env.AFRIKOB_TLS_SERVERNAME) url.hostname = env.AFRIKOB_TLS_SERVERNAME;
  return url.toString().replace(/\/+$/, "");
}
