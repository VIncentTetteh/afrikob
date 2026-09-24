import { describe, expect, it } from "vitest";
import { transactions } from "../msw/fixtures";
import { activeFilterCount, applyFilters, countByTone, directionOf, EMPTY_FILTERS, filterByKind, settledTotal } from "@/components/transactions/filters";
import { activeHref, navFor, primaryNavFor } from "@/components/layout/nav";
import { approvalsHrefFor, homeFor } from "@/lib/session/types";
import { transactionListSchema } from "@/lib/api/schemas/models";
import { display, formatDate, formatMoney, formatNumber, humanize, parseDate } from "@/lib/format";

const items = transactionListSchema.parse(transactions);

describe("format", () => {
  it("parses ISO and dd/MM/yyyy dates", () => {
    expect(parseDate("2026-09-16T15:39:00")?.getDate()).toBe(16);
    expect(parseDate("09/10/2026")?.getMonth()).toBe(9);
    expect(parseDate("16/09/2026 15:39")?.getHours()).toBe(15);
    expect(parseDate("nope")).toBeNull();
    expect(formatDate("2026-09-16T15:39:00")).toBe("16/09/2026 15:39");
    expect(formatDate("nope")).toBe("nope");
    expect(formatDate(null)).toBe("N/A");
  });

  it("formats money, numbers and display values", () => {
    expect(formatMoney(9958.6)).toBe("GHS 9,958.60");
    expect(formatMoney(10, null)).toBe("GHS 10.00");
    expect(formatMoney(null)).toBe("N/A");
    expect(formatMoney(1, "XXXX")).toBe("1.00");
    expect(formatNumber(1600)).toBe("1,600");
    expect(display(true)).toBe("Yes");
    expect(display({ a: 1 })).toBe('{"a":1}');
    expect(display("")).toBe("N/A");
    expect(humanize("customerFeeValue")).toBe("Customer Fee Value");
    expect(humanize("bulk_transaction_id")).toBe("Bulk Transaction Id");
    // The gateway shouts its action keys and wallet types.
    expect(humanize("WALLET_TOPUP")).toBe("Wallet Topup");
    expect(humanize("DISBURSEMENT")).toBe("Disbursement");
  });
});

describe("transaction filters", () => {
  it("filters by kind, falling back to all when untyped", () => {
    expect(filterByKind(items, "collection")).toHaveLength(2);
    expect(filterByKind(items)).toHaveLength(3);
    const untyped = items.map((t) => ({ ...t, type: null }));
    expect(filterByKind(untyped, "disbursement")).toHaveLength(3);
  });

  it("filters by tone and date range", () => {
    expect(applyFilters(items, { ...EMPTY_FILTERS, tone: "failed" })).toHaveLength(1);
    expect(applyFilters(items, { tone: "all", from: "2026-09-15", to: "2026-09-16" })).toHaveLength(2);
    expect(applyFilters([{ ...items[0], createdAt: null }], { tone: "all", from: "2026-01-01", to: "" })).toHaveLength(0);
    expect(countByTone(items)).toEqual({ success: 1, pending: 1, failed: 1, neutral: 0 });
    expect(activeFilterCount({ tone: "failed", from: "x", to: "" })).toBe(2);
  });

  it("maps each record onto a direction rail and totals what settled", () => {
    expect(items.map(directionOf)).toEqual(["in", "out", "in"]);
    expect(directionOf({ ...items[0], type: "Refund" })).toBe("out");
    expect(directionOf({ ...items[0], type: null })).toBe("held");
    expect(settledTotal(items)).toBe(10);
  });
});

describe("nav", () => {
  it("uses longest-prefix matching per role", () => {
    const tenant = navFor("tenant");
    expect(activeHref("/disbursements/bulk/abc", tenant)).toBe("/disbursements/bulk");
    expect(activeHref("/status-check", tenant)).toBe("/status-check");
    expect(activeHref("/disbursements", tenant)).toBe("/disbursements");
    expect(activeHref("/dashboard", tenant)).toBe("/dashboard");
    expect(activeHref("/admin/tenants/x", navFor("platform"))).toBe("/admin/tenants");
    expect(activeHref("/admin/reports", navFor("platform"))).toBe("/admin/reports");
    expect(activeHref("/admin/tenants/x", navFor("platform"))).not.toBe("/admin");
  });

  it("keeps tenant-only destinations out of the admin console", () => {
    // /transactions and the balance endpoints need tenant context; the gateway
    // refuses them for a staff session, so nothing in the admin nav may lead there.
    const adminHrefs = navFor("platform").flatMap((s) => s.items.map((i) => i.href));
    expect(adminHrefs.every((href) => href.startsWith("/admin"))).toBe(true);
    expect(adminHrefs).not.toContain("/admin/transactions");
  });

  it("offers at most five destinations in the phone tab bar", () => {
    for (const role of ["platform", "tenant-admin", "tenant"] as const) {
      const primary = primaryNavFor(role);
      expect(primary.length).toBeGreaterThan(0);
      expect(primary.length).toBeLessThanOrEqual(5);
    }
  });

  it("sends each role to an approvals inbox it can actually open", () => {
    expect(approvalsHrefFor("platform")).toBe("/admin/approvals");
    expect(approvalsHrefFor("tenant-admin")).toBe("/tenant-admin/approvals");
    // A merchant has no inbox of its own; the tenant one is the closest thing,
    // and the route guard sends them home rather than showing an error.
    expect(approvalsHrefFor("tenant")).toBe("/tenant-admin/approvals");
  });

  it("gives every role a home it is allowed to open", () => {
    expect(homeFor("platform")).toBe("/admin");
    expect(homeFor("tenant-admin")).toBe("/tenant-admin");
    expect(homeFor("tenant")).toBe("/dashboard");
    // Each role's home is a destination in its own navigation.
    for (const role of ["platform", "tenant-admin", "tenant"] as const) {
      const hrefs = navFor(role).flatMap((s) => s.items.map((i) => i.href));
      expect(hrefs).toContain(homeFor(role));
    }
  });

  it("lets a tenant admin run the business and move money", () => {
    const hrefs = navFor("tenant-admin").flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).toEqual(expect.arrayContaining(["/dashboard", "/collections", "/tenant-admin", "/tenant-admin/approvals", "/tenant-admin/people"]));
    // Running the platform is not theirs.
    expect(hrefs.every((href) => !href.startsWith("/admin"))).toBe(true);
  });
});
