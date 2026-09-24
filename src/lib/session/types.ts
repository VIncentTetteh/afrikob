/**
 * Who is signed in:
 * - `platform`: Afrikob staff (no tenant).
 * - `tenant-admin`: a tenant's own administrator, who also gets the money screens.
 * - `tenant`: an ordinary tenant portal user, or an API-key session.
 */
export type Role = "platform" | "tenant-admin" | "tenant";

/**
 * Where each session lands after signing in. An ordinary tenant user who signed
 * in with a password has nothing to use: the gateway refuses money endpoints for
 * a password session, and tenant administration is not theirs.
 */
export function homeFor(role: Role, mode: AuthMode = "apikey"): string {
  if (role === "platform") return "/admin";
  if (role === "tenant-admin") return "/tenant-admin";
  return mode === "apikey" ? "/dashboard" : "/no-access";
}

/** The approvals inbox this role can actually open. */
export function approvalsHrefFor(role: Role): string {
  return role === "platform" ? "/admin/approvals" : "/tenant-admin/approvals";
}

/** Only an API-key session may move money; the gateway refuses password sessions. */
export function handlesMoney(mode: AuthMode): boolean {
  return mode === "apikey";
}
export type Environment = "test" | "live";
export type AuthMode = "portal" | "apikey";

/**
 * How the gateway authorises this session's calls.
 * - `cookie`: portal (email/password) login — the gateway keeps a server-side session.
 * - `bearer`: tenant API key exchanged at /auth/token for a JWT.
 */
export type UpstreamCredential =
  | { kind: "cookie"; cookie: string }
  | { kind: "bearer"; jwt: string };

/** Server-only session payload, sealed inside the httpOnly cookie. */
export interface SessionData {
  credential: UpstreamCredential;
  role: Role;
  env: Environment;
  tenantId: string | null;
  /** Portal user id; absent for API-key sessions. */
  userId: string | null;
  /** Display label, also sent as X-Admin-User on audited actions. */
  label: string;
  /** Maker-checker capabilities (portal users only; API keys may do both). */
  canMake: boolean;
  canCheck: boolean;
  /** Unix seconds when this session expires. */
  exp: number;
  /** Unix seconds when the session was issued, used for sliding renewal. */
  iat: number;
}

/** Safe subset exposed to the browser. */
export type PublicSession = Omit<SessionData, "credential" | "iat"> & { mode: AuthMode };

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

export const SESSION_COOKIE = "afk_session";
export const PENDING_COOKIE = "afk_pending";
export const CSRF_COOKIE = "afk_csrf";
export const CSRF_HEADER = "x-csrf-token";

export function authMode(session: Pick<SessionData, "credential">): AuthMode {
  return session.credential.kind === "cookie" ? "portal" : "apikey";
}

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
    mode: authMode(session),
  };
}
