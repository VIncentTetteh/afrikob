"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";
import { ActivityBar } from "@/components/layout/activity-bar";
import { CommandBar } from "@/components/layout/command-bar";
import { Rail, TabBar } from "@/components/layout/rail";
import { ApiError } from "@/lib/api/errors";
import { signInHref, useSession } from "@/lib/api/session";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { data: session, error } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  // Only a 401 is a sign-out. Anything else (offline, a cold-start 502, a fetch
  // cancelled by the laptop sleeping) is transient and must not evict someone
  // whose session is still perfectly good.
  const signedOut = error instanceof ApiError && error.status === 401;

  useEffect(() => {
    if (signedOut) router.replace(signInHref("expired", pathname));
  }, [signedOut, router, pathname]);

  if (!session) {
    return (
      <div className="grid min-h-dvh place-items-center" role="status">
        <Loader2 className="size-7 animate-spin text-accent" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh">
      <Suspense fallback={null}>
        <ActivityBar />
      </Suspense>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-paper focus:p-3"
      >
        Skip to content
      </a>
      <Rail session={session} />
      <div className="flex min-w-0 flex-1 flex-col">
        <CommandBar session={session} />
        <main id="main" className="mx-auto w-full max-w-[1600px] flex-1 space-y-5 px-4 py-5 sm:px-6 sm:py-7">
          {children}
        </main>
        <TabBar session={session} />
      </div>
    </div>
  );
}
