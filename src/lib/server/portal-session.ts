import "server-only";
import type { NextResponse } from "next/server";
import type { ApiEnvironment } from "@/lib/env";
import { toIdentity, withTenantAdmin, type PortalUser } from "@/lib/session/portal";
import { callUpstream } from "./upstream";
import type { SessionData } from "@/lib/session/types";
import { nowSeconds, portalSessionExpiry } from "./session";

/**
 * The login response carries no admin flag, so a tenant-scoped user is asked
 * once whether the tenant-admin area answers to them.
 */
export async function probeTenantAdmin(env: ApiEnvironment, cookie: string): Promise<boolean> {
  try {
    const res = await callUpstream({ env, method: "GET", path: "tenant-admin/tenant", headers: { Cookie: cookie } });
    await res.body?.cancel();
    return res.ok;
  } catch {
    return false;
  }
}

/** Turns a verified portal user plus the gateway's session cookie into our session. */
export async function buildPortalSession(env: ApiEnvironment, cookie: string, user: PortalUser): Promise<SessionData> {
  const base = toIdentity(user);
  const identity = base.role === "tenant" ? withTenantAdmin(base, await probeTenantAdmin(env, cookie)) : base;
  const iat = nowSeconds();
  return {
    credential: { kind: "cookie", cookie },
    role: identity.role,
    env,
    tenantId: identity.tenantId,
    userId: identity.userId,
    label: identity.label,
    canMake: identity.canMake,
    canCheck: identity.canCheck,
    iat,
    exp: portalSessionExpiry(iat),
  };
}

export interface PendingLoginResult {
  requiresVerification: true;
  maskedEmail: string | null;
  expiresIn: number;
}

export type LoginOutcome =
  | { session: SessionData; pending?: undefined; error?: undefined }
  | { pending: PendingLoginResult; session?: undefined; error?: undefined }
  | { error: NextResponse; session?: undefined; pending?: undefined };
