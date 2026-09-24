# ADR-0001: Backend-for-frontend proxy with sealed API-key sessions

**Status**: Accepted
**Date**: 2026-09-16
**Authors**: @vincenttetteh

## Context

The Afrikob gateway authenticates tenants and admins with an API key. The key is exchanged at `POST /api/v1/auth/token` for a JWT, and that JWT is required on every other call.

When we probed the gateway:
- It returned 403 for every unauthenticated path, including paths that don't exist.
- It rejected CORS preflight.

Both point to an IP allowlist. The gateway also has no user or password login, and its Swagger spec declares no response schemas.

## Decision

- **All calls go through the Next.js server.** The browser calls only `/api/afrikob/*` on its own origin, and the server forwards the request to the gateway.
- **Sign-in:** the user enters an API key. The server exchanges it for a JWT and stores the JWT, role, tenant, label and expiry in an encrypted httpOnly cookie (`SameSite=Strict`). The key itself is discarded.
- **Write protection:** writes need a double-submit CSRF token.
- **Proxy checks:** the proxy only allows Swagger operations, blocks `/admin/*` for tenant sessions, and sets `X-Admin-User` from the session.
- **Role detection:** the role comes from JWT claims. When the claims are not conclusive, the server probes an admin-only read.
- **Token expiry:** when the gateway returns 401, the session is cleared and the user signs in again. There is no silent refresh because the key is not kept.

## Consequences

### Positive
- The gateway JWT and host are never exposed to browser JavaScript, and CORS and allowlisting are handled in one place.
- One place to enforce authorization, audit identity, timeouts and logging.
- Works on Vercel and in containers without changes.

### Negative
- Every request makes an extra hop through the Next.js server.
- Users must re-enter their key when the JWT expires.
- The login rate limiter lives in memory, so each serverless instance keeps its own count.

### Risks & Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Vercel egress IPs are not allowlisted | High | High | Vercel Static IPs + allowlist request; local/VPN fallback |
| Self-signed gateway TLS | Med | High | Pinned CA via `AFRIKOB_CA_CERT`; never disable verification |
| Role misdetected (no documented claims) | Med | Low | Admin probe; server-side admin gate; gateway still enforces authz |
| Response shape drift (undocumented) | High | Med | Tolerant normalizers + raw record rendering; Phase 0 capture script |
| Brute-force of API keys | Low | High | Per-IP limiter + Vercel Firewall rule; gateway-side lockout recommended |
