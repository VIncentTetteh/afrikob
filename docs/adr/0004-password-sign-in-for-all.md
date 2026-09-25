# ADR-0004: Password sign-in for everyone; API keys only for integrations

**Status**: Accepted
**Date**: 2026-09-25
**Authors**: @vincenttetteh
**Supersedes**: the bearer-credential half of ADR-0002, and the money-by-credential decision of ADR-0003

## Context

The dashboard let merchants sign in by pasting their gateway API key, which the server exchanged at `POST /auth/token` for a bearer JWT. That rested on a misunderstanding of the product, which the business has since corrected:

- **Staff, tenant administrators and tenant users all sign in with email and password** (plus the emailed code). Tenant users are created by an Afrikob administrator (`POST admin/users`, `userType: Tenant`) or by their own tenant administrator (`POST tenant-admin/users`).
- **API keys are for a tenant's own systems** calling the gateway. They are not a way into the portal.

ADR-0003 recorded that the live gateway refused money endpoints for any portal session. The gateway team has since changed that so a tenant user's portal session carries tenant context. The spec itself (`docs/api/swagger-v1.json`) did not change: it was byte-identical to the live copy on 2026-09-25.

API-key sessions also caused a production problem. Tokens are bound to the IP that minted them, serverless instances do not share an outbound IP, and merchants were signed out at random (ADR-0003, open item 3).

## Decision

- **One credential kind.** `UpstreamCredential` is the gateway's portal session cookie only. The API-key branch of `/api/auth/login`, the JWT claims reader and the bearer 503 workaround in the proxy are removed.
- **Money goes by role.** `mayUse(role, "money")` is true for `tenant` and `tenant-admin` and false for `platform`, which has no tenant context and uses reports.
- **Homes.** `platform` lands on `/admin`. Both tenant roles land on `/dashboard`. A tenant administrator also sees an **Organisation** section (`/tenant-admin/*`). `/no-access` is retired and redirects home.
- **Old sessions end.** A sealed session whose credential is not a cookie fails to unseal, so any API-key session still open at deploy time reads as signed out and returns to `/signin?reason=expired`.
- **Maker permission in the UI.** Submit actions (send money, collect, bulk upload, refund request) are hidden when `canMake` is false.
- **Keys stay with integrations.**
  - Staff issue them from the tenant record, under "Integration keys".
  - Creating a tenant now continues straight into adding its **first administrator**, so someone can sign in.
  - Tenants get a **Developers** page: base URL, token exchange, samples, endpoint list, and the IP-binding warning.
  - The gateway has no endpoint for tenants to list, rotate or revoke keys, so the page says keys come from Afrikob.

### Amendment (2026-09-25, later the same day)

Live testing showed the gateway still refused `payments/*` and `transactions*` for a tenant portal session. Instead of changing those endpoints, the backend added portal copies under **`tenant/`** (`tenant/transactions`, `tenant/payments/*`), with the same contracts. The dashboard calls the `tenant/` copies. The unprefixed endpoints remain for API-key integrations, which the proxy never forwards. Refunds have no `tenant/` copy yet, so the tenant refund UI is switched off by `TENANT_REFUNDS_AVAILABLE`.

## Consequences

### Positive
- One sign-in path to secure, rate limit and test.
- The random sign-outs caused by IP-bound tokens disappear from the portal.
- Tenant users get individual, auditable accounts instead of sharing a key, and a tenant's administrator controls who can do what.

### Negative
- Everyone signed in with an API key at deploy time is signed out once.
- A tenant whose administrator has not been created yet cannot reach the portal. The onboarding flow now prompts for one.

### Risks & Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| The gateway still refuses tenant portal sessions on money routes | Med | High | Release is blocked on a live check with a tenant test account (README, open item 0). The proxy's probe keeps a refused call from signing the user out. |
| Staff reach a tenant screen and see 401s | Low | Low | Middleware redirects staff to `/admin`, and the proxy refuses `money` for `platform` before calling the gateway |
| Integrators hit IP-bound token failures | Med | Med | The Developers page tells them to call from a fixed egress and re-mint on 401 |
