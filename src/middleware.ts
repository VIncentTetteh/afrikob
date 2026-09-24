import { NextResponse, type NextRequest } from "next/server";
import { unsealSession } from "@/lib/session/seal";
import { authMode, homeFor, SESSION_COOKIE, type Role } from "@/lib/session/types";

const LANDING = "/";
/** Pages a signed-out visitor may open. */
const PUBLIC_PATHS = ["/signin", "/forgot-password"];
/** Shown to a signed-in session that has nothing it may open. */
const NO_ACCESS = "/no-access";

/** Areas only one role may open. */
const AREAS: { prefix: string; role: Role }[] = [
  { prefix: "/admin", role: "platform" },
  { prefix: "/tenant-admin", role: "tenant-admin" },
];

/** Route guard: unauthenticated users go to /signin; tenants cannot open /admin. */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const secret = process.env.SESSION_SECRET ?? "";
  const session = secret ? await unsealSession(request.cookies.get(SESSION_COOKIE)?.value, secret) : null;
  const active = session && session.exp * 1000 > Date.now() ? session : null;
  const isPublic = pathname === LANDING || PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!active && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    url.search = session ? "?reason=expired" : "";
    return NextResponse.redirect(url);
  }
  // Signed-in people go straight to their own dashboard, landing page included.
  if (active && isPublic) {
    return NextResponse.redirect(new URL(homeFor(active.role, authMode(active)), request.url));
  }
  if (active) {
    const home = homeFor(active.role, authMode(active));
    const area = AREAS.find((a) => pathname === a.prefix || pathname.startsWith(`${a.prefix}/`));
    if (area && active.role !== area.role) {
      return NextResponse.redirect(new URL(home, request.url));
    }
    // The money screens need an API-key session; the gateway refuses the rest.
    const moneyScreen = !pathname.startsWith("/admin") && !pathname.startsWith("/tenant-admin") && pathname !== NO_ACCESS;
    if (moneyScreen && home !== "/dashboard") {
      return NextResponse.redirect(new URL(home, request.url));
    }
    if (pathname === NO_ACCESS && home !== NO_ACCESS) {
      return NextResponse.redirect(new URL(home, request.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|ico|webp)$).*)"],
};
