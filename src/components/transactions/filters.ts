import { statusTone, type StatusTone } from "@/lib/api/schemas/normalize";
import { transactionKind, type Transaction, type TransactionKind } from "@/lib/api/schemas/models";
import type { Direction } from "@/components/ui/state";
import { parseDate } from "@/lib/format";

export interface TxFilters {
  tone: StatusTone | "all";
  from: string;
  to: string;
}

export const EMPTY_FILTERS: TxFilters = { tone: "all", from: "", to: "" };

/**
 * Narrows a page to one kind. If no row carries a recognisable type, the page
 * is shown as-is rather than appearing empty.
 */
export function filterByKind(items: Transaction[], kind?: TransactionKind): Transaction[] {
  if (!kind) return items;
  const typed = items.some((t) => transactionKind(t.type) !== "other");
  return typed ? items.filter((t) => transactionKind(t.type) === kind) : items;
}

export function applyFilters(items: Transaction[], f: TxFilters): Transaction[] {
  const from = f.from ? new Date(`${f.from}T00:00:00`) : null;
  const to = f.to ? new Date(`${f.to}T23:59:59`) : null;
  return items.filter((t) => {
    if (f.tone !== "all" && statusTone(t.status) !== f.tone) return false;
    if (from || to) {
      const d = parseDate(t.createdAt);
      if (!d) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
    }
    return true;
  });
}

export function countByTone(items: Transaction[]): Record<StatusTone, number> {
  const counts: Record<StatusTone, number> = { success: 0, pending: 0, failed: 0, neutral: 0 };
  for (const t of items) counts[statusTone(t.status)] += 1;
  return counts;
}

export function activeFilterCount(f: TxFilters): number {
  return (f.tone !== "all" ? 1 : 0) + (f.from ? 1 : 0) + (f.to ? 1 : 0);
}

/** Direction of money for the ledger rail. */
export function directionOf(t: Transaction): Direction {
  const kind = transactionKind(t.type);
  if (kind === "collection") return "in";
  if (kind === "disbursement" || kind === "refund") return "out";
  return "held";
}

/** Total value of the rows that settled. */
export function settledTotal(items: Transaction[]): number {
  return items.filter((t) => statusTone(t.status) === "success").reduce((sum, t) => sum + (t.amount ?? 0), 0);
}
