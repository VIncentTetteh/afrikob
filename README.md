# Afrikob Pay Dashboard

Admin console and merchant portal for the **Afrikob Payment Gateway** (Swagger v1, kept at [docs/api/swagger-v1.json](docs/api/swagger-v1.json)).

Everyone signs in with **email, password and an emailed code**. Three audiences share one console:

- **Afrikob staff** (no tenant) run the platform: tenants and their first administrators, integration keys, wallet funding, fees, people, refunds, reports, approval rules and the **approvals inbox**.
- **A tenant's own administrator** gets the money screens **plus** their organisation: its limits and wallets, their own people, their approvals inbox, and requesting funds.
- **Tenant users** (created by an administrator) get the money screens: overview, collections, disbursements (single and bulk CSV), refunds, status checks, and **Developers**, which explains how their own systems call the gateway.

**API keys never sign anyone in.** A key is for a tenant's own software: it is exchanged at `POST /auth/token` for a bearer JWT by *their* server. Afrikob staff issue keys from the tenant record; the Developers page shows tenants how to use them.

## Routes

| Path | Who sees it |
|---|---|
| `/` | Public landing page: what the gateway does, how a disbursement works, controls, API, FAQ |
| `/signin`, `/forgot-password` | Public; signed-in people are sent to their own dashboard |
| `/dashboard`, the money screens and `/developers` | Tenant users and tenant admins |
| `/tenant-admin/*` | A tenant's own administrator |
| `/admin/*` | Afrikob staff |

## How auth works

```
Browser ──same-origin, httpOnly cookie + CSRF──▶ Next.js BFF  /api/afrikob/[...path]
                                                   │ session → CSRF → route allowlist → role scope
                                                   │ Cookie: <gateway portal session>
                                                   ▼
                                     Afrikob gateway  /api/v1/*
```

The gateway rejects cross-origin browser calls, so **the browser never calls it directly**. Everything goes through the Next.js backend-for-frontend, which holds the gateway credential server-side.

### One sign-in for everyone

`POST /portal/auth/login` (email, password) → emailed code → `POST /portal/auth/verify-login-code`. The password earns an emailed one-time code and nothing more: the gateway replies `{ requiresVerification, maskedEmail }`, and the server parks a sealed, ten-minute **pending** cookie (`afk_pending`) holding the email and any cookie the gateway set. That cookie is not a session. Only `POST /api/auth/verify-login` with a valid code returns the user and starts the session. The email is taken from the pending cookie, never from the browser, and a wrong code leaves the pending sign-in in place so it can be retried.

The gateway's session cookie is sealed (JWE) inside our own httpOnly cookie, along with role, tenant, and the maker-checker flags `canMake` / `canCheck`. See [ADR-0004](docs/adr/0004-password-sign-in-for-all.md).

### Roles

`platform` (no tenant), `tenant-admin` and `tenant`. A user with no `tenantId` is staff. The login response carries no admin flag, so a tenant user is probed once against `GET tenant-admin/tenant`: 200 promotes them to `tenant-admin`. The proxy tags every route with a scope (`platform`, `tenant-admin` or `money`) and refuses anything outside the role's reach before it leaves the server. `money` belongs to both tenant roles; staff have no tenant context and read movements through Reports. Buttons that submit money (`Send money`, `Collect`, bulk upload, refund requests) are hidden from anyone without `canMake`; the gateway enforces it regardless.

- **Session lifetime:** sessions carry our own TTL (`AFRIKOB_PORTAL_SESSION_MINUTES`, default 60) and slide while someone is working. A 403 from one endpoint never signs anyone out; a 401 does so only after a probe confirms the session is genuinely dead. Look for `session ended by gateway` in the logs, which names the route that ended it.
- **Password reset:** `/forgot-password` drives `forgot-password` → `verify-code` → `reset-password` through `/api/auth/password`, which validates and rate limits (those gateway routes are public, so they cannot use the session-protected proxy).
- **Onboarding a tenant:** only staff create tenants. Creating one reveals its integration key **once**, then asks for the tenant's **first administrator** (`POST admin/users`, `userType: Tenant`, `isTenantAdmin: true`), who signs in and adds the rest of their team.
- **Maker-checker:** actions that need a second approver return 202, and the UI says "Sent for approval" rather than claiming the action is done.

## Design

The interface is built around what these people do: move money and account for it.

