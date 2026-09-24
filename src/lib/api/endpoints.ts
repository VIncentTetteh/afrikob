import { download, request, requestResult } from "./client";
import {
  approvalPolicyListSchema,
  approvalPolicySchema,
  approvalRequestListSchema,
  approvalRequestSchema,
  batchDetailSchema,
  batchListSchema,
  batchSchema,
  batchStatusSchema,
  bulkNameVerifySchema,
  collectionReportSchema,
  createdTenantSchema,
  deactivatedSchema,
  disbursementReportSchema,
  emptySchema,
  feeConfigListSchema,
  feeConfigSchema,
  gatewayResponseSchema,
  gatewayStatusSchema,
  institutionListSchema,
  issuedCredentialSchema,
  nameVerifySchema,
  passwordSetSchema,
  portalUserListSchema,
  portalUserSchema,
  refundListSchema,
  refundSchema,
  tenantDetailSchema,
  tenantListSchema,
  transactionListSchema,
  transactionSchema,
  walletBalanceSchema,
} from "./schemas/models";
import type * as Req from "./schemas/requests";

const enc = encodeURIComponent;

/**
 * The gateway rejects wallet and balance reads without a currency ("The
 * currency field is required"), even though the spec marks the parameter
 * optional. Ghana cedi is the only currency in play today.
 */
export const DEFAULT_CURRENCY = "GHS";

/** Report filters are shared by the table and the file export. */
function reportQuery(filter: Req.ReportFilter) {
  return {
    tenantId: filter.tenantId,
    fromDate: filter.fromDate,
    toDate: filter.toDate,
    status: filter.status,
    currency: filter.currency,
  };
}

/** One typed function per Afrikob gateway endpoint (Swagger v1). */
export const adminApi = {
  listTenants: (signal?: AbortSignal) => request("GET", "admin/tenants", { schema: tenantListSchema, signal }),
  /** Returns the new tenant's API key once; 202 means it awaits approval. */
  createTenant: (body: Req.CreateTenant) => requestResult("POST", "admin/tenants", { body, schema: createdTenantSchema }),
  issueCredential: (tenantId: string, body: Req.IssueCredential) =>
    request("POST", `admin/tenants/${enc(tenantId)}/credentials`, { body, schema: issuedCredentialSchema }),

  listRefunds: (status?: string, signal?: AbortSignal) =>
    request("GET", "admin/refunds", { query: { status }, schema: refundListSchema, signal }),
  approveRefund: (id: string) => requestResult("POST", `admin/refunds/${enc(id)}/approve`, { schema: refundSchema }),
  rejectRefund: (id: string, body: Req.RejectRefund) =>
    request("POST", `admin/refunds/${enc(id)}/reject`, { body, schema: refundSchema }),
  completeRefund: (id: string, body: Req.CompleteRefund) =>
    request("POST", `admin/refunds/${enc(id)}/complete`, { body, schema: refundSchema }),

  getWallet: (tenantId: string, query: { currency?: string; walletType?: string } = {}, signal?: AbortSignal) =>
    request("GET", `admin/wallets/${enc(tenantId)}`, {
      query: { ...query, currency: query.currency || DEFAULT_CURRENCY },
      schema: walletBalanceSchema,
      signal,
    }),
  topUpWallet: (tenantId: string, body: Req.TopUp) =>
    requestResult("POST", `admin/wallets/${enc(tenantId)}/topup`, { body, schema: walletBalanceSchema }),

  listFees: (tenantId: string, signal?: AbortSignal) =>
    request("GET", `admin/tenants/${enc(tenantId)}/fees`, { schema: feeConfigListSchema, signal }),
  upsertFee: (tenantId: string, body: Req.UpsertFee) =>
    request("POST", `admin/tenants/${enc(tenantId)}/fees`, { body, schema: feeConfigSchema }),
  deleteFee: (tenantId: string, transactionType: string) =>
    request("DELETE", `admin/tenants/${enc(tenantId)}/fees/${enc(transactionType)}`, { schema: deactivatedSchema }),

  listUsers: (query: { tenantId?: string; userType?: string } = {}, signal?: AbortSignal) =>
    request("GET", "admin/users", { query, schema: portalUserListSchema, signal }),
  getUser: (id: string, signal?: AbortSignal) =>
    request("GET", `admin/users/${enc(id)}`, { schema: portalUserSchema, signal }),
  createUser: (body: Req.CreatePortalUser) => request("POST", "admin/users", { body, schema: portalUserSchema }),
  updateUser: (id: string, body: Req.UpdatePortalUser) =>
    request("PATCH", `admin/users/${enc(id)}`, { body, schema: portalUserSchema }),
  activateUser: (id: string) => request("POST", `admin/users/${enc(id)}/activate`, { schema: portalUserSchema }),
  deactivateUser: (id: string) => request("POST", `admin/users/${enc(id)}/deactivate`, { schema: deactivatedSchema }),
  setUserPassword: (id: string, body: Req.AdminSetPassword) =>
    request("POST", `admin/users/${enc(id)}/set-password`, { body, schema: passwordSetSchema }),

  collectionReport: (filter: Req.ReportFilter, signal?: AbortSignal) =>
    request("GET", "admin/reports/collections/list", { query: reportQuery(filter), schema: collectionReportSchema, signal }),
  disbursementReport: (filter: Req.ReportFilter, signal?: AbortSignal) =>
    request("GET", "admin/reports/disbursements/list", { query: reportQuery(filter), schema: disbursementReportSchema, signal }),
  downloadReport: (kind: "collections" | "disbursements", filter: Req.ReportFilter) =>
    download(`admin/reports/${kind}`, reportQuery(filter)),

  listApprovalPolicies: (tenantId?: string, signal?: AbortSignal) =>
    request("GET", "admin/approval-policies", { query: { tenantId }, schema: approvalPolicyListSchema, signal }),
  upsertApprovalPolicy: (body: Req.UpsertApprovalPolicy) =>
    request("POST", "admin/approval-policies", { body, schema: approvalPolicySchema }),
  deleteApprovalPolicy: (id: string) =>
    request("DELETE", `admin/approval-policies/${enc(id)}`, { schema: emptySchema }),
};

