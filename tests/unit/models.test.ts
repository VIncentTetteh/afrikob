import { describe, expect, it } from "vitest";
import { batchDetail, collectionReportRows, refunds, tenants, transactions, users, wallet } from "../msw/fixtures";
import {
  approvalPolicyListSchema,
  batchDetailSchema,
  batchStatusSchema,
  bulkNameVerifySchema,
  collectionReportSchema,
  createdTenantSchema,
  feeConfigListSchema,
  gatewayStatusSchema,
  institutionListSchema,
  issuedCredentialSchema,
  portalUserListSchema,
  refundListSchema,
  tenantListSchema,
  transactionKind,
  transactionListSchema,
  transactionSchema,
  walletBalanceSchema,
} from "@/lib/api/schemas/models";
import { findArray, statusTone } from "@/lib/api/schemas/normalize";

describe("transactions", () => {
  it("parses the documented shape", () => {
    const parsed = transactionListSchema.parse(transactions);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toMatchObject({ amount: 10, netAmount: 9.8, accountNumberMasked: "024****567", status: "Successful" });
    expect(parsed[2].accountName).toBeNull();
  });

  it("keeps unknown fields and tolerates missing ones", () => {
    const parsed = transactionSchema.parse({ id: "x", surprise: true });
    expect(parsed.surprise).toBe(true);
    expect(parsed.amount).toBeNull();
    expect(parsed.currency).toBeNull();
  });

  it("rejects a payload that is not an object", () => {
    expect(transactionSchema.safeParse("nope").success).toBe(false);
  });

  it.each([
    ["Collection", "collection"],
    ["CHECKOUT", "collection"],
    ["Disbursement", "disbursement"],
    ["payout", "disbursement"],
    ["Refund", "refund"],
    ["something", "other"],
    [null, "other"],
  ])("%s is a %s", (type, kind) => expect(transactionKind(type)).toBe(kind));
});

describe("other models", () => {
  it("parses refunds, tenants, wallets and users", () => {
    expect(refundListSchema.parse(refunds)[0]).toMatchObject({ id: "ref-1", amount: 10, status: "Pending" });
    expect(tenantListSchema.parse(tenants)[1]).toMatchObject({ code: "KOBO", status: "Suspended" });
    expect(walletBalanceSchema.parse(wallet)).toMatchObject({ availableBalance: 9958.6, reservedBalance: 41.4, totalBalance: 10000 });
    expect(portalUserListSchema.parse(users)[1]).toMatchObject({ canCheck: false, isActive: false, lastLoginAt: null });
  });

  it("parses credentials, institutions, fees and policies", () => {
    expect(createdTenantSchema.parse({ tenantId: "t1", apiKey: "sk_live" })).toMatchObject({ tenantId: "t1", apiKey: "sk_live" });
    expect(issuedCredentialSchema.parse({ credentialId: "c1", keyPrefix: "afk_", apiKey: "secret" }).apiKey).toBe("secret");
    expect(institutionListSchema.parse([{ code: "GCB", name: "GCB Bank", type: "Bank" }])[0].name).toBe("GCB Bank");
    expect(feeConfigListSchema.parse([{ id: "f1", transactionType: "COLLECTION", percentageFee: 1.5, isActive: true }])[0]).toMatchObject({
      percentageFee: 1.5,
      isActive: true,
    });
    expect(approvalPolicyListSchema.parse([{ id: "p1", actionKey: "REFUND", isEnabled: true, requiredApprovals: 2 }])[0]).toMatchObject({
      requiredApprovals: 2,
      allowRequesterToApprove: false,
    });
  });

  it("parses gateway status, checkout and bulk payloads", () => {
    expect(gatewayStatusSchema.parse({ accountName: "Ama", isReversed: false, amount: "10.00" }).amount).toBe("10.00");
    expect(bulkNameVerifySchema.parse({ results: [{ accountName: "Ama", accountNumber: "024", status: "ok", message: null }] })).toHaveLength(1);
    expect(bulkNameVerifySchema.parse([{ accountName: "Ama" }])[0].accountName).toBe("Ama");

    const detail = batchDetailSchema.parse(batchDetail);
    expect(detail.batch.itemCount).toBe(2);
    expect(detail.items[1].status).toBe("Failed");

    const status = batchStatusSchema.parse({ id: "b1", items: [{ clientTransactionId: "c1", status: "Successful", message: "ok" }] });
    expect(status.items[0].clientTransactionId).toBe("c1");
  });

  it("parses report rows", () => {
    const rows = collectionReportSchema.parse(collectionReportRows);
    expect(rows[0]).toMatchObject({ netToMerchant: 9.8, transactionStatus: "Successful", channel: "API" });
  });

  it("reads a list wrapped in an envelope-like object", () => {
    expect(tenantListSchema.parse({ items: tenants })).toHaveLength(2);
    expect(findArray({ data: { records: [1] } })).toEqual([1]);
  });
});

describe("statusTone", () => {
  it.each([
    ["Successful", "success"],
    ["Completed", "success"],
    ["Failed", "failed"],
    ["Rejected", "failed"],
    ["Pending", "pending"],
    ["Processing", "pending"],
    ["odd", "neutral"],
    [null, "neutral"],
  ])("%s → %s", (status, tone) => expect(statusTone(status)).toBe(tone));
});
