import "server-only";
import { Agent } from "undici";
import { apiBaseUrl, serverEnv, type ApiEnvironment } from "@/lib/env";

let dispatcher: Agent | undefined;

/**
 * Optional undici dispatcher for two cases, neither of which weakens TLS:
 * - AFRIKOB_CA_CERT pins the CA behind a private certificate.
 * - AFRIKOB_TLS_SERVERNAME names the host the certificate was issued for, so a
 *   URL that uses a bare IP still verifies the chain and the certificate's name.
 */
function getDispatcher(url: string): Agent | undefined {
  // TLS options are meaningless (and rejected) on a plain-http upstream.
  if (!url.startsWith("https:")) return undefined;
  const { AFRIKOB_CA_CERT: ca, AFRIKOB_TLS_SERVERNAME: servername } = serverEnv();
  if (!ca && !servername) return undefined;
  dispatcher ??= new Agent({
    connect: {
      ...(ca ? { ca: ca.replace(/\\n/g, "\n") } : {}),
      ...(servername ? { servername } : {}),
    },
  });
  return dispatcher;
}

export interface UpstreamRequest {
  env: ApiEnvironment;
  method: string;
  path: string;
  search?: string;
  headers: Record<string, string>;
  body?: string;
}

/** Calls the Afrikob gateway with timeout and IIS-friendly empty-body handling. */
export async function callUpstream(req: UpstreamRequest): Promise<Response> {
  const url = `${apiBaseUrl(req.env)}/api/v1/${req.path}${req.search ?? ""}`;
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  // The Host header is set by the runtime from the URL and cannot be overridden;
  // AFRIKOB_TLS_SERVERNAME only steers TLS verification, in getDispatcher above.
  const headers: Record<string, string> = { Accept: "application/json", ...req.headers };
  let body: string | undefined;
  if (hasBody) {
    // An empty string still produces Content-Length: 0, which IIS requires on a
    // bodiless POST. Setting that header by hand is rejected by the runtime.
    body = req.body ?? "";
    if (body.length > 0) headers["Content-Type"] = "application/json";
  }
  const init: RequestInit & { dispatcher?: Agent } = {
    method: req.method,
    headers,
    body,
    cache: "no-store",
    // The gateway answers an unauthenticated API call with 302 to its own login
    // page. Following that would turn "signed out" into a 404 or an HTML body,
    // so the redirect is surfaced as-is and read as unauthenticated.
    redirect: "manual",
    signal: AbortSignal.timeout(serverEnv().AFRIKOB_TIMEOUT_MS),
    dispatcher: getDispatcher(url),
  };
  return fetch(url, init);
}
