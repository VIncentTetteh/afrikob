import { cn } from "@/lib/utils";

/**
 * Afrikob mark: two chevrons forming a wing, reading as money moving out and
 * settling back in.
 */
export function Logo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 28 28" className="size-7 shrink-0" aria-hidden>
        <path d="M3 18.5 11 6l4.5 7.2" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12.5 22 20.5 9.5 25 22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
      </svg>
      {showWordmark && <span className="font-display text-base font-semibold tracking-tight">Afrikob</span>}
    </span>
  );
}
