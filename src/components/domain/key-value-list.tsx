import type { ReactNode } from "react";
import { display, humanize } from "@/lib/format";

export interface KvItem {
  label: string;
  value: ReactNode;
}

/** Record fields as label/value rows separated by hairlines. */
export function KeyValueList({ items }: { items: KvItem[] }) {
  return (
    <dl className="divide-y divide-line">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
          <dt className="shrink-0 text-sm text-ink-soft">{item.label}</dt>
          <dd className="break-words text-sm sm:text-right">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const HIDDEN_KEYS = new Set(["password", "secret", "apikey", "token"]);

/** Renders every field of a record, for payloads shown verbatim. */
export function recordToItems(record: Record<string, unknown>): KvItem[] {
  return Object.entries(record)
    .filter(([k]) => !HIDDEN_KEYS.has(k.toLowerCase()))
    .map(([k, v]) => ({
      label: humanize(k),
      value:
        v && typeof v === "object" ? (
          <code className="block max-w-full whitespace-pre-wrap text-left text-xs">{JSON.stringify(v, null, 2)}</code>
        ) : (
          display(v)
        ),
    }));
}