- **The money is the hero.** Balances and amounts are the largest type on screen, in tabular figures so columns line up.
- **Structure carries meaning.** A left rail on each record encodes direction (money in, money out, held); state is a dot plus a word, never colour alone.
- **The row stays put.** Records open in a right-hand side sheet, not a centred modal.
- **Layout.** An icon rail on desktop becomes a thumb-reachable tab bar under `lg`; ledgers become stacked records under `md`, showing the leading fields with the rest in the sheet.
- **Type:** Bricolage Grotesque for titles and figures, Public Sans for everything else. Tokens live in [globals.css](src/app/globals.css); chart colours are contrast-validated for both themes.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 App Router, React 19, TypeScript (strict) |
| Server state | TanStack Query v5 (keys in [keys.ts](src/lib/api/keys.ts)) |
| UI state | Zustand (theme, column visibility), persisted per browser |
| Forms | React Hook Form + Zod v4 ([requests.ts](src/lib/api/schemas/requests.ts)) |
| UI | Tailwind v4 tokens, Radix primitives, TanStack Table, Recharts, sonner |
| Tests | Vitest + Testing Library + MSW; Playwright against a stateful mock gateway |

Response models in [models.ts](src/lib/api/schemas/models.ts) mirror the spec's schemas and stay `.loose()`, so added fields never break a page.

## Getting started

```bash
cp .env.example .env.local        # set AFRIKOB_API_URL_TEST and SESSION_SECRET
npm ci
npm run dev                       # http://localhost:3000
```

**Signed out looks like a redirect, not a 401.** The gateway answers an unauthenticated API call with `302` to `/Account/Login`. The proxy therefore calls upstream with `redirect: "manual"` and reads any 3xx as unauthenticated — following it would turn a dead session into a 404 or an HTML page, and could even make a role probe believe a merchant key was staff.

**TLS and the bare IP.** The gateway at `173.225.107.94:3115` presents a public Let's Encrypt certificate issued for `myghcard.com`, so calling it by IP fails verification with `ERR_TLS_CERT_ALTNAME_INVALID` — which Node reports only as `fetch failed`. Set `AFRIKOB_TLS_SERVERNAME=myghcard.com` and the chain and certificate name are still verified while connecting to the IP. `https://myghcard.com:3115` resolves to the same server and works without it. No VPN, no allowlist, no CA pinning.

**Trying it without gateway access** — a mock gateway implements the same contract:

```bash
node tests/e2e/mock-gateway.mjs &  # :4010
AFRIKOB_API_URL_TEST=http://localhost:4010 npm run dev
```

- Afrikob staff: `ops@afrikob.com` / `correct-horse`, then the emailed code `654321`
- Tenant admin: `owner@afikob.com` / `tenant-horse`, same code
- Tenant user: `clerk@afikob.com` / `tenant-clerk`, same code (may submit, not approve)
- Integration key for `POST /auth/token` against the mock: `e2e-tenant-key-0001`

## Scripts

| Command | What it does |
|---|---|
| `npm run check` | lint + typecheck + unit/integration tests |
| `NEXT_DIST_DIR=.next-verify npm run build` | build without touching the `.next` a running `npm run dev` is serving |
| `npm run test:coverage` | Vitest with coverage gates |
| `npm run test:e2e` | builds, starts the mock gateway, runs Playwright (desktop + Pixel 7) |
| `node scripts/capture-responses.mjs` | captures redacted real responses (see below) |

## Endpoint map

| Screen | Gateway endpoints |
|---|---|
| Overview | `tenant/payments/{collection,disbursement}-balance`, `tenant/transactions` |
| Collections | `tenant/transactions`, `tenant/transactions/{id}`, `tenant/payments/collection`, `tenant/payments/get-all-telcos` |
| Disbursements | `tenant/payments/get-all-banks`, `tenant/payments/verify-name`, `tenant/payments/disbursement` |
| Bulk disbursements | `tenant/payments/bulk-name-verify`, `POST/GET tenant/payments/bulk-disbursements`, `…/{batchId}`, `…/reconcile`, `tenant/payments/bulk-disbursement-status` |
| Refunds | switched off (`TENANT_REFUNDS_AVAILABLE` in `src/lib/api/features.ts`): the gateway has no `tenant/` refunds yet |
| Status check | `tenant/payments/status-check` |
| Developers | none: static integration guide, base URL from `AFRIKOB_PUBLIC_API_URL_*` |
| Admin › Tenants | `admin/tenants`, `…/credentials`, `admin/wallets/{id}` (+ `topup`), `…/fees` |
| Admin › People | `admin/users` (+ `{id}`, `activate`, `deactivate`, `set-password`) |
| Admin › Reports | `admin/reports/{collections,disbursements}` and their `/list` variants |
| Admin › Refunds | `admin/refunds`, `…/{id}/approve \| reject \| complete` |
| Admin › Approvals | `admin/approvals` (+ `{id}`, `{id}/decide`), `admin/approval-policies` |
| Tenant admin | `tenant-admin/tenant`, `tenant-admin/users` (+ `{id}`, `activate`, `deactivate`, `set-password`), `tenant-admin/wallets/topup-request`, `tenant-admin/approvals` (+ `{id}`, `{id}/decide`) |

