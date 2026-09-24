import { statusTone, type StatusTone } from "@/lib/api/schemas/normalize";
import { cn } from "@/lib/utils";

const toneDot: Record<StatusTone, string> = {
  success: "bg-settled",
  pending: "bg-pending",
  failed: "bg-failed",
  neutral: "bg-ink-faint",
};

const toneText: Record<StatusTone, string> = {
  success: "text-settled",
  pending: "text-pending",
  failed: "text-failed",
  neutral: "text-ink-soft",
};

/** State reads as a dot plus a word, so it never depends on color alone. */
export function State({ status, className }: { status: string | null; className?: string }) {
  const tone = statusTone(status);
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap", toneText[tone], className)}>
      <span className={cn("size-1.5 rounded-full", toneDot[tone])} aria-hidden />
      {status ? status.toLowerCase().replaceAll("_", " ") : "unknown"}
    </span>
  );
}

export type Direction = "in" | "out" | "held";

const directionRail: Record<Direction, string> = {
  in: "bg-in",
  out: "bg-out",
  held: "bg-ink-faint",
};

/** Vertical rail encoding the direction money moved. */
export function DirectionRail({ direction, className }: { direction: Direction; className?: string }) {
  const label = direction === "in" ? "Money in" : direction === "out" ? "Money out" : "Held";
  return <span title={label} aria-label={label} role="img" className={cn("block w-1 shrink-0 rounded-full", directionRail[direction], className)} />;
}

export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md bg-field px-2 py-0.5 text-xs font-medium text-ink-soft", className)}>
      {children}
    </span>
  );
}
