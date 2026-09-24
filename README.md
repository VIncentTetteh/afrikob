# Afrikob Pay Dashboard

Admin console and merchant portal for the **Afrikob Payment Gateway** (Swagger v1, kept at [docs/api/swagger-v1.json](docs/api/swagger-v1.json)).

Three audiences share one console:

- **Afrikob staff** (no tenant) run the platform: tenants, API keys, wallet funding, fees, people, refunds, reports, approval rules and the **approvals inbox**.
- **A tenant's own administrator** gets the money screens **plus** their tenant: its limits and wallets, their own people, their approvals inbox, and requesting funds.
- **Merchants** (an API key, or an ordinary tenant portal user) get the money screens: overview, collections, payouts (single and bulk CSV), refunds and status checks.

## Routes

| Path | Who sees it |
|---|---|
| `/` | Public landing page: what the gateway does, how a payout works, controls, API, FAQ |
| `/signin`, `/forgot-password` | Public; signed-in people are sent to their own dashboard |
| `/dashboard` and the money screens | Merchants and tenant admins |
| `/tenant-admin/*` | A tenant's own administrator |
| `/admin/*` | Afrikob staff |

## How auth works

```
Browser ──same-origin, httpOnly cookie + CSRF──▶ Next.js BFF  /api/afrikob/[...path]
                                                   │ session → CSRF → route allowlist → admin gate
                                                   │ staff:    Cookie: <gateway session>
                                                   │ merchant: Authorization: Bearer <jwt>
                                                   ▼
                                     Afrikob gateway  /api/v1/*
```

The gateway rejects cross-origin browser calls, so **the browser never calls it directly**. Everything goes through the Next.js backend-for-frontend, which holds the gateway credential server-side:

### Roles

