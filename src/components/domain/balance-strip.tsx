import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/panel";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface StripFigure {
  label: string;
  value: ReactNode;
  tone?: "default" | "in" | "out" | "settled" | "pending" | "failed";
}

const toneClass = {
  default: "text-ink",
  in: "text-in",
  out: "text-out",
  settled: "text-settled",
  pending: "text-pending",
  failed: "text-failed",
} as const;

interface Props {
  heroLabel: string;
  heroAmount: number | null;
  heroCurrency?: string | null;
  heroNote?: string;
  figures: StripFigure[];
  loading?: boolean;
}

/**
 * One hero figure with supporting numbers, separated by rules rather than
 * boxed into identical cards.
 */
export function BalanceStrip({ heroLabel, heroAmount, heroCurrency, heroNote, figures, loading }: Props) {
  return (
    <section
      aria-label={heroLabel}
      className="flex flex-col gap-5 rounded-[var(--radius-panel)] border border-line bg-paper px-5 py-5 lg:flex-row lg:items-center lg:gap-8"
    >
      <div className="min-w-0 lg:flex-1">
        <p className="text-sm text-ink-soft">{heroLabel}</p>
        {loading ? (
          <Skeleton className="mt-2 h-10 w-56" />
        ) : (
          <p className="figure mt-1 truncate text-[2rem] leading-none sm:text-[2.75rem]">
            {formatMoney(heroAmount, heroCurrency ?? "GHS")}
          </p>
        )}
        {heroNote && <p className="mt-2 text-sm text-ink-soft">{heroNote}</p>}
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 lg:flex lg:divide-x lg:divide-line">
        {figures.map((figure) => (
          <div key={figure.label} className="min-w-0 lg:px-6 lg:first:pl-0 lg:last:pr-0">
            <dt className="truncate text-sm text-ink-soft">{figure.label}</dt>
            {loading ? (
              <Skeleton className="mt-1.5 h-6 w-16" />
            ) : (
              <dd className={cn("figure mt-1 truncate text-xl sm:text-2xl", toneClass[figure.tone ?? "default"])}>{figure.value}</dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}
