import "server-only";
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env";
import { sealPending, sealSession, unsealPending, unsealSession } from "@/lib/session/seal";
import { CSRF_COOKIE, PENDING_COOKIE, SESSION_COOKIE, type PendingLogin, type SessionData } from "@/lib/session/types";

const isProd = process.env.NODE_ENV === "production";

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** How long someone has to enter the emailed code before starting over. */
export const PENDING_LOGIN_SECONDS = 10 * 60;

/** Expiry for a fresh portal session (the gateway's own session has no readable expiry). */
export function portalSessionExpiry(from = nowSeconds()): number {
  return from + serverEnv().AFRIKOB_PORTAL_SESSION_MINUTES * 60;
}

/** Reads and decrypts the current session from cookies. */
export async function readSession(): Promise<SessionData | null> {
  const store = await cookies();
  const session = await unsealSession(store.get(SESSION_COOKIE)?.value, serverEnv().SESSION_SECRET);
  if (!session || session.exp <= nowSeconds()) return null;
  return session;
}

/** Writes the sealed session cookie plus a double-submit CSRF cookie. */
export async function writeSession(data: SessionData, options: { rotateCsrf?: boolean } = {}): Promise<void> {
  const store = await cookies();
  const maxAge = Math.max(0, data.exp - nowSeconds());
  store.set(SESSION_COOKIE, await sealSession(data, serverEnv().SESSION_SECRET), {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    path: "/",
    maxAge,
  });
  if (options.rotateCsrf !== false || !store.get(CSRF_COOKIE)) {
    store.set(CSRF_COOKIE, crypto.randomUUID(), {
      httpOnly: false,
      secure: isProd,
      sameSite: "strict",
      path: "/",
      maxAge,
    });
  }
}

/**
 * Sliding window: once a portal session is past half its life, re-issue it so
 * an active operator is not signed out mid-task. Bearer sessions expire with
 * their JWT, so they are left alone.
 */
export async function slideSession(session: SessionData, changed = false): Promise<void> {
  const isPortal = session.credential.kind === "cookie";
  const halfLife = session.iat + (session.exp - session.iat) / 2;
  const stale = isPortal && nowSeconds() > halfLife;
  if (!stale && !changed) return;
  const iat = nowSeconds();
  await writeSession({ ...session, iat, exp: stale ? portalSessionExpiry(iat) : session.exp }, { rotateCsrf: false });
}

/** Holds a password-verified sign-in while its emailed code is outstanding. */
export async function writePendingLogin(data: PendingLogin): Promise<void> {
  const store = await cookies();
  store.set(PENDING_COOKIE, await sealPending(data, serverEnv().SESSION_SECRET), {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    path: "/",
    maxAge: Math.max(0, data.exp - nowSeconds()),
  });
}

export async function readPendingLogin(): Promise<PendingLogin | null> {
  const store = await cookies();
  const pending = await unsealPending(store.get(PENDING_COOKIE)?.value, serverEnv().SESSION_SECRET);
  if (!pending || pending.exp <= nowSeconds()) return null;
  return pending;
}

export async function clearPendingLogin(): Promise<void> {
  const store = await cookies();
  store.delete(PENDING_COOKIE);
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(CSRF_COOKIE);
  store.delete(PENDING_COOKIE);
}

/** Length-safe comparison of the CSRF cookie and header. */
export async function verifyCsrf(headerValue: string | null): Promise<boolean> {
  const store = await cookies();
  const cookieValue = store.get(CSRF_COOKIE)?.value;
  if (!cookieValue || !headerValue || cookieValue.length !== headerValue.length) return false;
  let diff = 0;
  for (let i = 0; i < cookieValue.length; i++) diff |= cookieValue.charCodeAt(i) ^ headerValue.charCodeAt(i);
  return diff === 0;
}
