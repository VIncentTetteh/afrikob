# ADR-0002: One session, two gateway credentials

**Status**: Accepted (bearer credential superseded by ADR-0004)
**Date**: 2026-09-21
**Authors**: @vincenttetteh
**Supersedes the auth half of**: ADR-0001

## Context

The gateway now authenticates two kinds of caller differently:

- **Afrikob staff** sign in at `POST /portal/auth/login` with an email and password. That step only emails a one-time code and returns `{ requiresVerification, maskedEmail }`; `POST /portal/auth/verify-login-code` returns the user and starts the gateway's **server-side session**, identified afterwards by a session cookie.
- **Merchants** still exchange an API key at `POST /auth/token` for a **bearer JWT**.

The dashboard has to serve both, and the gateway remains IP-allowlisted, so the browser cannot call it at all.

## Decision

The session stores a tagged credential:

```ts
type UpstreamCredential =
  | { kind: "cookie"; cookie: string }   // staff: the gateway's session
  | { kind: "bearer"; jwt: string };     // merchant: JWT from an API key
```

- `POST /api/auth/login` accepts either `{ email, password }` or `{ apiKey }`. An API key yields a session straight away; a password yields only a sealed, ten-minute **pending** cookie (`afk_pending`) holding the email, environment and any cookie the gateway set. A pending cookie is not a session, so the person stays signed out.
- `POST /api/auth/verify-login` sends the emailed code with the pending email — taken from the cookie, never the browser — and only a valid code writes the session. A wrong code keeps the pending sign-in so it can be retried; an expired one returns 419 and the UI restarts at the password step. Both steps are rate limited per address.
- Neither the gateway cookie nor the JWT ever reaches browser JavaScript.
- The proxy sends `Cookie:` or `Authorization: Bearer` based on `credential.kind`; everything above it is unchanged.
- **Rotation:** any `Set-Cookie` on a proxied response replaces the stored cookie, so a gateway that rolls its session keeps working.
- **Lifetime:** a gateway session exposes no expiry, so our cookie carries its own (`AFRIKOB_PORTAL_SESSION_MINUTES`, default 60) and is re-sealed past half-life while someone is working.
- **Ending a session is deliberate.** A 403 never ends it — that is one call being refused. A 401 ends it only after a probe of an endpoint the role always owns (`admin/tenants`, or `payments/get-all-banks`) also fails; if the probe succeeds the original call is reported as refused instead. Signing someone out mid-task because one endpoint disagreed is worse than showing them an error.
- **Sign-out** calls `/portal/auth/logout` with the cookie first, so the gateway session dies with ours.
- **Password reset** (`forgot-password` → `verify-code` → `reset-password`) is relayed by `/api/auth/password`, which validates and rate limits: those gateway routes are public and cannot go through the session-protected proxy.

## Consequences

### Positive
- One session model serves both audiences; pages, hooks and the proxy know nothing about which is in play.
- Staff sessions can be ended centrally on the gateway; merchant sessions still expire with their JWT.
- Maker-checker data (`canMake`, `canCheck`) arrives with the login and drives which actions render.

### Negative
- Our session expiry is a guess until the gateway's idle timeout is confirmed; too long means a dead session is discovered on the next call rather than up front.
- Staff must sign in again when the gateway's session ends, because nothing is stored to renew it silently.

### Risks & Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Gateway expects an antiforgery token with its cookie | Med | High | Not in the spec; confirm on first live run, then capture and echo it in the proxy |
| Our TTL outlives the gateway's session | Med | Low | Upstream 401/403 clears the session; align `AFRIKOB_PORTAL_SESSION_MINUTES` once known |
| Cookie attributes vary by environment (Secure, SameSite) | Low | Med | Only `name=value` pairs are stored and replayed server side, so attributes do not matter |
| `userType` values are undocumented | Med | Low | Anything admin-like maps to admin; the gateway still enforces authorization |
| Emailed code lifetime unknown | Med | Low | Our pending cookie lasts ten minutes; if the gateway's code lives longer the person simply restarts the password step |
| A gateway that skips verification | Low | Med | `requiresVerification: false` signs in directly when the response also carries the user and a cookie; otherwise it is refused rather than guessed |