`platform` (no tenant), `tenant-admin` (a tenant's administrator) and `tenant` (an ordinary tenant user or an API key). The login response carries no admin flag, so a tenant-scoped user is probed once against `GET tenant-admin/tenant`: 200 promotes them to `tenant-admin`. The proxy tags every route with a scope — `platform`, `tenant-admin` or `money` — and refuses anything outside the signed-in session's reach before it leaves the server. `platform` and `tenant-admin` go by role; **`money` goes by credential**: the gateway answers 401 on `payments/*` and `transactions*` for any password session, so only an API-key sign-in gets the money screens. A password-only tenant user lands on `/no-access`, which says so.

| Who | Sign-in | Credential the proxy replays |
|---|---|---|
| Afrikob staff | `POST /portal/auth/login` (email, password) → emailed code → `POST /portal/auth/verify-login-code` | the gateway's **session cookie** |
| Merchant | API key → `POST /auth/token` | a **bearer JWT** |

**Staff sign-in is two steps.** The password earns an emailed one-time code and nothing more: the gateway replies `{ requiresVerification, maskedEmail }`, and the server parks a sealed, ten-minute **pending** cookie (`afk_pending`) holding the email and any cookie the gateway set. That cookie is not a session — middleware still treats the person as signed out. Only `POST /api/auth/verify-login` with a valid code returns the user and starts the session. The email is taken from the pending cookie, never from the browser, and a wrong code leaves the pending sign-in in place so it can be retried.

Both are sealed (JWE) inside our own httpOnly cookie, along with role, tenant, and the maker-checker flags `canMake` / `canCheck`. See [ADR-0002](docs/adr/0002-dual-credential-session.md).

- **Session lifetime:** staff sessions carry our own TTL (`AFRIKOB_PORTAL_SESSION_MINUTES`, default 60) and slide while someone is working. A 403 from one endpoint never signs anyone out; a 401 does so only after a probe confirms the session is genuinely dead. Look for `session ended by gateway` in the logs, which names the route that ended it.
- **Password reset:** `/forgot-password` drives `forgot-password` → `verify-code` → `reset-password` through `/api/auth/password`, which validates and rate limits (those gateway routes are public, so they cannot use the session-protected proxy).
- **Only admins create tenants.** Creating one reveals its API key **once**.
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
- Merchant API key: `e2e-tenant-key-0001`

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
| Overview | `payments/{collection,disbursement}-balance`, `transactions` |
| Collections | `transactions`, `transactions/{id}`, `payments/collection`, `payments/get-all-telcos` |
| Payouts | `payments/get-all-banks`, `payments/verify-name`, `payments/disbursement` |
| Bulk payouts | `payments/bulk-name-verify`, `POST/GET payments/bulk-disbursements`, `…/{batchId}`, `…/reconcile`, `payments/bulk-disbursement-status` |
| Refunds | `payments/{txId}/refunds`, `payments/refunds/{id}` |
| Status check | `payments/status-check` |
| Admin › Tenants | `admin/tenants`, `…/credentials`, `admin/wallets/{id}` (+ `topup`), `…/fees` |
| Admin › People | `admin/users` (+ `{id}`, `activate`, `deactivate`, `set-password`) |
| Admin › Reports | `admin/reports/{collections,disbursements}` and their `/list` variants |
| Admin › Refunds | `admin/refunds`, `…/{id}/approve \| reject \| complete` |
| Admin › Approvals | `admin/approvals` (+ `{id}`, `{id}/decide`), `admin/approval-policies` |
| Tenant admin | `tenant-admin/tenant`, `tenant-admin/users` (+ `{id}`, `activate`, `deactivate`, `set-password`), `tenant-admin/wallets/topup-request`, `tenant-admin/approvals` (+ `{id}`, `{id}/decide`) |

All 60 non-auth operations are allowlisted in [routes.ts](src/lib/server/routes.ts); report downloads are marked binary and stream through untouched.

## Maker-checker

Actions held for a second pair of eyes come back as **202 with an approval request**. They surface in the **approvals inbox** (`/admin/approvals` for staff, `/tenant-admin/approvals` for a tenant), where the held payload is parsed and shown as labelled rows, and approving runs the original action. Rejecting asks for a reason. The decision controls are hidden from anyone without `canCheck`. A tenant admin's `POST tenant-admin/wallets/topup-request` is the clearest example: it never moves money, it queues a request for Afrikob to decide.

## Endpoints that need tenant context

`GET /transactions`, `GET /transactions/{id}`, `payments/collection-balance` and `payments/disbursement-balance` need an **API key session**: with any portal cookie session — staff or tenant admin — the gateway answers 401, so those screens are offered only to a merchant sign-in. The platform overview is built on `admin/reports/{collections,disbursements}/list` instead, balances appear only for merchant sessions, and there is no cross-tenant transaction list — Reports is that view. A test in `tests/unit/format-filters.test.ts` keeps tenant-only destinations out of the admin navigation.

## Open items (need gateway access or backend input)

1. **Confirm the session contract.** Sign in as staff against the real gateway and check the cookie name, attributes and idle timeout, then align `AFRIKOB_PORTAL_SESSION_MINUTES`. Also confirm whether writes need an antiforgery token alongside the cookie — the spec does not mention one.
2. **Verified live on 2026-09-24** (platform admin and a merchant key): the two-step sign-in, `admin/approvals` (list, filter, open), `admin/users`, `admin/tenants`, `admin/refunds`, `admin/reports/*/list`, and every money endpoint on a merchant token. The live gateway issues `tenant_code` (e.g. `T001`) rather than a tenant id, which the session now reads. The `tenant-admin/*` area was verified the same day on the DEMO tenant through a temporary account (since deactivated): all nine endpoints, plus a 1 GHS top-up request raised and rejected, so `approvals/{id}/decide` is confirmed on the rejecting path. Three contract facts came out of that run: `userType` accepts only `Platform` and `Tenant` (anything else is `statusCode: 6`); **portal sessions are refused on every money endpoint**, whoever holds them; and a tenant admin may not decide a `WALLET_TOPUP` — only a platform admin can.

   Earlier findings, still true: an unknown account returns `401 {"statusCode":1,"message":"Invalid email or password."}` and a bad key returns `401 {"statusCode":1,"message":"Invalid API key"}` (a direct call to `/auth/token` answered `statusCode: 5` for the same case, so codes vary by endpoint). With keys injected from your secrets manager:
   ```bash
   AFRIKOB_API_URL=… AFRIKOB_TENANT_KEY=… AFRIKOB_ADMIN_KEY=… node scripts/capture-responses.mjs
   ```
   Use the output to confirm `StatusCode` values 2–7 (only 0 = success and 1 = failure are known), the `userType` values, the `?status=` values for admin refunds, and how long an emailed login code stays valid.
3. **Vercel hosting.** Add a firewall rate-limit rule on `/api/auth/login`, `/api/auth/verify-login` and `/api/auth/password`. Static IPs are not needed: the gateway is reachable from anywhere over `myghcard.com`. Worth asking whether the API should sit behind its own hostname rather than sharing `myghcard.com:3115`.
4. **Server-side list filtering.** `GET /transactions` takes only `page` and `size`, so filtering and page totals apply to the loaded page. Reports are filtered server side and carry the full totals.
5. **No single-record endpoints** for tenants, so tenant details come from the cached list.

## Deployment

- **Vercel:** set the variables from `.env.example`. Server-only values must never use the `NEXT_PUBLIC_` prefix.
- **Container:** `docker build -t afrikob-dashboard .` builds a standalone Next.js server on distroless, running as non-root on port 3000.
