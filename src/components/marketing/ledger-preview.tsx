import { cn } from "@/lib/utils";

interface Row {
  name: string;
  detail: string;
  amount: string;
  state: "settled" | "in flight" | "failed";
  direction: "in" | "out";
}

const ROWS: Row[] = [
  { name: "Ama Mensah", detail: "MTN · 024****567", amount: "+GHS 1,250.00", state: "settled", direction: "in" },
  { name: "Kofi Boateng", detail: "GCB · 851****680", amount: "−GHS 4,800.00", state: "in flight", direction: "out" },
  { name: "Payroll · 128 people", detail: "Bulk payout", amount: "−GHS 96,400.00", state: "settled", direction: "out" },
  { name: "Esi Owusu", detail: "Telecel · 055****111", amount: "+GHS 320.00", state: "failed", direction: "in" },
];

const stateColor = {
  settled: "text-[var(--settled)]",
  "in flight": "text-[var(--pending)]",
  failed: "text-[var(--failed)]",
} as const;

const stateDot = {
  settled: "bg-[var(--settled)]",
  "in flight": "bg-[var(--pending)]",
  failed: "bg-[var(--failed)]",
} as const;

/** A still of the ledger: the balance figure, then the money that moved. */
export function LedgerPreview({ className }: { className?: string }) {
  return (
    <figure
      className={cn(
        "overflow-hidden rounded-xl border border-white/12 bg-white/[0.04] text-pitch-ink",
        className,
      )}
      aria-label="A merchant's ledger: available balance and recent payments"
    >
      <div className="flex items-end justify-between gap-4 border-b border-white/12 px-5 py-4">
        <div>
          <p className="text-xs text-pitch-soft">Available to pay out</p>
          <p className="figure mt-0.5 text-[1.75rem] leading-none">GHS 1,284,905.40</p>
        </div>
        <p className="text-xs text-pitch-soft">
          <span className="figure text-[var(--settled)]">+4.1%</span> this week
        </p>
      </div>
      <ul className="divide-y divide-white/12">
        {ROWS.map((row) => (
          <li key={row.name} className="flex items-center gap-3 px-5 py-3">
            <span
              aria-hidden
              className={cn("h-7 w-1 shrink-0 rounded-full", row.direction === "in" ? "bg-[var(--in)]" : "bg-[var(--out)]")}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{row.name}</span>
              <span className="block truncate text-xs text-pitch-soft">{row.detail}</span>
            </span>
            <span className="text-right">
              <span className="figure block text-sm">{row.amount}</span>
              <span className={cn("mt-0.5 flex items-center justify-end gap-1.5 text-xs", stateColor[row.state])}>
                <span className={cn("size-1.5 rounded-full", stateDot[row.state])} aria-hidden />
                {row.state}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
