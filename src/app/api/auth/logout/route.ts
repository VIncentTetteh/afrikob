import { NextResponse } from "next/server";
import { logger } from "@/lib/server/logger";
import { clearSession, readSession } from "@/lib/server/session";
import { callUpstream } from "@/lib/server/upstream";

/** Ends the gateway session too, so a portal login cannot be replayed after sign-out. */
export async function POST(): Promise<NextResponse> {
  const session = await readSession();
  if (session?.credential.kind === "cookie") {
    try {
      const res = await callUpstream({
        env: session.env,
        method: "POST",
        path: "portal/auth/logout",
        headers: { Cookie: session.credential.cookie },
      });
      await res.body?.cancel();
    } catch (error) {
      // Local sign-out must still succeed if the gateway is unreachable.
      logger.warn("upstream logout failed", { error: error instanceof Error ? error.message : String(error) });
    }
  }
  await clearSession();
  return NextResponse.json({ ok: true });
}
