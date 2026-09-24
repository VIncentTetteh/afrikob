// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "@/middleware";
import { sealSession } from "@/lib/session/seal";
import type { Role } from "@/lib/session/types";

const SECRET = process.env.SESSION_SECRET as string;

async function req(path: string, role?: Role, expired = false) {
  const headers: Record<string, string> = {};
  if (role) {
    const now = Math.floor(Date.now() / 1000);
    const session = {
      credential:
        role === "tenant" ? ({ kind: "bearer", jwt: "j" } as const) : ({ kind: "cookie", cookie: "afk.portal=abc" } as const),
      role,
      env: "test" as const,
      tenantId: null,
      userId: null,
      label: "x",
      canMake: true,
      canCheck: true,
      iat: now,
      exp: now + (expired ? -10 : 600),
    };
    headers.cookie = `afk_session=${await sealSession(session, SECRET)}`;
  }
  return middleware(new NextRequest(`http://localhost${path}`, { headers }));
}

const location = (res: Response) => res.headers.get("location");

describe("middleware", () => {
  it("redirects anonymous users to sign-in", async () => {
    expect(location(await req("/collections"))).toBe("http://localhost/signin");
    expect(location(await req("/dashboard"))).toBe("http://localhost/signin");
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
    expect(location(await req("/signin", "tenant-admin"))).toBe("http://localhost/tenant-admin");
    expect((await req("/collections", "tenant")).headers.get("x-middleware-next")).toBe("1");
  });

  it("sends signed-in people from the landing page to their own dashboard", async () => {
    expect(location(await req("/", "platform"))).toBe("http://localhost/admin");
    expect(location(await req("/", "tenant"))).toBe("http://localhost/dashboard");
    expect(location(await req("/", "tenant-admin"))).toBe("http://localhost/tenant-admin");
    expect((await req("/admin/refunds", "platform")).headers.get("x-middleware-next")).toBe("1");
  });

  it("keeps each area to its own role", async () => {
    // A tenant admin runs their own business, not the platform.
    expect(location(await req("/admin/tenants", "tenant-admin"))).toBe("http://localhost/tenant-admin");
    // An ordinary tenant user has no tenant administration.
    expect(location(await req("/tenant-admin/people", "tenant"))).toBe("http://localhost/dashboard");
    // Afrikob staff have no tenant context, so the money screens are not theirs.
    expect(location(await req("/collections", "platform"))).toBe("http://localhost/admin");
    expect((await req("/tenant-admin/approvals", "tenant-admin")).headers.get("x-middleware-next")).toBe("1");
    expect((await req("/collections", "tenant-admin")).headers.get("x-middleware-next")).toBe("1");
  });
});
