"use client";

import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/** Short requests finish before this, so the bar does not flicker on every click. */
const SHOW_AFTER_MS = 150;

/**
 * A thin bar across the top of the screen while anything is in flight: data
 * loading or refreshing, a save, or a page opening after a link is clicked.
 */
export function ActivityBar() {
  const fetching = useIsFetching();
  const saving = useIsMutating();
  const pathname = usePathname();
  const search = useSearchParams();
  const [navigating, setNavigating] = useState(false);

  // The App Router has no "navigation started" event: a click on an internal
  // link starts the bar, and the new pathname arriving stops it.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as HTMLElement | null)?.closest("a");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setNavigating(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => setNavigating(false), [pathname, search]);

  const busy = navigating || fetching > 0 || saving > 0;
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!busy) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [busy]);

  return (
    <>
      <div
        aria-hidden
        className={`activity-bar pointer-events-none fixed inset-x-0 top-0 z-[70] h-0.5 overflow-hidden transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
      >
        <div className="activity-bar__runner h-full w-1/3 bg-accent" />
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {visible ? (saving > 0 ? "Saving…" : "Loading…") : ""}
      </p>
    </>
  );
}
