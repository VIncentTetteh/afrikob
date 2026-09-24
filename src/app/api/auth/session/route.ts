import { NextResponse } from "next/server";
import { availableEnvironments } from "@/lib/env";
import { envelopeError } from "@/lib/server/respond";
import { readSession } from "@/lib/server/session";
import { toPublicSession, type PublicSession } from "@/lib/session/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const session = await readSession();
  if (!session) return envelopeError(401, "Not signed in.");
  const body: PublicSession & { environments: string[] } = {
    ...toPublicSession(session),
    environments: availableEnvironments(),
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
