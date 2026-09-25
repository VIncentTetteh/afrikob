// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "@/middleware";
import { sealSession } from "@/lib/session/seal";
import type { Role } from "@/lib/session/types";

const SECRET = process.env.SESSION_SECRET as string;

async function req(path: string, role?: Role, expired = false, aged = false) {
  const headers: Record<string, string> = {};
  if (role) {
    const now = Math.floor(Date.now() / 1000);
    const session = {
      credential: { kind: "cookie", cookie: "afk.portal=abc" } as const,
      role,
      env: "test" as const,
      tenantId: null,
      userId: null,
      label: "x",
      canMake: true,
      canCheck: true,
      // `aged` puts the session past half its life, where renewal kicks in.
      iat: now - (aged ? 590 : 0),
      exp: expired ? now - 10 : now + (aged ? 10 : 600),
    };
    headers.cookie = `afk_session=${await sealSession(session, SECRET)}`;
  }
  return middleware(new NextRequest(`http://localhost${path}`, { headers }));
}

const location = (res: Response) => res.headers.get("location");

describe("middleware", () => {
  it("redirects anonymous users to sign-in", async () => {
    expect(location(await req("/collections"))).toBe("http://localhost/signin?next=%2Fcollections");
    expect(location(await req("/dashboard"))).toBe("http://localhost/signin?next=%2Fdashboard");
    expect((await req("/signin")).headers.get("x-middleware-next")).toBe("1");
  });

  it("marks expired sessions", async () => {
    // An expired sealed cookie fails decryption (exp claim) and is treated as anonymous.
    expect(location(await req("/collections", "tenant", true))).toMatch(/\/signin/);
  });

  it("keeps tenants out of /admin and sends signed-in users away from public pages", async () => {
    expect(location(await req("/admin/tenants", "tenant"))).toBe("http://localhost/dashboard");
    expect(location(await req("/signin", "tenant"))).toBe("http://localhost/dashboard");
    expect(location(await req("/signin", "platform"))).toBe("http://localhost/admin");
    expect(location(await req("/signin", "tenant-admin"))).toBe("http://localhost/dashboard");
    expect((await req("/collections", "tenant")).headers.get("x-middleware-next")).toBe("1");
  });

  it("sends signed-in people from the landing page to their own dashboard", async () => {
    expect(location(await req("/", "platform"))).toBe("http://localhost/admin");
    expect(location(await req("/", "tenant"))).toBe("http://localhost/dashboard");
    expect(location(await req("/", "tenant-admin"))).toBe("http://localhost/dashboard");
    expect((await req("/admin/refunds", "platform")).headers.get("x-middleware-next")).toBe("1");
  });

  it("opens the money screens and Developers to every tenant user signed in with a password", async () => {
    for (const role of ["tenant", "tenant-admin"] as const) {
      for (const path of ["/dashboard", "/collections", "/disbursements/bulk", "/developers"]) {
        expect((await req(path, role)).headers.get("x-middleware-next")).toBe("1");
      }
    }
    // Refunds are switched off until the gateway adds tenant/ refunds.
    expect(location(await req("/refunds", "tenant"))).toBe("http://localhost/dashboard");
    // The retired "nothing for you here" page sends people home instead.
    expect(location(await req("/no-access", "tenant"))).toBe("http://localhost/dashboard");
    expect(location(await req("/no-access", "platform"))).toBe("http://localhost/admin");
  });

  it("keeps each area to its own role", async () => {
    // A tenant admin runs their own business, not the platform.
    expect(location(await req("/admin/tenants", "tenant-admin"))).toBe("http://localhost/dashboard");
    // An ordinary tenant user has no tenant administration.
    expect(location(await req("/tenant-admin/people", "tenant"))).toBe("http://localhost/dashboard");
    // Afrikob staff have no tenant context, so the money screens are not theirs.
    expect(location(await req("/collections", "platform"))).toBe("http://localhost/admin");
    // The integration guide is shared: staff use it to onboard a tenant's developers.
    expect((await req("/developers", "platform")).headers.get("x-middleware-next")).toBe("1");
    expect(location(await req("/tenant-admin", "platform"))).toBe("http://localhost/admin");
    expect((await req("/tenant-admin/approvals", "tenant-admin")).headers.get("x-middleware-next")).toBe("1");
  });
});

describe("staying signed in", () => {
  it("keeps where someone was headed, and returns them there after signing in", async () => {
    // Denied while signed out: the destination rides along.
    expect(location(await req("/admin/approvals?status=Pending"))).toBe(
      "http://localhost/signin?next=%2Fadmin%2Fapprovals%3Fstatus%3DPending",
    );
    // Expired says so, and still keeps the destination.
    const expiredRes = location(await req("/admin/refunds", "platform", true));
    expect(expiredRes).toContain("reason=expired");
    expect(expiredRes).toContain("next=%2Fadmin%2Frefunds");
    // Signing in with a destination lands there rather than at the generic home.
    expect(location(await req("/signin?next=%2Fadmin%2Frefunds", "platform"))).toBe("http://localhost/admin/refunds");
  });

  it("refuses to be turned into an open redirect", async () => {
    for (const evil of ["https://evil.example/x", "//evil.example/x", "/\\evil.example"]) {
      const res = location(await req(`/signin?next=${encodeURIComponent(evil)}`, "platform"));
      expect(res).toBe("http://localhost/admin");
    }
  });

  it("renews a portal session that is past half its life, on ordinary navigation", async () => {
    const fresh = await req("/admin", "platform");
    expect(fresh.headers.getSetCookie().join()).not.toContain("afk_session");

    const aged = await req("/admin", "platform", false, true);
    const cookie = aged.headers.getSetCookie().find((c) => c.startsWith("afk_session="));
    expect(cookie).toBeDefined();
    expect(cookie).toContain("SameSite=lax");

    // A tenant user's password session renews the same way.
    const tenant = await req("/dashboard", "tenant", false, true);
    expect(tenant.headers.getSetCookie().some((c) => c.startsWith("afk_session="))).toBe(true);
  });
});
