import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { envelope } from "../msw/fixtures";
import { server } from "../msw/server";
import { adminApi, approvalsApi, paymentsApi, refundsApi, tenantAdminApi, transactionsApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/api/keys";
import { cn } from "@/lib/utils";

interface Seen {
  method: string;
  path: string;
  search: string;
  body: unknown;
  headers: Record<string, string>;
}

let seen: Seen[] = [];

beforeEach(() => {
  seen = [];
  server.use(
    http.all("*/api/afrikob/*", async ({ request }) => {
      const url = new URL(request.url);
      const text = await request.text();
      seen.push({
        method: request.method,
        path: url.pathname.replace("/api/afrikob/", ""),
        search: url.search,
        body: text ? JSON.parse(text) : undefined,
        headers: Object.fromEntries(request.headers.entries()),
      });
      return HttpResponse.json(envelope([]));
    }),
  );
});

const payout = {
  clientTransactionId: "c",
  accountNumber: "0241234567",
  institutionCode: "MTN",
  amount: 1,
  currency: "GHS",
  reference: "r",
  accountName: "A",
};
const filter = { tenantId: "ten-1", fromDate: "2026-09-01", toDate: "2026-09-30", status: "Successful", currency: "GHS" };
const PERSON = {
  email: "a@b.com",
  displayName: "A",
  userType: "Platform" as const,
  tenantId: undefined,
  password: "password1",
  canMake: true,
  canCheck: false,
  isTenantAdmin: false,
  isPlatformAdmin: false,
  phoneNumber: undefined,
  preferredNotificationChannel: "Email" as const,
};
const PERSON_EDIT = {
  displayName: "A",
  canMake: true,
  canCheck: true,
  isTenantAdmin: false,
  isPlatformAdmin: false,
  phoneNumber: undefined,
  preferredNotificationChannel: "Email" as const,
};
const TENANT_PERSON = {
  email: "a@b.com",
  displayName: "A",
  password: "password1",
  canMake: true,
  canCheck: false,
  isTenantAdmin: true,
  phoneNumber: undefined,
  preferredNotificationChannel: "Email" as const,
};

/** Contract: every Swagger operation maps to the expected method, path and query. */
const cases: [string, () => Promise<unknown>, string, string, string?][] = [
  ["listTenants", () => adminApi.listTenants(), "GET", "admin/tenants"],
  ["createTenant", () => adminApi.createTenant({ code: "A", legalName: "L", displayName: "D", requestsPerMinute: 60 }), "POST", "admin/tenants"],
  ["issueCredential", () => adminApi.issueCredential("t 1", { name: "n" }), "POST", "admin/tenants/t%201/credentials"],
  ["listRefunds", () => adminApi.listRefunds("Pending"), "GET", "admin/refunds", "?status=Pending"],
  ["approveRefund", () => adminApi.approveRefund("r1"), "POST", "admin/refunds/r1/approve"],
  ["rejectRefund", () => adminApi.rejectRefund("r1", { reason: "x" }), "POST", "admin/refunds/r1/reject"],
  ["completeRefund", () => adminApi.completeRefund("r1", { success: true, providerReference: undefined, providerNote: undefined }), "POST", "admin/refunds/r1/complete"],
  ["getWallet", () => adminApi.getWallet("t1", { currency: "GHS", walletType: "DISBURSEMENT" }), "GET", "admin/wallets/t1", "?currency=GHS&walletType=DISBURSEMENT"],
  ["topUpWallet", () => adminApi.topUpWallet("t1", { currency: "GHS", amount: 5, reference: "r", walletType: undefined }), "POST", "admin/wallets/t1/topup"],
  ["listFees", () => adminApi.listFees("t1"), "GET", "admin/tenants/t1/fees"],
  ["upsertFee", () => adminApi.upsertFee("t1", { transactionType: "X", percentageFee: 1 }), "POST", "admin/tenants/t1/fees"],
  ["deleteFee", () => adminApi.deleteFee("t1", "BULK/X"), "DELETE", "admin/tenants/t1/fees/BULK%2FX"],
  ["listUsers", () => adminApi.listUsers({ tenantId: "t1", userType: "Tenant" }), "GET", "admin/users", "?tenantId=t1&userType=Tenant"],
  ["getUser", () => adminApi.getUser("u1"), "GET", "admin/users/u1"],
  ["createUser", () => adminApi.createUser(PERSON), "POST", "admin/users"],
  ["updateUser", () => adminApi.updateUser("u1", PERSON_EDIT), "PATCH", "admin/users/u1"],
  ["activateUser", () => adminApi.activateUser("u1"), "POST", "admin/users/u1/activate"],
  ["deactivateUser", () => adminApi.deactivateUser("u1"), "POST", "admin/users/u1/deactivate"],
  ["setUserPassword", () => adminApi.setUserPassword("u1", { newPassword: "password1" }), "POST", "admin/users/u1/set-password"],
  ["collectionReport", () => adminApi.collectionReport(filter), "GET", "admin/reports/collections/list", "?tenantId=ten-1&fromDate=2026-09-01&toDate=2026-09-30&status=Successful&currency=GHS"],
  ["disbursementReport", () => adminApi.disbursementReport(filter), "GET", "admin/reports/disbursements/list", "?tenantId=ten-1&fromDate=2026-09-01&toDate=2026-09-30&status=Successful&currency=GHS"],
  ["listApprovalPolicies", () => adminApi.listApprovalPolicies("t1"), "GET", "admin/approval-policies", "?tenantId=t1"],
  ["upsertApprovalPolicy", () => adminApi.upsertApprovalPolicy({ actionKey: "A", tenantId: undefined, isEnabled: true, requiredApprovals: 1, allowRequesterToApprove: false }), "POST", "admin/approval-policies"],
  ["deleteApprovalPolicy", () => adminApi.deleteApprovalPolicy("p1"), "DELETE", "admin/approval-policies/p1"],
  ["refund.listForTransaction", () => refundsApi.listForTransaction("tx1"), "GET", "payments/tx1/refunds"],
  ["refund.get", () => refundsApi.get("r1"), "GET", "payments/refunds/r1"],
  ["transactions.list", () => transactionsApi.list(2, 50), "GET", "transactions", "?page=2&size=50"],
  ["transactions.get", () => transactionsApi.get("tx1"), "GET", "transactions/tx1"],
  ["telcos", () => paymentsApi.telcos(), "GET", "payments/get-all-telcos"],
  ["banks", () => paymentsApi.banks(), "GET", "payments/get-all-banks"],
  ["verifyName", () => paymentsApi.verifyName({ accountNumber: "0241234567", institutionCode: "MTN" }), "POST", "payments/verify-name"],
  ["statusCheck", () => paymentsApi.statusCheck({ clientTransactionId: "c" }), "POST", "payments/status-check"],
  ["disburse", () => paymentsApi.disburse(payout), "POST", "payments/disbursement"],
  ["collect", () => paymentsApi.collect({ ...payout, walletNumber: "0241234567", walletName: undefined }), "POST", "payments/collection"],
  ["disbursementBalance", () => paymentsApi.disbursementBalance("GHS"), "GET", "payments/disbursement-balance", "?currency=GHS"],
  ["collectionBalance", () => paymentsApi.collectionBalance("GHS"), "GET", "payments/collection-balance", "?currency=GHS"],
  ["getWallet (no currency given)", () => adminApi.getWallet("t1"), "GET", "admin/wallets/t1", "?currency=GHS"],
  ["disbursementBalance (no currency given)", () => paymentsApi.disbursementBalance(), "GET", "payments/disbursement-balance", "?currency=GHS"],
  ["collectionBalance (no currency given)", () => paymentsApi.collectionBalance(), "GET", "payments/collection-balance", "?currency=GHS"],
  ["bulkNameVerify", () => paymentsApi.bulkNameVerify({ accounts: [] }), "POST", "payments/bulk-name-verify"],
  ["listBulk", () => paymentsApi.listBulk(), "GET", "payments/bulk-disbursements"],
  ["getBulk", () => paymentsApi.getBulk("b1"), "GET", "payments/bulk-disbursements/b1"],
  ["reconcileBulk", () => paymentsApi.reconcileBulk("b1"), "POST", "payments/bulk-disbursements/b1/reconcile"],
  ["bulkStatus", () => paymentsApi.bulkStatus({ bulk_transaction_id: "b1" }), "POST", "payments/bulk-disbursement-status"],
  // Approvals, at both scopes
  ["approvals.list (platform)", () => approvalsApi.list("platform", "Pending"), "GET", "admin/approvals", "?status=Pending"],
  ["approvals.get (platform)", () => approvalsApi.get("platform", "apr-1"), "GET", "admin/approvals/apr-1"],
  ["approvals.decide (platform)", () => approvalsApi.decide("platform", "apr-1", { approve: true, comment: undefined }), "POST", "admin/approvals/apr-1/decide"],
  ["approvals.list (tenant)", () => approvalsApi.list("tenant-admin"), "GET", "tenant-admin/approvals"],
  ["approvals.get (tenant)", () => approvalsApi.get("tenant-admin", "apr-1"), "GET", "tenant-admin/approvals/apr-1"],
  ["approvals.decide (tenant)", () => approvalsApi.decide("tenant-admin", "apr-1", { approve: false, comment: "No" }), "POST", "tenant-admin/approvals/apr-1/decide"],
  // A tenant's own administration
  ["tenantAdmin.tenant", () => tenantAdminApi.tenant(), "GET", "tenant-admin/tenant"],
  ["tenantAdmin.listUsers", () => tenantAdminApi.listUsers(), "GET", "tenant-admin/users"],
  ["tenantAdmin.getUser", () => tenantAdminApi.getUser("u1"), "GET", "tenant-admin/users/u1"],
  ["tenantAdmin.createUser", () => tenantAdminApi.createUser(TENANT_PERSON), "POST", "tenant-admin/users"],
  ["tenantAdmin.updateUser", () => tenantAdminApi.updateUser("u1", { displayName: "A", canMake: true, canCheck: false, isTenantAdmin: false, phoneNumber: undefined, preferredNotificationChannel: "Email" }), "PATCH", "tenant-admin/users/u1"],
  ["tenantAdmin.activateUser", () => tenantAdminApi.activateUser("u1"), "POST", "tenant-admin/users/u1/activate"],
  ["tenantAdmin.deactivateUser", () => tenantAdminApi.deactivateUser("u1"), "POST", "tenant-admin/users/u1/deactivate"],
  ["tenantAdmin.setUserPassword", () => tenantAdminApi.setUserPassword("u1", { newPassword: "password1" }), "POST", "tenant-admin/users/u1/set-password"],
  ["tenantAdmin.requestTopUp", () => tenantAdminApi.requestTopUp({ currency: "GHS", amount: 5, reference: "r", walletType: undefined }), "POST", "tenant-admin/wallets/topup-request"],
];

describe("endpoint contract", () => {
  it.each(cases)("%s → %s %s", async (_name, fn, method, path, search = "") => {
    await fn().catch(() => undefined);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ method, path, search });
  });

  it("sends Idempotency-Key on refund creation", async () => {
    await refundsApi.create("tx1", { reason: "dup", amount: 2 }, "idem-9").catch(() => undefined);
    expect(seen[0]).toMatchObject({ method: "POST", path: "payments/tx1/refunds", body: { reason: "dup", amount: 2 } });
    expect(seen[0].headers["idempotency-key"]).toBe("idem-9");
  });

  it("sends ClientBatchId on bulk creation", async () => {
    await paymentsApi.createBulk({ disbursements: [{ ...payout, transactionId: undefined }] }, "BATCH-1").catch(() => undefined);
    expect(seen[0].headers.clientbatchid).toBe("BATCH-1");
  });

  it("keeps the spec's snake_case bulk status field", async () => {
    await paymentsApi.bulkStatus({ bulk_transaction_id: "b1" }).catch(() => undefined);
    expect(seen[0].body).toEqual({ bulk_transaction_id: "b1" });
  });

  it("sends only what a tenant admin may set when creating their own person", async () => {
    await tenantAdminApi.createUser(TENANT_PERSON).catch(() => undefined);
    const body = seen[0].body as Record<string, unknown>;
    expect(body).toMatchObject({ email: "a@b.com", isTenantAdmin: true, preferredNotificationChannel: "Email" });
    expect(body).not.toHaveProperty("isPlatformAdmin");
    expect(body).not.toHaveProperty("tenantId");
  });

  it("never asks for a wallet or balance without a currency", async () => {
    // The gateway answers 400 "The currency field is required" otherwise.
    await Promise.all([
      adminApi.getWallet("t1").catch(() => undefined),
      adminApi.getWallet("t1", { walletType: "DISBURSEMENT" }).catch(() => undefined),
      paymentsApi.disbursementBalance().catch(() => undefined),
      paymentsApi.collectionBalance().catch(() => undefined),
    ]);
    expect(seen).toHaveLength(4);
    for (const call of seen) expect(new URLSearchParams(call.search).get("currency")).toBe("GHS");
  });

  it("downloads a report file from the non-list route", async () => {
    server.use(
      http.get("*/api/afrikob/admin/reports/collections", () =>
        HttpResponse.text("a,b", { headers: { "content-type": "text/csv", "content-disposition": 'attachment; filename="r.csv"' } }),
      ),
    );
    const file = await adminApi.downloadReport("collections", filter);
    expect(file.filename).toBe("r.csv");
  });
});

describe("query keys and utils", () => {
  it("builds hierarchical keys", () => {
    expect(qk.transactions.list(1, 20)).toEqual(["transactions", "list", 1, 20]);
    expect(qk.refunds.admin()).toEqual(["refunds", "admin", "all"]);
    expect(qk.wallets.tenant("t", "GHS", "DISBURSEMENT")).toEqual(["wallets", "t", "GHS", "DISBURSEMENT"]);
    expect(qk.users.list()).toEqual(["users", "list", "all", "all"]);
    expect(qk.users.detail("u1")).toEqual(["users", "detail", "u1"]);
    expect(qk.policies.list()).toEqual(["policies", "global"]);
    expect(qk.payments.balance("collection")[2]).toBe("collection");
    expect(qk.payments.bulkDetail("b")).toEqual(["payments", "bulk", "b"]);
    expect(qk.reports.list("collections", filter)[1]).toBe("collections");
    expect(qk.refunds.forTransaction("x")[0]).toBe(qk.refunds.all[0]);
    expect(qk.fees.tenant("t")).toEqual(["fees", "t"]);
  });

  it("merges tailwind classes", () => {
    expect(cn("px-2", false && "hidden", "px-4")).toBe("px-4");
  });
});
