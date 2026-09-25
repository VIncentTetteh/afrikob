import type { BulkNameVerifyResult } from "@/lib/api/schemas/models";
import { bulkDisbursementItemSchema, newClientTransactionId, withDestination, type BulkDisbursementItem } from "@/lib/api/schemas/requests";

export const BULK_TEMPLATE_HEADERS = ["accountNumber", "institutionCode", "accountName", "amount", "currency", "reference", "clientTransactionId"];
export const BULK_TEMPLATE_SAMPLE = ["0241234567", "MTN", "Ama Mensah", "150.00", "GHS", "Salary Sept", ""];

const HEADER_ALIASES: Record<string, string> = {
  account: "accountNumber", accountno: "accountNumber", accountnumber: "accountNumber", walletnumber: "accountNumber", msisdn: "accountNumber",
  bank: "institutionCode", bankcode: "institutionCode", institution: "institutionCode", institutioncode: "institutionCode", network: "institutionCode",
  name: "accountName", accountname: "accountName", beneficiary: "accountName",
  amount: "amount", currency: "currency", reference: "reference", narration: "reference",
  clienttransactionid: "clientTransactionId", transactionid: "transactionId",
};

export type NameMatch = "unverified" | "match" | "mismatch" | "not_found";

export interface BulkRow {
  index: number;
  input: Record<string, string>;
  item: BulkDisbursementItem | null;
  errors: string[];
  verifiedName: string | null;
  nameMatch: NameMatch;
}

function canonical(header: string): string {
  return HEADER_ALIASES[header.toLowerCase().replace(/[^a-z]/g, "")] ?? header;
}

/**
 * Validates uploaded CSV rows against the bulk item schema. With the telco codes
 * from the gateway, a wallet row is checked (and normalised) as a Ghanaian mobile
 * number and a bank row as an account number.
 */
export function buildRows(records: Record<string, string>[], telcoCodes: ReadonlySet<string> = new Set()): BulkRow[] {
  const schema = withDestination(bulkDisbursementItemSchema, telcoCodes);
  return records.map((record, index) => {
    const input: Record<string, string> = {};
    for (const [k, v] of Object.entries(record)) input[canonical(k)] = (v ?? "").trim();
    const parsed = schema.safeParse({
      ...input,
      currency: input.currency || "GHS",
      clientTransactionId: input.clientTransactionId || newClientTransactionId("BLK"),
    });
    return {
      index: index + 1,
      input,
      item: parsed.success ? parsed.data : null,
      errors: parsed.success ? [] : parsed.error.issues.map((i) => `${String(i.path[0] ?? "row")}: ${i.message}`),
      verifiedName: null,
      nameMatch: "unverified",
    };
  });
}

/** Rows whose clientTransactionId appears more than once are rejected. */
export function flagDuplicates(rows: BulkRow[]): BulkRow[] {
  const seen = new Map<string, number>();
  for (const r of rows) if (r.item) seen.set(r.item.clientTransactionId, (seen.get(r.item.clientTransactionId) ?? 0) + 1);
  return rows.map((r) =>
    r.item && (seen.get(r.item.clientTransactionId) ?? 0) > 1
      ? { ...r, item: null, errors: [...r.errors, "clientTransactionId: duplicate in file"] }
      : r,
  );
}

const normalizeName = (n: string) => n.toLowerCase().replace(/[^a-z ]/g, "").split(/\s+/).filter(Boolean).sort().join(" ");

/** Loose match: same token set, or every provided token appears in the verified name. */
export function namesMatch(provided: string, verified: string): boolean {
  const a = normalizeName(provided);
  const b = normalizeName(verified);
  if (a === b) return true;
  const verifiedTokens = new Set(b.split(" "));
  return a.split(" ").every((t) => verifiedTokens.has(t));
}

export function applyVerification(rows: BulkRow[], results: BulkNameVerifyResult[]): BulkRow[] {
  const byKey = new Map<string, BulkNameVerifyResult>();
  results.forEach((r, i) => {
    byKey.set(`#${i}`, r);
    if (r.accountNumber) byKey.set(r.accountNumber, r);
  });
  const valid = rows.filter((r) => r.item);
  return rows.map((row) => {
    if (!row.item) return row;
    const position = valid.indexOf(row);
    const hit = byKey.get(row.item.accountNumber) ?? byKey.get(`#${position}`);
    if (!hit?.accountName) return { ...row, verifiedName: null, nameMatch: "not_found" };
    return {
      ...row,
      verifiedName: hit.accountName,
      nameMatch: namesMatch(row.item.accountName, hit.accountName) ? "match" : "mismatch",
    };
  });
}

export function summarize(rows: BulkRow[]) {
  const valid = rows.filter((r) => r.item);
  return {
    total: rows.length,
    valid: valid.length,
    invalid: rows.length - valid.length,
    amount: valid.reduce((s, r) => s + (r.item?.amount ?? 0), 0),
    mismatches: rows.filter((r) => r.nameMatch === "mismatch").length,
    notFound: rows.filter((r) => r.nameMatch === "not_found").length,
    verified: rows.some((r) => r.nameMatch !== "unverified"),
  };
}
