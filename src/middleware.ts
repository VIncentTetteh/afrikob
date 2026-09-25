import { NextResponse, type NextRequest } from "next/server";
import { TENANT_REFUNDS_AVAILABLE } from "@/lib/api/features";
import { sealSession, unsealSession } from "@/lib/session/seal";
import {
  DEFAULT_PORTAL_SESSION_MINUTES,
  handlesMoney,
  homeFor,
  isRenewable,
  renewed,
  safeNextPath,
  SESSION_COOKIE,
  type Role,
  type SessionData,
} from "@/lib/session/types";

const LANDING = "/";
/** Pages a signed-out visitor may open. */
const PUBLIC_PATHS = ["/signin", "/forgot-password"];
/** Screens that do not exist (or are switched off); bookmarks land on home instead. */
const RETIRED = ["/no-access", ...(TENANT_REFUNDS_AVAILABLE ? [] : ["/refunds"])];
const isRetired = (pathname: string) => RETIRED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/** Areas only one role may open. */
const AREAS: { prefix: string; role: Role }[] = [
  { prefix: "/admin", role: "platform" },
  { prefix: "/tenant-admin", role: "tenant-admin" },
];

function sessionTtlSeconds(): number {
  const minutes = Number(process.env.AFRIKOB_PORTAL_SESSION_MINUTES);
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_PORTAL_SESSION_MINUTES) * 60;
}

/**
 * Renews the session on ordinary navigation. Without this only data calls kept
 * a session alive, so someone reading a long page could be signed out mid-task.
 */
async function withRenewal(response: NextResponse, session: SessionData, secret: string): Promise<NextResponse> {
  const now = Math.floor(Date.now() / 1000);
  if (!isRenewable(session, now)) return response;
  const next = renewed(session, now, sessionTtlSeconds());
  response.cookies.set(SESSION_COOKIE, await sealSession(next, secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: next.exp - now,
  });
  return response;
}

/** Route guard: unauthenticated users go to /signin; tenants cannot open /admin. */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const secret = process.env.SESSION_SECRET ?? "";
  // An expired seal no longer decrypts, so the cookie's presence is what marks
  // someone as having been signed in rather than never signed in at all.
  const sealed = request.cookies.get(SESSION_COOKIE)?.value;
  const session = secret && sealed ? await unsealSession(sealed, secret) : null;
  const active = session && session.exp * 1000 > Date.now() ? session : null;
  const isPublic = pathname === LANDING || PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!active && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    // Keep where they were headed, so signing back in returns them there.
    const back = `${pathname}${request.nextUrl.search}`;
    url.search = new URLSearchParams({ ...(sealed ? { reason: "expired" } : {}), next: back }).toString();
    return NextResponse.redirect(url);
  }
  // Signed-in people go straight to their own dashboard, landing page included.
  if (active && isPublic) {
    const home = homeFor(active.role);
    const back = safeNextPath(request.nextUrl.searchParams.get("next"));
    return await withRenewal(NextResponse.redirect(new URL(back ?? home, request.url)), active, secret);
  }
  if (active) {
    const home = homeFor(active.role);
    if (isRetired(pathname)) return NextResponse.redirect(new URL(home, request.url));
    const area = AREAS.find((a) => pathname === a.prefix || pathname.startsWith(`${a.prefix}/`));
    if (area && active.role !== area.role) {
      return NextResponse.redirect(new URL(home, request.url));
    }
    // Everything outside /admin is a tenant's own screen, except the shared
    // integration guide, which staff use to onboard a tenant's developers.
    const tenantScreen = pathname !== "/admin" && !pathname.startsWith("/admin/") && pathname !== "/developers";
    if (tenantScreen && !handlesMoney(active.role)) {
      return NextResponse.redirect(new URL(home, request.url));
    }
    return await withRenewal(NextResponse.next(), active, secret);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|ico|webp)$).*)"],
};