/**
 * The approvals inbox. Afrikob staff and a tenant's own admin see the same
 * shape at different paths, so one set of functions serves both.
 */
export type ApprovalScope = "platform" | "tenant-admin";

const approvalsBase = (scope: ApprovalScope) => (scope === "platform" ? "admin/approvals" : "tenant-admin/approvals");

export const approvalsApi = {
  list: (scope: ApprovalScope, status?: string, signal?: AbortSignal) =>
    request("GET", approvalsBase(scope), { query: { status }, schema: approvalRequestListSchema, signal }),
  get: (scope: ApprovalScope, id: string, signal?: AbortSignal) =>
    request("GET", `${approvalsBase(scope)}/${enc(id)}`, { schema: approvalRequestSchema, signal }),
  decide: (scope: ApprovalScope, id: string, body: Req.DecideApproval) =>
    request("POST", `${approvalsBase(scope)}/${enc(id)}/decide`, { body, schema: approvalRequestSchema }),
};

/** A tenant's own administration: their tenant, their people, their top-up requests. */
export const tenantAdminApi = {
  tenant: (signal?: AbortSignal) => request("GET", "tenant-admin/tenant", { schema: tenantDetailSchema, signal }),
  listUsers: (signal?: AbortSignal) => request("GET", "tenant-admin/users", { schema: portalUserListSchema, signal }),
  getUser: (id: string, signal?: AbortSignal) =>
    request("GET", `tenant-admin/users/${enc(id)}`, { schema: portalUserSchema, signal }),
  createUser: (body: Req.CreateTenantScopedUser) => request("POST", "tenant-admin/users", { body, schema: portalUserSchema }),
  updateUser: (id: string, body: Req.UpdateTenantScopedUser) =>
    request("PATCH", `tenant-admin/users/${enc(id)}`, { body, schema: portalUserSchema }),
  activateUser: (id: string) => request("POST", `tenant-admin/users/${enc(id)}/activate`, { schema: portalUserSchema }),
  deactivateUser: (id: string) => request("POST", `tenant-admin/users/${enc(id)}/deactivate`, { schema: deactivatedSchema }),
  setUserPassword: (id: string, body: Req.AdminSetPassword) =>
    request("POST", `tenant-admin/users/${enc(id)}/set-password`, { body, schema: passwordSetSchema }),
  /** Always 202: the platform approves a tenant's request for funds. */
  requestTopUp: (body: Req.TopUp) =>
    requestResult("POST", "tenant-admin/wallets/topup-request", { body, schema: walletBalanceSchema }),
};

