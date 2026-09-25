import { EncryptJWT, jwtDecrypt } from "jose";
import type { PendingLogin, SessionData, UpstreamCredential } from "./types";

const ALG = "dir";
const ENC = "A256GCM";

async function deriveKey(secret: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return new Uint8Array(digest);
}

/**
 * Only a portal cookie is a valid credential. A session sealed before API-key
 * sign-in was retired carries `kind: "bearer"` and now reads as signed out.
 */
function isCredential(value: unknown): value is UpstreamCredential {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return c.kind === "cookie" && typeof c.cookie === "string" && c.cookie.length > 0;
}

/** Encrypts session data into a compact JWE. Works in both Node and Edge runtimes. */
export async function sealSession(data: SessionData, secret: string): Promise<string> {
  const key = await deriveKey(secret);
  return new EncryptJWT({ ...data })
    .setProtectedHeader({ alg: ALG, enc: ENC })
    .setIssuedAt(data.iat)
    .setExpirationTime(data.exp)
    .encrypt(key);
}

/** Decrypts a session JWE. Returns null when missing, tampered, malformed or expired. */
export async function unsealSession(
  token: string | undefined,
  secret: string,
): Promise<SessionData | null> {
  if (!token) return null;
  try {
    const key = await deriveKey(secret);
    const { payload } = await jwtDecrypt(token, key, { keyManagementAlgorithms: [ALG] });
    const s = payload as unknown as SessionData;
    if (!isCredential(s.credential)) return null;
    if (s.role !== "platform" && s.role !== "tenant-admin" && s.role !== "tenant") return null;
    return {
      credential: s.credential,
      role: s.role,
      env: s.env,
      tenantId: s.tenantId ?? null,
      userId: s.userId ?? null,
      label: s.label,
      canMake: s.canMake ?? true,
      canCheck: s.canCheck ?? true,
      exp: s.exp,
      iat: s.iat ?? Math.floor(Date.now() / 1000),
    };
  } catch {
    return null;
  }
}

/** Seals the half-finished sign-in that is waiting on an emailed code. */
export async function sealPending(data: PendingLogin, secret: string): Promise<string> {
  const key = await deriveKey(secret);
  return new EncryptJWT({ ...data })
    .setProtectedHeader({ alg: ALG, enc: ENC })
    .setIssuedAt()
    .setExpirationTime(data.exp)
    .encrypt(key);
}

export async function unsealPending(token: string | undefined, secret: string): Promise<PendingLogin | null> {
  if (!token) return null;
  try {
    const key = await deriveKey(secret);
    const { payload } = await jwtDecrypt(token, key, { keyManagementAlgorithms: [ALG] });
    const p = payload as unknown as PendingLogin;
    if (typeof p.email !== "string" || !p.email) return null;
    return { email: p.email, env: p.env, maskedEmail: p.maskedEmail ?? null, cookie: p.cookie ?? null, exp: p.exp };
  } catch {
    return null;
  }
}
