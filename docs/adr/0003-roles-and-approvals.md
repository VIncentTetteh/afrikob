# ADR-0003: Three roles, and where held actions live

**Status**: Accepted
**Date**: 2026-09-24
**Authors**: @vincenttetteh
**Extends**: ADR-0002 (one session, two gateway credentials)

## Context

The gateway grew to 67 operations, adding an **approvals inbox** (`admin/approvals`, `tenant-admin/approvals`) and a **tenant-admin area** where a tenant's own administrator manages their people, sees their tenant and asks for funds.

Two problems followed. First, `Role = "admin" | "tenant"` could not express a tenant's administrator, who is neither Afrikob staff nor an ordinary merchant. Second, maker-checker was half-built: actions already came back as 202 "sent for approval", but nothing could list or decide them, so a held action simply vanished from view.

## Decision

- **Three roles:** `platform` (no tenant), `tenant-admin` (a tenant's administrator) and `tenant` (an ordinary tenant portal user, or an API key).
- **Detection stays a probe.** `PortalUserResponse` still carries no admin flag, so a tenant-scoped user is asked once against `GET tenant-admin/tenant`; 200 promotes them. This mirrors the API-key probe already in place, and keeps role out of guessable `userType` strings.
- **Routes carry a scope,** not a boolean: `platform`, `tenant-admin` or `money`. The proxy refuses anything outside the signed-in role before the request leaves our server, and the middleware guards the matching areas of the UI.
- **One approvals inbox, two scopes.** The same component and endpoint functions serve both, differing only in path. The held payload (`rawPayloadJson`) is parsed and rendered as labelled rows with money formatted; anything that will not parse is shown verbatim rather than hidden.
- **`X-Admin-User` is no longer sent.** The gateway dropped the parameter and identifies the actor from the session, so nothing about the caller now travels in a header.

## Consequences

### Positive
- A tenant can run itself — its own people, its own approvals — without Afrikob doing it for them.
- Held actions are visible and decidable, so maker-checker is a workflow rather than a dead end.
- Scope-per-route makes "who may call this" a property of the route table, checked in one place and covered by tests.

### Negative
- One extra request at sign-in for tenant-scoped users (the promotion probe).
- The role model now has to be kept in step with the gateway's own idea of permissions, which the spec still does not state outright.

### Confirmed against the live gateway (2026-09-24)
- The password step returns `{ requiresVerification, maskedEmail }`; the code is single-use, and only `verify-login-code` sets the session cookie.
- A platform admin's `userType` is `Platform` with a null `tenantId`, which the role model reads as staff.
- The gateway redirects unauthenticated API calls to `/Account/Login` (302) instead of answering 401, so the proxy reads any 3xx as signed out.
- Merchant tokens carry `tenant_code`, not a tenant id.
- `rawPayloadJson` arrives PascalCase (`Amount`, `Currency`, `WalletType`) and renders correctly through the generic parser.

### Risks & Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| The probe misjudges a role | Low | Low | The gateway enforces its own authorization; a wrong guess only hides or shows UI, and the proxy refuses out-of-scope calls anyway |
| Approval status strings differ from our tabs | Med | Low | Tabs pass the value straight through as `?status=`; the "All" tab always works |
| `rawPayloadJson` shape varies by action | High | Low | Parsed generically into labelled rows, with a verbatim fallback |
| A tenant admin expects platform powers | Low | Med | Middleware and proxy both refuse, and the navigation never offers them |
