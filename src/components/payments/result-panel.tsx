import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { KeyValueList, recordToItems } from "@/components/domain/key-value-list";
import type { Outcome } from "@/lib/api/outcome";
import { cn } from "@/lib/utils";

const TONES = {
  success: { icon: CheckCircle2, className: "border-settled/25 bg-settled-wash text-settled" },
  pending: { icon: Clock3, className: "border-pending/25 bg-pending-wash text-pending" },
  failed: { icon: XCircle, className: "border-failed/30 bg-failed-wash text-failed" },
} as const;

/** How a money movement ended, in the gateway's own words, with everything it returned. */
export function ResultPanel({ outcome }: { outcome: Outcome<Record<string, unknown>> }) {
  const tone = TONES[outcome.tone];
  return (
    <div className="space-y-4">
      <div role={outcome.tone === "failed" ? "alert" : "status"} className={cn("rounded-lg border px-3 py-2.5 text-sm", tone.className)}>
        <p className="flex items-center gap-2 font-medium">
          <tone.icon className="size-4 shrink-0" aria-hidden />
          {outcome.title}
        </p>
        {outcome.detail && <p className="mt-1 pl-6">{outcome.detail}</p>}
        {outcome.tone === "pending" && (
          <p className="mt-1 pl-6 text-ink-soft">Use Status check with your reference to follow it.</p>
        )}
      </div>
      {outcome.data && <KeyValueList items={recordToItems(outcome.data)} />}
    </div>
  );
}

/** The matching toast: success, a neutral note while it settles, or an error. */
export function toastFor(outcome: Outcome<unknown>): ["success" | "info" | "error", string] {
  return [outcome.tone === "success" ? "success" : outcome.tone === "failed" ? "error" : "info", outcome.title];
}
