import { describe, expect, it } from "vitest";
import { applyVerification, buildRows, flagDuplicates, namesMatch, summarize } from "@/lib/csv/bulk";
import { parseCsvFile, sanitizeCell, toCsv } from "@/lib/csv";

describe("csv export", () => {
  it("neutralises formula injection", () => {
    expect(sanitizeCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(sanitizeCell("+1")).toBe("'+1");
    expect(sanitizeCell(null)).toBe("");
    expect(sanitizeCell({ a: 1 })).toBe('{"a":1}');
    expect(toCsv(["a", "b"], [["=x", 2]])).toBe("a,b\r\n'=x,2");
  });

  it("parses files and rejects oversized uploads", async () => {
    const file = new File(["Account Number,Bank Code,Name,Amount\n0241234567,MTN,Ama,5\n"], "x.csv", { type: "text/csv" });
    const parsed = await parseCsvFile(file);
    expect(parsed.headers).toEqual(["Account Number", "Bank Code", "Name", "Amount"]);
    expect(parsed.rows).toHaveLength(1);
    const big = new File(["x".repeat(2 * 1024 * 1024 + 1)], "big.csv");
    expect((await parseCsvFile(big)).errors[0]).toMatch(/2 MB/);
  });
});

describe("bulk rows", () => {
  const records: Record<string, string>[] = [
    { "Account Number": "0241234567", "Bank Code": "MTN", Name: "Ama Mensah", Amount: "10", Reference: "r1", "Client Transaction Id": "C1" },
    { "Account Number": "12", "Bank Code": "MTN", Name: "Bad", Amount: "abc", Reference: "r2" },
    { "Account Number": "0551234567", "Bank Code": "VOD", Name: "Kofi", Amount: "5", Reference: "r3", "Client Transaction Id": "C1" },
    { "Account Number": "0201234567", "Bank Code": "GCB", Name: "Yaw Owusu", Amount: "2.5", Reference: "r4" },
  ];

  it("maps header aliases, validates and flags duplicates", () => {
    const rows = flagDuplicates(buildRows(records));
    expect(rows[0].item).toBeNull();
    expect(rows[0].errors).toContain("clientTransactionId: duplicate in file");
    expect(rows[1].item).toBeNull();
    expect(rows[1].errors.join()).toMatch(/accountNumber/);
    expect(rows[3].item).toMatchObject({ accountNumber: "0201234567", amount: 2.5, currency: "GHS" });
    expect(rows[3].item?.clientTransactionId).toMatch(/^BLK-/);
  });

  it("matches verified names loosely", () => {
    expect(namesMatch("Ama Mensah", "MENSAH AMA")).toBe(true);
    expect(namesMatch("Ama", "Ama Serwaa Mensah")).toBe(true);
    expect(namesMatch("Kofi Boateng", "Ama Mensah")).toBe(false);
  });

  it("applies verification by account, falling back to position", () => {
    const rows = buildRows([records[0], records[3], records[2]]);
    const verified = applyVerification(rows, [
      { accountNumber: "0241234567", accountName: "MENSAH AMA", status: "Verified", message: null },
      { accountNumber: "0201234567", accountName: "Esi Owusu", status: "Verified", message: null },
      { accountNumber: null, accountName: null, status: "NotFound", message: "No account" },
    ]);
    expect(verified.map((r) => r.nameMatch)).toEqual(["match", "mismatch", "not_found"]);
    const stats = summarize(verified);
    expect(stats).toMatchObject({ total: 3, valid: 3, invalid: 0, amount: 17.5, mismatches: 1, notFound: 1, verified: true });
  });

  it("leaves invalid rows untouched during verification", () => {
    const rows = buildRows([records[1]]);
    expect(applyVerification(rows, [])[0]).toBe(rows[0]);
    expect(summarize(rows)).toMatchObject({ valid: 0, invalid: 1, verified: false });
  });
});