Every staff, tenant-admin and `tenant/` operation is allowlisted in [routes.ts](src/lib/server/routes.ts); report downloads are marked binary and stream through untouched. The unprefixed `payments/*` and `transactions*` answer only an API-key token, so the proxy never forwards them; `tests/unit/spec-coverage.test.ts` fails if the spec gains an operation that is neither proxied nor integration-only, or if a money endpoint loses its `tenant/` copy.

## Validation

The gateway spec declares **no** field constraints (every property nullable, nothing required), so every rule is ours, in [src/lib/validation/fields.ts](src/lib/validation/fields.ts) and [requests.ts](src/lib/api/schemas/requests.ts). Each rule runs **twice**: once in the browser, for instant feedback, and again in the proxy before anything is forwarded. Every write route in [routes.ts](src/lib/server/routes.ts) carries its body schema. The proxy refuses an invalid body with a 400 and field errors. Otherwise it sends only the parsed result: unknown fields are dropped and values normalised. A write route without a schema is sent with no body.

- **Money:** positive, at most 2 decimals, commas allowed, no exponents. Tenant limits: per-payment ≤ daily. Currency comes from a picker (`SUPPORTED_CURRENCIES`, today GHS).
- **Phones:** a country picker (`PhoneInput`) stores contact numbers in E.164. Mobile-money wallets are checked against Ghana's mobile ranges (libphonenumber mobile metadata, so a landline is refused) and sent in national form, `0241234567`.
- **Destinations:** a telco (from `get-all-telcos`) needs a Ghanaian mobile number; a bank needs 6-20 digits. This applies to single disbursements and bulk CSV rows alike.
- **Text:** names, account holders and narrations have fixed character sets. Free text refuses control and bidi-override characters. Emails are trimmed and lower-cased. New passwords need 8+ characters with a letter and a number.
- **Cross-field rules:**
  - A tenant user must name their tenant, and staff must not.
  - SMS notification needs a phone number.
  - Report ranges must run forwards.
  - A paid refund needs the provider reference.
  - A refund can't exceed what's left to refund.
  - A disbursement can't exceed the available balance.

**Responses:**
- Numbers that aren't numbers (blank, "N/A") read as *not available*, never 0.
- Disbursements, collections and bulk batches report their real outcome: completed, accepted (waiting for the provider), sent for approval, or failed. This comes from the envelope `statusCode` and the payload `status`, never a blanket "submitted".
- A failed batch keeps its rows so they can be fixed.
- An approval is read again before anyone decides it, and a person is read again before editing.

## Maker-checker

Actions held for a second pair of eyes come back as **202 with an approval request**. They surface in the **approvals inbox** (`/admin/approvals` for staff, `/tenant-admin/approvals` for a tenant), where the held payload is parsed and shown as labelled rows, and approving runs the original action. Rejecting asks for a reason. The decision controls are hidden from anyone without `canCheck`. A tenant admin's `POST tenant-admin/wallets/topup-request` is the clearest example: it never moves money, it queues a request for Afrikob to decide.

## Endpoints that need tenant context

The gateway has **two copies** of every tenant money endpoint (added 2026-09-25). `payments/*` and `transactions*` answer only a bearer token from an API key, and are what integrators call (the Developers page documents them). `tenant/payments/*` and `tenant/transactions*` answer a tenant user's portal session, and are what this dashboard calls; the prefix lives in one constant, `TENANT` in [endpoints.ts](src/lib/api/endpoints.ts). The refund endpoints have no `tenant/` copy yet. A staff session has no tenant context, so the platform overview is built on `admin/reports/{collections,disbursements}/list`, and Reports is the cross-tenant view. A test in `tests/unit/format-filters.test.ts` keeps tenant-only destinations out of the admin navigation.

