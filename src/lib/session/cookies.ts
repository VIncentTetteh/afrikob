/**
 * Helpers for carrying the gateway's own session cookies. Portal login
 * authenticates with a server-side session, so the proxy must replay the
 * gateway's cookies on every later call and follow any rotation.
 */

/** Reduces Set-Cookie lines to the `name=value; name=value` form a Cookie header needs. */
export function toCookieHeader(setCookies: readonly string[]): string {
  const pairs = new Map<string, string>();
  for (const line of setCookies) {
    const [pair] = line.split(";");
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (name) pairs.set(name, value);
  }
  return [...pairs].map(([n, v]) => `${n}=${v}`).join("; ");
}

/**
 * Merges newly issued cookies into an existing Cookie header, newest winning.
 * A blank value (how a server deletes a cookie) is ignored: it would otherwise
 * strip a working credential, and a genuinely ended session shows up as a 401.
 */
export function mergeCookies(existing: string, setCookies: readonly string[]): string {
  const incoming = toCookieHeader(setCookies);
  if (!incoming) return existing;
  const pairs = new Map<string, string>();
  for (const part of `${existing}; ${incoming}`.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (!name) continue;
    if (!value && pairs.has(name)) continue;
    pairs.set(name, value);
  }
  return [...pairs].map(([n, v]) => `${n}=${v}`).join("; ");
}

/** Reads Set-Cookie headers across runtimes (getSetCookie is Node 20+/undici). */
export function readSetCookies(headers: Headers): string[] {
  const withGetter = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withGetter.getSetCookie === "function") return withGetter.getSetCookie();
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}
