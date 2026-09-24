/**
 * Helpers for reading loosely-shaped payloads: raw records rendered in detail
 * sheets, list payloads that may or may not be wrapped, and status labels.
 * Field lookups accept common casing and naming variants.
 */
export type RawRecord = Record<string, unknown>;

export function asRecord(value: unknown): RawRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RawRecord) : {};
}

function lookup(rec: RawRecord, key: string): unknown {
  if (key in rec) return rec[key];
  const lower = key.toLowerCase();
  const found = Object.keys(rec).find((k) => k.toLowerCase() === lower || k.toLowerCase().replaceAll("_", "") === lower);
  return found ? rec[found] : undefined;
}

export function str(rec: RawRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = lookup(rec, key);
    if (typeof v === "string" && v.trim() !== "" && v !== "null") return v.trim();
    if (typeof v === "number" || typeof v === "bigint") return String(v);
  }
  return null;
}

export function num(rec: RawRecord, ...keys: string[]): number | null {
  for (const key of keys) {
    const v = lookup(rec, key);
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}

export function bool(rec: RawRecord, ...keys: string[]): boolean | null {
  for (const key of keys) {
    const v = lookup(rec, key);
    if (typeof v === "boolean") return v;
    if (v === "true" || v === 1) return true;
    if (v === "false" || v === 0) return false;
  }
  return null;
}

const LIST_KEYS = ["items", "data", "results", "records", "content", "list", "rows", "value"];

/** Finds the array inside a list payload of unknown shape. */
export function findArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const rec = asRecord(value);
  for (const key of LIST_KEYS) {
    const v = lookup(rec, key);
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") {
      const nested = findArray(v);
      if (nested.length > 0) return nested;
    }
  }
  const firstArray = Object.values(rec).find(Array.isArray);
  return (firstArray as unknown[] | undefined) ?? [];
}

export type StatusTone = "success" | "pending" | "failed" | "neutral";

const SUCCESS = /success|complete|approved|paid|settled|active|verified|ok\b/i;
const FAILED = /fail|reject|declin|cancel|error|revers|expired|inactive/i;
const PENDING = /pend|process|initiat|await|queue|submitted|progress|new|requested/i;

/** Maps any status label to a semantic tone for pills and KPI counts. */
export function statusTone(status: string | null | undefined): StatusTone {
  if (!status) return "neutral";
  if (FAILED.test(status)) return "failed";
  if (SUCCESS.test(status)) return "success";
  if (PENDING.test(status)) return "pending";
  return "neutral";
}
