import { format, isValid, parse, parseISO } from "date-fns";

const DISPLAY_DATE = "dd/MM/yyyy HH:mm";
const FALLBACK = "N/A";

/** Parses ISO or dd/MM/yyyy[ HH:mm] strings; returns null if unparseable. */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const iso = parseISO(value);
  if (isValid(iso)) return iso;
  for (const pattern of ["dd/MM/yyyy HH:mm:ss", "dd/MM/yyyy HH:mm", "dd/MM/yyyy"]) {
    const d = parse(value, pattern, new Date());
    if (isValid(d)) return d;
  }
  return null;
}

export function formatDate(value: string | null | undefined): string {
  const d = parseDate(value);
  return d ? format(d, DISPLAY_DATE) : (value ?? FALLBACK);
}

const moneyFormatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(amount: number | null | undefined, currency?: string | null): string {
  // An amount the gateway did not send shows as zero, as money columns read best that way.
  if (amount === null || amount === undefined || !Number.isFinite(amount)) amount = 0;
  const code = (currency || "GHS").toUpperCase();
  let fmt = moneyFormatters.get(code);
  if (!fmt) {
    try {
      fmt = new Intl.NumberFormat("en-GH", { style: "currency", currency: code, currencyDisplay: "code" });
    } catch {
      fmt = new Intl.NumberFormat("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    moneyFormatters.set(code, fmt);
  }
  return fmt.format(amount).replace(/ /g, " ");
}

export function formatNumber(n: number | null | undefined): string {
  return n === null || n === undefined ? FALLBACK : new Intl.NumberFormat("en-GH").format(n);
}

export function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return FALLBACK;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * "customerFeeValue" → "Customer Fee Value", and "WALLET_TOPUP" → "Wallet Topup":
 * the gateway shouts its action keys and wallet types, which reads badly in a UI.
 */
export function humanize(key: string): string {
  return (/[a-z]/.test(key) ? key : key.toLowerCase())
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
