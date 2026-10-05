/**
 * Diagnoses why API-key sessions stop working seconds after sign-in.
 *
 * Tells apart three explanations, from one fixed IP (this machine):
 *   1. The token has a very short life            -> A dies over time, even alone.
 *   2. Minting a new token revokes the previous   -> A dies right after B is minted.
 *   3. The token is bound to the caller's IP      -> A and B both keep working here;
 *                                                    `aud` holds this machine's IP.
 *
 * Prints claim names, timing claims and HTTP statuses only: never the key or token.
 *
 *   AFRIKOB_TENANT_KEY=... node --env-file=.env.local scripts/diagnose-token.mjs
 */
import { Agent } from "undici";

const BASE = (process.env.AFRIKOB_API_URL_TEST ?? "").replace(/\/+$/, "");
const KEY = process.env.AFRIKOB_TENANT_KEY ?? "";
const SERVERNAME = process.env.AFRIKOB_TLS_SERVERNAME;
const PROBE = "payments/collection-balance?currency=GHS";
const LIFETIME_WAIT_MS = 30_000;
const TIMING_CLAIMS = ["aud", "iss", "iat", "nbf", "exp", "tenant_code"];

if (!BASE || !KEY) {
  console.error("Set AFRIKOB_API_URL_TEST (via --env-file=.env.local) and AFRIKOB_TENANT_KEY");
  process.exit(1);
}

const dispatcher = SERVERNAME ? new Agent({ connect: { servername: SERVERNAME } }) : undefined;
const call = (path, headers, method = "GET") =>
  fetch(`${BASE}/api/v1/${path}`, { method, headers: { Accept: "application/json", ...headers }, redirect: "manual", dispatcher });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString().slice(11, 19);

async function mint(label) {
  const res = await call("auth/token", { "X-API-Key": KEY }, "POST");
  const body = await res.json().catch(() => ({}));
  const data = body?.data ?? body;
  const jwt = [data?.accessToken, data?.access_token, data?.token, data?.jwt, body?.token].find((v) => typeof v === "string");
  if (!jwt) throw new Error(`mint ${label} failed: HTTP ${res.status}`);
  const claims = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
  const shown = Object.fromEntries(TIMING_CLAIMS.filter((k) => k in claims).map((k) => [k, claims[k]]));
  const life = claims.exp && claims.iat ? `${claims.exp - claims.iat}s` : "unknown";
  console.log(`${stamp()} minted ${label}: lifetime ${life}`, shown, "claim names:", Object.keys(claims).join(","));
  return jwt;
}

async function probe(label, jwt) {
  const res = await call(PROBE, { Authorization: `Bearer ${jwt}` });
  await res.body?.cancel();
  console.log(`${stamp()} ${label} -> ${res.status}`);
  return res.status;
}

const ip = await fetch("https://api.ipify.org").then((r) => r.text()).catch(() => "unknown");
console.log(`this machine's public IP: ${ip}\n`);

const a = await mint("A");
for (let i = 0; i < 3; i++) await probe("A alone", a);

console.log(`\n-- minting B; does A survive? --`);
const b = await mint("B");
await probe("A after B minted", a);
await probe("B", b);

console.log(`\n-- waiting ${LIFETIME_WAIT_MS / 1000}s; do tokens die with time? --`);
await sleep(LIFETIME_WAIT_MS);
await probe("A after wait", a);
await probe("B after wait", b);
