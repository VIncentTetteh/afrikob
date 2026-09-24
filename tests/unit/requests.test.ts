import { describe, expect, it } from "vitest";
import {
  bulkDisbursementSchema,
  collectionSchema,
  createTenantSchema,
  disbursementSchema,
  newClientTransactionId,
  upsertApprovalPolicySchema,
  upsertFeeSchema,
} from "@/lib/api/schemas/requests";

const validDisbursement = {
  clientTransactionId: "DSB-1",
  accountNumber: "0241234567",
  institutionCode: "MTN",
  amount: "10.50",
  currency: "ghs",
  reference: "Salary",
  accountName: "Ama",
};

describe("request schemas", () => {
  it("coerces amounts and uppercases currency", () => {
    const out = disbursementSchema.parse(validDisbursement);
    expect(out.amount).toBe(10.5);
    expect(out.currency).toBe("GHS");
  });

  it.each([
    [{ amount: "0" }, "amount"],
    [{ amount: "-5" }, "amount"],
    [{ accountNumber: "12" }, "accountNumber"],
    [{ accountName: "  " }, "accountName"],
    [{ currency: "CEDI" }, "currency"],
  ])("rejects %o", (patch, field) => {
    const result = disbursementSchema.safeParse({ ...validDisbursement, ...patch });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path[0]).toBe(field);
  });

  it("validates mobile wallet numbers for collections and drops empty optional names", () => {
    const base = { clientTransactionId: "C", walletNumber: "+233241234567", institutionCode: "MTN", amount: 1, reference: "r", walletName: "" };
    expect(collectionSchema.parse(base).walletName).toBeUndefined();
    expect(collectionSchema.safeParse({ ...base, walletNumber: "abc" }).success).toBe(false);
  });

  it("validates tenant codes and defaults RPM", () => {
    const out = createTenantSchema.parse({ code: "AFK-1", legalName: "L", displayName: "D" });
    expect(out.requestsPerMinute).toBe(60);
    expect(createTenantSchema.safeParse({ code: "bad code!", legalName: "L", displayName: "D" }).success).toBe(false);
  });

  it("bounds fee percentages and approval counts", () => {
    expect(upsertFeeSchema.safeParse({ transactionType: "X", percentageFee: 101 }).success).toBe(false);
    expect(upsertApprovalPolicySchema.parse({ actionKey: "REFUND", tenantId: "" })).toMatchObject({ tenantId: undefined, requiredApprovals: 1, isEnabled: true });
    expect(upsertApprovalPolicySchema.safeParse({ actionKey: "R", requiredApprovals: 0 }).success).toBe(false);
  });

  it("limits bulk batch size", () => {
    expect(bulkDisbursementSchema.safeParse({ disbursements: [] }).success).toBe(false);
  });

  it("generates unique prefixed client ids", () => {
    const a = newClientTransactionId("COL");
    expect(a).toMatch(/^COL-[A-Z0-9]+-[A-F0-9]{8}$/);
    expect(a).not.toBe(newClientTransactionId("COL"));
  });
});