## Open items (need gateway access or backend input)

0. **Verify the `tenant/` endpoints with a real tenant session (blocks release).** The live gateway lists them and redirects anonymous calls to its login page (checked 2026-09-25), but nobody has yet called them signed in as a tenant user. Confirm `GET tenant/transactions` and both `tenant/payments/*-balance` answer 200 on the cookie session. Also ask the backend for `tenant/` copies of `payments/{id}/refunds` and `payments/refunds/{id}`; when they land, add the routes and flip `TENANT_REFUNDS_AVAILABLE`. Run `AFRIKOB_E2E_TENANT_EMAIL=… AFRIKOB_E2E_TENANT_PASSWORD=… node --env-file=.env.local scripts/verify-tenant-portal.mjs` and type in the emailed code; it only reads, and prints statuses and shapes, never values.
1. **Confirm the session contract.** Sign in as staff against the real gateway and check the cookie name, attributes and idle timeout, then align `AFRIKOB_PORTAL_SESSION_MINUTES`. Also confirm whether writes need an antiforgery token alongside the cookie — the spec does not mention one.
2. **Verified live on 2026-09-24** (platform admin and a merchant key): the two-step sign-in, `admin/approvals` (list, filter, open), `admin/users`, `admin/tenants`, `admin/refunds`, `admin/reports/*/list`, and every money endpoint on a merchant token. The live gateway issues `tenant_code` (e.g. `T001`) rather than a tenant id, which the session now reads. The `tenant-admin/*` area was verified the same day on the DEMO tenant through a temporary account (since deactivated): all nine endpoints, plus a 1 GHS top-up request raised and rejected, so `approvals/{id}/decide` is confirmed on the rejecting path. Three contract facts came out of that run: `userType` accepts only `Platform` and `Tenant` (anything else is `statusCode: 6`); **portal sessions are refused on every money endpoint**, whoever holds them; and a tenant admin may not decide a `WALLET_TOPUP` — only a platform admin can.

   Earlier findings, still true: an unknown account returns `401 {"statusCode":1,"message":"Invalid email or password."}` and a bad key returns `401 {"statusCode":1,"message":"Invalid API key"}` (a direct call to `/auth/token` answered `statusCode: 5` for the same case, so codes vary by endpoint). With keys injected from your secrets manager:
   ```bash
   AFRIKOB_API_URL=… AFRIKOB_TENANT_KEY=… AFRIKOB_ADMIN_KEY=… node scripts/capture-responses.mjs
   ```
   Use the output to confirm `StatusCode` values 2–7 (only 0 = success and 1 = failure are known), the `userType` values, the `?status=` values for admin refunds, and how long an emailed login code stays valid.
3. **The gateway binds API tokens to the caller's IP** (now an integrator concern only: the portal no longer uses API keys, and the Developers page warns tenants to call from a fixed egress IP). `POST /auth/token` returns a JWT whose `aud` is the public IP that asked for it, and the gateway enforces it. Serverless functions do not hold one outbound IP, so a merchant's token is rejected at random: 3 of 72 live calls (4%) answered 401 while the calls either side succeeded on the same token. Portal sessions are unaffected — the gateway cookie carries no such binding. The retry and the session probe go out from the same instance, so they fail too; an API-key session is therefore never ended by a gateway 401, only by its token's own expiry. The refused call answers 503 and the client's query retry usually lands on an instance that works, but a write is not retried and fails. Raised with the gateway team; the fix is theirs (drop the binding, or allowlist a fixed egress we would then have to buy).
4. **Vercel hosting.** Add a firewall rate-limit rule on `/api/auth/login`, `/api/auth/verify-login` and `/api/auth/password`. Static IPs are not needed: the gateway is reachable from anywhere over `myghcard.com`. Worth asking whether the API should sit behind its own hostname rather than sharing `myghcard.com:3115`.
5. **Server-side list filtering.** `GET /transactions` takes only `page` and `size`, so filtering and page totals apply to the loaded page. Reports are filtered server side and carry the full totals.
6. **No single-record endpoints** for tenants, so tenant details come from the cached list.

## Deployment

- **Vercel:** set the variables from `.env.example`. Server-only values must never use the `NEXT_PUBLIC_` prefix.
- **Container:** `docker build -t afrikob-dashboard .` builds a standalone Next.js server on distroless, running as non-root on port 3000.
