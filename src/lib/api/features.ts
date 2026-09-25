/**
 * Tenant features the gateway does not yet serve to a portal session.
 *
 * Refunds: `payments/{id}/refunds` and `payments/refunds/{id}` have no `tenant/`
 * copy yet, so a tenant user's password session is refused there. Flip this on
 * (and add the routes in routes.ts and endpoints.ts) once the gateway adds them.
 */
export const TENANT_REFUNDS_AVAILABLE = false;
