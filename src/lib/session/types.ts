/**
 * Who is signed in. Everyone signs in with email, password and an emailed code;
 * API keys are for a tenant's own systems calling the gateway, never for this portal.
 * - `platform`: Afrikob staff (no tenant).
 * - `tenant-admin`: a tenant's own administrator: the money screens plus their organisation.
 * - `tenant`: an ordinary tenant portal user, created by an administrator.
 */
export type Role = "platform" | "tenant-admin" | "tenant";

/** Where each role lands after signing in. */
export function homeFor(role: Role): string {
  return role === "platform" ? "/admin" : "/dashboard";
}

/** The approvals inbox this role can actually open. */
export function approvalsHrefFor(role: Role): string {
  return role === "platform" ? "/admin/approvals" : "/tenant-admin/approvals";
}

/**
 * Money screens need tenant context: staff have no tenant and read everyone's
 * movements through reports instead.
 */
export function handlesMoney(role: Role): boolean {
  return role !== "platform";
}
export type Environment = "test" | "live";

/**
 * How the gateway authorises this session's calls: the portal session cookie it
 * set when the emailed code was verified, replayed on every request.
 */
export type UpstreamCredential = { kind: "cookie"; cookie: string };

/** Server-only session payload, sealed inside the httpOnly cookie. */
export interface SessionData {
  credential: UpstreamCredential;
  role: Role;
  env: Environment;
  tenantId: string | null;
  /** Portal user id. */
  userId: string | null;
  /** Display label, also sent as X-Admin-User on audited actions. */
  label: string;
  /** Maker-checker capabilities from the portal user record. */
  canMake: boolean;
  canCheck: boolean;
  /** Unix seconds when this session expires. */
  exp: number;
  /** Unix seconds when the session was issued, used for sliding renewal. */
  iat: number;
}

/** Safe subset exposed to the browser. */
export type PublicSession = Omit<SessionData, "credential" | "iat">;

/**
 * Half-finished portal sign-in: the password was accepted and a code emailed,
 * but no session exists until that code is verified.
 */
export interface PendingLogin {
  email: string;
  env: Environment;
  maskedEmail: string | null;
  /** Cookies the gateway set at the password step, if any, replayed on verification. */
  cookie: string | null;
  exp: number;
}

/** Default idle life of a portal session, in minutes. */
export const DEFAULT_PORTAL_SESSION_MINUTES = 60;

/**
 * A portal session renews once it is past half its life, so someone who keeps
 * working is never signed out mid-task.
 */
export function isRenewable(session: SessionData, now: number): boolean {
  return now > session.iat + (session.exp - session.iat) / 2;
}

/** The same session, its idle window started again from `now`. */
export function renewed(session: SessionData, now: number, ttlSeconds: number): SessionData {
  return { ...session, iat: now, exp: now + ttlSeconds };
}

/**
 * Where to send someone after they sign back in. Only a path within this app is
 * allowed: anything else (an absolute URL, a protocol-relative "//host") would
 * turn the sign-in page into an open redirect.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

export const SESSION_COOKIE = "afk_session";
export const PENDING_COOKIE = "afk_pending";
export const CSRF_COOKIE = "afk_csrf";
export const CSRF_HEADER = "x-csrf-token";

/** Strips the upstream credential before the session is sent to the browser. */
export function toPublicSession(session: SessionData): PublicSession {
  return {
    role: session.role,
    env: session.env,
    tenantId: session.tenantId,
    userId: session.userId,
    label: session.label,
    canMake: session.canMake,
    canCheck: session.canCheck,
    exp: session.exp,
  };
}
