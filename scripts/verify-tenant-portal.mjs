/**
 * Release gate for ADR-0004: does a tenant user's password session reach the
 * money endpoints on the real gateway?
 *
 * Signs in as a tenant user (password, then the emailed code typed in here),
 * then calls read-only money endpoints on that cookie session. Nothing is sent
 * that moves money. Prints HTTP statuses and response shapes only: never the
 * password, the code, the cookie or any balance.
 *
 *   AFRIKOB_E2E_TENANT_EMAIL=... AFRIKOB_E2E_TENANT_PASSWORD=... \
 *     node --env-file=.env.local scripts/verify-tenant-portal.mjs
 */
import { createInterface } from "node:readline/promises";
import { Agent } from "undici";

const BASE = (process.env.AFRIKOB_API_URL_TEST ?? "").replace(/\/+$/, "");
const EMAIL = process.env.AFRIKOB_E2E_TENANT_EMAIL ?? "";
const PASSWORD = process.env.AFRIKOB_E2E_TENANT_PASSWORD ?? "";
const SERVERNAME = process.env.AFRIKOB_TLS_SERVERNAME;
/** The portal's own copies of the money endpoints (the unprefixed ones answer only an API key). */
const READS = [
  "tenant/transactions?page=1&size=5",
  "tenant/payments/collection-balance?currency=GHS",
  "tenant/payments/disbursement-balance?currency=GHS",
  "tenant/payments/get-all-banks",
  "tenant-admin/tenant",
];

if (!BASE || !EMAIL || !PASSWORD) {
  console.error("Set AFRIKOB_API_URL_TEST (via --env-file=.env.local), AFRIKOB_E2E_TENANT_EMAIL and AFRIKOB_E2E_TENANT_PASSWORD");
  process.exit(1);
}

const dispatcher = SERVERNAME ? new Agent({ connect: { servername: SERVERNAME } }) : undefined;
const call = (path, { method = "GET", body, cookie } = {}) =>
  fetch(`${BASE}/api/v1/${path}`, {
    method,
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
    dispatcher,
  });

/** Keeps only name=value from each Set-Cookie line. */
const cookieOf = (res) => res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

/** Top-level keys and the type of `data`, so the shape is visible without the values. */
function shape(json) {
  if (!json || typeof json !== "object") return typeof json;
  const data = json.data;
  const dataShape = Array.isArray(data) ? `array(${data.length})` : data && typeof data === "object" ? `{${Object.keys(data).join(",")}}` : typeof data;
  return `statusCode=${json.statusCode ?? "?"} data=${dataShape}`;
}

const login = await call("portal/auth/login", { method: "POST", body: { email: EMAIL, password: PASSWORD } });
console.log(`portal/auth/login -> ${login.status}`);
if (!login.ok) process.exit(1);
const pendingCookie = cookieOf(login);

const rl = createInterface({ input: process.stdin, output: process.stdout });
const code = (await rl.question("Code from the email: ")).trim();
rl.close();

const verify = await call("portal/auth/verify-login-code", { method: "POST", body: { email: EMAIL, code }, cookie: pendingCookie || undefined });
const user = await verify.json().catch(() => null);
console.log(`portal/auth/verify-login-code -> ${verify.status} userType=${user?.data?.userType} hasTenant=${Boolean(user?.data?.tenantId)}`);
const cookie = [pendingCookie, cookieOf(verify)].filter(Boolean).join("; ");
if (!verify.ok || !cookie) process.exit(1);

let failures = 0;
for (const path of READS) {
  const res = await call(path, { cookie });
  const json = await res.json().catch(() => null);
  const ok = res.status === 200 || (path.startsWith("tenant-admin/") && res.status === 403);
  if (!ok) failures += 1;
  console.log(`${ok ? "ok  " : "FAIL"} GET ${path} -> ${res.status} ${shape(json)}`);
}

await call("portal/auth/logout", { method: "POST", cookie });
console.log(failures ? `\n${failures} money read(s) refused: do not ship ADR-0004 yet.` : "\nTenant portal sessions reach the money endpoints.");
process.exit(failures ? 1 : 0);