export const refundsApi = {
  /** Always 202 upstream: a refund request enters review rather than settling. */
  create: (transactionId: string, body: Req.CreateRefund, idempotencyKey: string) =>
    requestResult("POST", `payments/${enc(transactionId)}/refunds`, {
      body,
      headers: { "Idempotency-Key": idempotencyKey },
      schema: refundSchema,
    }),
  listForTransaction: (transactionId: string, signal?: AbortSignal) =>
    request("GET", `payments/${enc(transactionId)}/refunds`, { schema: refundListSchema, signal }),
  get: (refundId: string, signal?: AbortSignal) =>
    request("GET", `payments/refunds/${enc(refundId)}`, { schema: refundSchema, signal }),
};

export const transactionsApi = {
  list: (page: number, size: number, signal?: AbortSignal) =>
    request("GET", "transactions", { query: { page, size }, schema: transactionListSchema, signal }),
  get: (id: string, signal?: AbortSignal) =>
    request("GET", `transactions/${enc(id)}`, { schema: transactionSchema, signal }),
};

export const paymentsApi = {
  telcos: (signal?: AbortSignal) => request("GET", "payments/get-all-telcos", { schema: institutionListSchema, signal }),
  banks: (signal?: AbortSignal) => request("GET", "payments/get-all-banks", { schema: institutionListSchema, signal }),
  verifyName: (body: Req.NameVerify) => request("POST", "payments/verify-name", { body, schema: nameVerifySchema }),
  statusCheck: (body: Req.StatusCheck) => request("POST", "payments/status-check", { body, schema: gatewayStatusSchema }),
  disburse: (body: Req.Disbursement) => request("POST", "payments/disbursement", { body, schema: gatewayResponseSchema }),
  collect: (body: Req.Collection) => request("POST", "payments/collection", { body, schema: gatewayResponseSchema }),
  disbursementBalance: (currency = DEFAULT_CURRENCY, signal?: AbortSignal) =>
    request("GET", "payments/disbursement-balance", { query: { currency }, schema: walletBalanceSchema, signal }),
  collectionBalance: (currency = DEFAULT_CURRENCY, signal?: AbortSignal) =>
    request("GET", "payments/collection-balance", { query: { currency }, schema: walletBalanceSchema, signal }),
  bulkNameVerify: (body: Req.BulkNameVerify) =>
    request("POST", "payments/bulk-name-verify", { body, schema: bulkNameVerifySchema }),
  createBulk: (body: Req.BulkDisbursement, clientBatchId: string) =>
    request("POST", "payments/bulk-disbursements", {
      body,
      headers: { ClientBatchId: clientBatchId },
      schema: batchSchema,
    }),
  listBulk: (signal?: AbortSignal) => request("GET", "payments/bulk-disbursements", { schema: batchListSchema, signal }),
  getBulk: (batchId: string, signal?: AbortSignal) =>
    request("GET", `payments/bulk-disbursements/${enc(batchId)}`, { schema: batchDetailSchema, signal }),
  reconcileBulk: (batchId: string) =>
    request("POST", `payments/bulk-disbursements/${enc(batchId)}/reconcile`, { schema: batchSchema }),
  bulkStatus: (body: Req.BulkStatus) =>
    request("POST", "payments/bulk-disbursement-status", { body, schema: batchStatusSchema }),
};
