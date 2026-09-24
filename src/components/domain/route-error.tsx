"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * Shown when a screen throws. It names what failed without leaking internals,
 * and always offers a way onward.
 */
export function RouteError({
  error,
  reset,
  title = "This screen hit a problem",
  homeHref = "/",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  homeHref?: string;
}) {
  useEffect(() => {
    // Surfaces in the browser console and in server logs via Next's reporting.
    console.error("route error", error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex max-w-lg flex-col items-center gap-3 px-5 py-20 text-center">
      <AlertTriangle className="size-7 text-failed" aria-hidden />
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-ink-soft">
        Nothing was lost. Try again, and if it keeps happening quote this reference to support.
      </p>
      {error.digest && <p className="text-xs text-ink-faint">Reference {error.digest}</p>}
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RotateCcw /> Try again
        </Button>
        <Link href={homeHref} className={buttonVariants({ variant: "outline" })}>
          Go back
        </Link>
      </div>
    </div>
  );
}
