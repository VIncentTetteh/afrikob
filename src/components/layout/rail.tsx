"use client";

import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Logo } from "./logo";
import { activeHref, navFor, primaryNavFor } from "./nav";
import type { ClientSession } from "@/lib/api/session";
import { homeFor } from "@/lib/session/types";
import { cn } from "@/lib/utils";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0";

/** Persistent icon rail on desktop; the tab bar below replaces it on phones. */
export function Rail({ session }: { session: ClientSession }) {
  const pathname = usePathname();
  const sections = navFor(session.role);
  const active = activeHref(pathname, sections);

  return (
    <aside className="sticky top-0 hidden h-dvh w-[5.5rem] shrink-0 flex-col items-center border-r border-line bg-paper py-4 lg:flex">
      <Link href={homeFor(session.role)} aria-label="Afrikob home" className="mb-5">
        <Logo showWordmark={false} />
      </Link>
      <nav aria-label="Main" className="flex w-full flex-1 flex-col gap-5 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.title} className="flex flex-col items-center gap-1">
            {section.items.map((item) => {
              const isActive = active === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex w-[4.25rem] flex-col items-center gap-1 rounded-lg px-1 py-2 text-[0.6875rem] leading-tight transition-colors",
                    isActive ? "bg-accent-wash text-accent" : "text-ink-soft hover:bg-field hover:text-ink",
                  )}
                >
                  <item.icon className="size-5" aria-hidden />
                  <span className="text-center">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <p className="pt-3 text-[0.6875rem] text-ink-faint">v{APP_VERSION}</p>
    </aside>
  );
}

const TAB_BAR_SLOTS = 4;

/**
 * Thumb-reachable tab bar under lg. The busiest destinations sit on the bar and
 * everything else lives behind More, so nothing is unreachable on a phone.
 */
export function TabBar({ session }: { session: ClientSession }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const sections = navFor(session.role);
  const active = activeHref(pathname, sections);
  const items = primaryNavFor(session.role).slice(0, TAB_BAR_SLOTS);
  const onBar = new Set(items.map((i) => i.href));
  const rest = sections.flatMap((s) => s.items).filter((i) => !onBar.has(i.href));

  const tabClass = (isActive: boolean) =>
    cn("flex flex-1 flex-col items-center gap-1 px-1 py-2.5 text-[0.6875rem]", isActive ? "text-accent" : "text-ink-soft");

  return (
    <>
      <nav
        aria-label="Main"
        className="sticky bottom-0 z-30 flex border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {items.map((item) => {
          const isActive = active === item.href;
          return (
            <Link key={item.href} href={item.href} aria-current={isActive ? "page" : undefined} className={tabClass(isActive)}>
              <item.icon className="size-5" aria-hidden />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
        {rest.length > 0 && (
          <button
            onClick={() => setMoreOpen(true)}
            className={tabClass(Boolean(active && !onBar.has(active)))}
            aria-haspopup="dialog"
          >
            <LayoutGrid className="size-5" aria-hidden />
            <span>More</span>
          </button>
        )}
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen} title="Everywhere else" description="The rest of your workspace">
        <ul className="divide-y divide-line">
          {rest.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setMoreOpen(false)}
                aria-current={active === item.href ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 py-3 text-sm",
                  active === item.href ? "text-accent" : "text-ink hover:text-accent",
                )}
              >
                <item.icon className="size-5 shrink-0 text-ink-soft" aria-hidden />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
