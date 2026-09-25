import { isValidPhoneNumber, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
// The mobile build knows which ranges are mobile: with it, "valid" means "a valid
// mobile number", which the default build (no type data) cannot tell.
import { parsePhoneNumberFromString as parseMobileNumber } from "libphonenumber-js/mobile";
import { z } from "zod";

/**
 * Field validators for a money-moving application. The gateway spec declares no
 * constraints at all (every property is nullable, nothing is required), so these
 * are the only line of defence before a request leaves the browser. The BFF
 * re-parses nothing, so anything that must hold is checked here.
 */

/** Currencies the gateway settles. Extend when the gateway adds one. */
export const SUPPORTED_CURRENCIES = ["GHS"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

/** Largest single amount the UI will submit; the gateway enforces tenant limits on top. */
export const MAX_AMOUNT = 1_000_000_000;
const AMOUNT_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
/** Characters no field should ever carry: C0 controls, DEL, and bidi overrides used to disguise text. */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/;

const cleanNumberText = (v: unknown) => (typeof v === "number" ? String(v) : typeof v === "string" ? v.trim().replaceAll(",", "") : v);

/**
 * A positive money amount with at most two decimal places. Accepts "1,250.50"
 * and rejects exponents ("1e3"), signs, blanks and anything past `max`.
 */
export function amount(label = "Amount", max = MAX_AMOUNT) {
  return z.preprocess(
    cleanNumberText,
    z
      .string({ error: `Enter ${label.toLowerCase()}` })
      .min(1, `Enter ${label.toLowerCase()}`)
      .regex(AMOUNT_PATTERN, "Use a number with at most 2 decimal places")
      .transform(Number)
      .refine((n) => n > 0, "Must be greater than 0")
      .refine((n) => n <= max, `Must be at most ${max.toLocaleString("en-GH")}`),
  );
}

/** An optional limit: blank means "no limit"; otherwise zero or more, two decimals. */
export function optionalLimit(label: string) {
  return z.preprocess(
    (v) => {
      const cleaned = cleanNumberText(v);
      return cleaned === "" || cleaned === null ? undefined : cleaned;
    },
    z
      .string()
      .regex(AMOUNT_PATTERN, `${label}: use a number with at most 2 decimal places`)
      .transform(Number)
      .refine((n) => n <= MAX_AMOUNT, `${label} is too large`)
      .optional(),
  );
}

export const currency = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.enum(SUPPORTED_CURRENCIES, { error: `Use ${SUPPORTED_CURRENCIES.join(" or ")}` }))
  .default("GHS");

const noControlChars = (v: string) => !CONTROL_CHARS.test(v);

/** Free text (notes, reasons): any printable characters, trimmed, bounded. */
export function text(label: string, max: number, { required = true } = {}) {
  const base = z
    .string()
    .trim()
    .max(max, `${label} is too long (max ${max})`)
    .refine(noControlChars, `${label} contains characters that are not allowed`);
  return required
    ? base.refine((v) => v.length > 0, `${label} is required`)
    : base.transform((v) => (v ? v : undefined)).optional();
}

/** A person's name: letters (any script), spaces, apostrophes, dots and hyphens. */
export function personName(label = "Name") {
  return z
    .string()
    .trim()
    .min(2, `${label} is too short`)
    .max(100, `${label} is too long`)
    .regex(/^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u, `${label} may only contain letters, spaces, ' . and -`);
}

/** The name on a bank account or wallet, which may be a business. */
export function accountHolder(label = "Account name") {
  return z
    .string()
    .trim()
    .min(2, `${label} is too short`)
    .max(150, `${label} is too long`)
    .regex(/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}' .,&()/-]*$/u, `${label} contains characters that are not allowed`);
}

/** A payment narration or reference, as shown on a statement. */
export function narration(label = "Reference", max = 100) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} is too long (max ${max})`)
    .regex(/^[\p{L}\p{N} .,_\-/#:()&']+$/u, `${label} may only contain letters, numbers, spaces and . , _ - / # : ( ) & '`);
}

/** Our own id for a payment: the gateway uses it to recognise a retry. */
export const clientReference = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{3,64}$/, "Use 3 to 64 letters, numbers, - or _");

/** A short machine code: tenant codes, fee types, approval actions. */
export function code(label: string, max = 50) {
  return z
    .string()
    .trim()
    .toUpperCase()
    .min(1, `${label} is required`)
    .max(max, `${label} is too long`)
    .regex(/^[A-Z0-9_-]+$/, `${label}: letters, numbers, - and _ only`);
}

export const emailAddress = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Email address is too long")
  .pipe(z.email("Enter a valid email address"));

/**
 * A new password: long enough, mixing letters and numbers, no padding spaces.
 * Only applied where a password is set; signing in accepts whatever the gateway holds.
 */
export const newPassword = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128, "Use at most 128 characters")
  .refine((v) => v === v.trim(), "Remove spaces from the start and end")
  .refine((v) => /\p{L}/u.test(v) && /\d/.test(v), "Use at least one letter and one number");

/**
 * A record id chosen from a list (tenants, users). The spec says UUID, but the
 * rule only insists on a safe identifier so a format change cannot lock anyone out.
 */
export const entityId = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{1,64}$/, `Choose a valid ${label.toLowerCase()}`);

/** YYYY-MM-DD, a real calendar date. */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v), "Use a valid date");

/* ---------- Phone numbers ---------- */

export const DEFAULT_COUNTRY: CountryCode = "GH";

/** Optional contact number in any country, stored in E.164 (+233241234567). */
export const phoneNumber = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s()-]/g, ""))
  .refine((v) => v === "" || isValidPhoneNumber(v, DEFAULT_COUNTRY), "Enter a valid phone number, with its country")
  .transform((v) => (v ? (parsePhoneNumberFromString(v, DEFAULT_COUNTRY)?.number ?? v) : undefined))
  .optional();

/**
 * A Ghanaian mobile money wallet. Accepts 024 123 4567, +233 24 123 4567 or
 * 233241234567, and sends the national form (0241234567) the gateway uses.
 */
export const ghanaMobile = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s()-]/g, ""))
  .transform((v, ctx) => {
    const parsed = parseMobileNumber(v, "GH");
    if (!parsed || parsed.country !== "GH" || !parsed.isValid()) {
      ctx.addIssue({ code: "custom", message: "Enter a valid Ghanaian mobile number, like 024 123 4567" });
      return z.NEVER;
    }
    return `0${parsed.nationalNumber}`;
  });

/** A bank account number: digits only (spaces and dashes are removed), 6 to 20 long. */
export const bankAccount = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine((v) => /^\d{6,20}$/.test(v), "Enter a valid account number (6 to 20 digits)");

/**
 * Either kind of destination, before the institution is known: digits, or an
 * international wallet number. `destinationAccount` then applies the exact rule.
 */
export const anyAccount = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s()-]/g, ""))
  .refine((v) => /^\+?\d{6,20}$/.test(v), "Enter a valid account or wallet number");

/**
 * Where a disbursement goes: a mobile wallet when the institution is a telco,
 * otherwise a bank account. Pass the telco codes loaded from the gateway.
 */
export function destinationAccount(institutionCode: string, telcoCodes: ReadonlySet<string>) {
  return telcoCodes.has(institutionCode.toUpperCase()) ? ghanaMobile : bankAccount;
}
