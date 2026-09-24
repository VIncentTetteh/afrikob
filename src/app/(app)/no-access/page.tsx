"use client";

import { LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody } from "@/components/ui/panel";
import { useLogout, useSession } from "@/lib/api/session";

/**
 * A tenant user who signed in with a password: the gateway allows them neither
 * the money endpoints (those need the tenant's API key) nor tenant
 * administration, so the honest thing is to say so.
 */
export default function NoAccessPage() {
  const { data: session } = useSession();
  const logout = useLogout();

  return (
    <Panel className="mx-auto max-w-lg">
      <PanelBody className="flex flex-col items-center gap-3 py-12 text-center">
        <LifeBuoy className="size-7 text-ink-soft" aria-hidden />
        <h1 className="text-xl font-semibold">Nothing is assigned to you yet</h1>
        <p className="max-w-sm text-sm text-ink-soft">
          You are signed in{session?.label ? ` as ${session.label}` : ""}, but this account has no area to work in.
          Ask an administrator at your business to make you a tenant administrator, or use your API key to reach the
          payment screens.
        </p>
        <Button variant="outline" className="mt-2" onClick={() => logout.mutate()} loading={logout.isPending}>
          Sign out
        </Button>
      </PanelBody>
    </Panel>
  );
}
