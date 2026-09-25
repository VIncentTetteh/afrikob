"use client";

import { format } from "date-fns";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney, parseDate } from "@/lib/format";

interface DayPoint {
  day: string;
  label: string;
  amount: number;
  count: number;
}

const MAX_DAYS = 14;

/** One dated amount; transactions and report rows both reduce to this. */
export interface VolumePoint {
  date: string | null;
  amount: number | null;
}

export function toDailyVolume(items: VolumePoint[]): DayPoint[] {
  const byDay = new Map<string, DayPoint>();
  for (const item of items) {
    const d = parseDate(item.date);
    if (!d) continue;
    const key = format(d, "yyyy-MM-dd");
    const point = byDay.get(key) ?? { day: key, label: format(d, "dd MMM"), amount: 0, count: 0 };
    point.amount += item.amount ?? 0;
    point.count += 1;
    byDay.set(key, point);
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)).slice(-MAX_DAYS);
}

function VolumeTooltip({ active, point }: { active?: boolean; point?: DayPoint }) {
  if (!active || !point) return null;
  const p = point;
  return (
    <div className="rounded-xl border border-line bg-paper px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold">{p.label}</p>
      <p className="text-ink-soft">
        {formatMoney(p.amount)} · {p.count} txn{p.count === 1 ? "" : "s"}
      </p>
    </div>
  );
}

const compact = new Intl.NumberFormat("en-GH", { notation: "compact", maximumFractionDigits: 1 });

/** Single-series daily volume (no legend needed; the card title names it). Table fallback via sr-only list. */
export function VolumeChart({ items }: { items: VolumePoint[] }) {
  const data = useMemo(() => toDailyVolume(items), [items]);
  if (data.length === 0) {
    return <p className="py-16 text-center text-sm text-ink-soft">No dated transactions to chart yet.</p>;
  }
  return (
    <figure>
      <div className="h-64 sm:h-72" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--ink-soft)", fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => compact.format(v)} tick={{ fill: "var(--ink-soft)", fontSize: 12 }} />
            <Tooltip content={(props) => <VolumeTooltip active={props.active} point={props.payload?.[0]?.payload as DayPoint | undefined} />} cursor={{ fill: "var(--field)" }} />
            <Bar dataKey="amount" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        <table>
          <thead>
            <tr><th>Day</th><th>Volume</th><th>Count</th></tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.day}><td>{d.label}</td><td>{formatMoney(d.amount)}</td><td>{d.count}</td></tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
