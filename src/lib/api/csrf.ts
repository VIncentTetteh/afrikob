import { CSRF_COOKIE } from "@/lib/session/types";

/** Reads the double-submit CSRF token from document.cookie (browser only). */
export function readCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${CSRF_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(CSRF_COOKIE.length + 1)) : null;
}
