#!/usr/bin/env node
/**
 * Phase 0 contract discovery: calls every read-only / side-effect-free gateway
 * endpoint and writes REDACTED responses to tests/msw/captured/*.json so the
 * inferred Zod normalizers and MSW fixtures can be checked against reality.
 *
 * Must run from an allowlisted network. Keys come from the environment only:
 *   AFRIKOB_API_URL=https://... AFRIKOB_TENANT_KEY=... AFRIKOB_ADMIN_KEY=... \
 *     node scripts/capture-responses.mjs
 * Prefer injecting keys from your secrets manager rather than typing them.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = (process.env.AFRIKOB_API_URL ?? "").replace(/\/+$/, "");
const OUT = path.resolve("tests/msw/captured");
const PII = /name|email|phone|msisdn|wallet|account|key|token|secret/i;

if (!BASE) {
  console.error("Set AFRIKOB_API_URL");
  process.exit(1);
}

function redact(value, key = "") {
  if (Array.isArray(value)) return value.slice(0, 5).map((v) => redact(v, key));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v, k)]));
  }
  if (typeof value === "string" && PII.test(key) && !/code|type|status/i.test(key)) return `<redacted:${value.length}>`;
  return value;
}

async function call(method, route, { jwt, apiKey, body } = {}) {
  const headers = { Accept: "application/json" };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  if (apiKey) headers["X-API-Key"] = apiKey;
  if (body) headers["Content-Type"] = "application/json";
  else if (method !== "GET") headers["Content-Length"] = "0";
  const res = await fetch(`${BASE}/api/v1/${route}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { nonJson: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

function findToken(body) {
  if (!body || typeof body !== "object") return typeof body === "string" ? body : null;
  for (const k of ["accessToken", "access_token", "token", "jwt"]) if (typeof body[k] === "string") return body[k];
  return findToken(body.data);
}

async function capture(label, key, endpoints) {
  if (!key) return console.warn(`skip ${label}: no key`);
  const token = await call("POST", "auth/token", { apiKey: key });
  await save(`${label}__auth-token`, { status: token.status, shape: redact(token.json) });
  const jwt = findToken(token.json);
  if (!jwt) return console.error(`${label}: token exchange failed (${token.status})`);
  const claims = JSON.parse(Buffer.from(jwt.split(".")[1] ?? "", "base64url").toString() || "{}");
  await save(`${label}__jwt-claims`, { keys: Object.keys(claims), role: claims.role ?? claims.roles ?? null });
  for (const [method, route, body] of endpoints) {
    const res = await call(method, route, { jwt, body });
    await save(`${label}__${method}_${route.replace(/[^a-z0-9]+/gi, "-")}`, { status: res.status, body: redact(res.json) });
    console.log(`${label} ${method} ${route} → ${res.status}`);
  }
}

async function save(name, data) {
  await writeFile(path.join(OUT, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`);
}

await mkdir(OUT, { recursive: true });
await capture("tenant", process.env.AFRIKOB_TENANT_KEY, [
  ["GET", "transactions?page=1&size=5"],
  ["GET", "payments/get-all-banks"],
  ["GET", "payments/get-all-telcos"],
  ["GET", "payments/disbursement-balance"],
  ["GET", "payments/bulk-disbursements"],
  ["POST", "payments/status-check", { clientTransactionId: "phase0-nonexistent" }],
  ["GET", "admin/tenants"],
]);
await capture("admin", process.env.AFRIKOB_ADMIN_KEY, [
  ["GET", "admin/tenants"],
  ["GET", "admin/refunds"],
  ["GET", "admin/approval-policies"],
  ["GET", "transactions?page=1&size=5"],
]);
console.log(`Saved to ${OUT}. Review before committing; redaction is key-based.`);
