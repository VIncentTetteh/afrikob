import { vi } from "vitest";

export interface CookieRecord {
  name: string;
  value: string;
  options?: Record<string, unknown>;
}

/** In-memory replacement for next/headers cookies(). */
export const cookieJar = new Map<string, CookieRecord>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookieJar.get(name),
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      cookieJar.set(name, { name, value, options });
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));

export const callUpstream = vi.fn<(req: Record<string, unknown>) => Promise<Response>>();
vi.mock("@/lib/server/upstream", () => ({ callUpstream: (req: Record<string, unknown>) => callUpstream(req) }));

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
