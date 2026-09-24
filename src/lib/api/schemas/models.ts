import { z } from "zod";
import { findArray } from "./normalize";

/**
 * Response models transcribed from Afrikob Swagger v1 (docs/api/swagger-v1.json).
 * Every object is `.loose()` so added fields never break a page, and scalars are
 * nullish-tolerant because the spec marks most properties nullable.
 */

const str = z.string().nullish().transform((v) => v ?? null);
const num = z.coerce.number().nullish().transform((v) => (v == null || Number.isNaN(v) ? null : v));
const flag = z.boolean().nullish().transform((v) => v ?? false);
const id = z.string().nullish().transform((v) => v ?? "");

/** Parses a list payload, tolerating a bare array or an object that wraps one. */
function listOf<S extends z.ZodType>(schema: S) {
  return z.unknown().transform((value, ctx): z.infer<S>[] => {
    const rows: z.infer<S>[] = [];
    for (const item of findArray(value)) {
      const parsed = schema.safeParse(item);
      if (!parsed.success) {
        ctx.addIssue({ code: "custom", message: parsed.error.issues[0]?.message ?? "Invalid row" });
        return z.NEVER;
      }
      rows.push(parsed.data);
    }
    return rows;
  });
}

/* ---------- Transactions ---------- */

export const transactionSchema = z
  .object({
    id: id,
    clientTransactionId: str,
    providerTransactionId: str,
    externalTransactionId: str,
    type: str,
    status: str,
    amount: num,
    currency: str,
    fee: num,
    netAmount: num,
    platformFee: num,
    accountName: str,
    accountNumberMasked: str,
    institutionCode: str,
    reference: str,
    providerCode: str,
    providerMessage: str,
    completedAt: str,
    refundedAmount: num,
    createdAt: str,
    updatedAt: str,
  })
  .loose();
export type Transaction = z.infer<typeof transactionSchema>;
export const transactionListSchema = listOf(transactionSchema);

export type TransactionKind = "collection" | "disbursement" | "refund" | "other";

/** Direction of money for the ledger rail and filters. */
export function transactionKind(type: string | null): TransactionKind {
  if (!type) return "other";
  if (/collect|debit|momo_in|receive|checkout/i.test(type)) return "collection";
  if (/disburs|payout|transfer|credit|send/i.test(type)) return "disbursement";
  if (/refund|revers/i.test(type)) return "refund";
  return "other";
}

/* ---------- Refunds ---------- */

export const refundSchema = z
  .object({
    id: id,
    tenantId: str,
    transactionId: str,
    clientRefundId: str,
    type: str,
    amount: num,
    currency: str,
    reason: str,
    status: str,
    requestedBy: str,
    approvedBy: str,
    approvedAt: str,
    rejectedBy: str,
    rejectedAt: str,
    rejectionReason: str,
    providerReference: str,
    providerNote: str,
    completedBy: str,
    completedAt: str,
    createdAt: str,
  })
  .loose();
export type Refund = z.infer<typeof refundSchema>;
export const refundListSchema = listOf(refundSchema);

/* ---------- Tenants, credentials, users ---------- */

export const tenantSchema = z
  .object({ id: id, code: str, displayName: str, status: str, createdAt: str })
  .loose();
export type Tenant = z.infer<typeof tenantSchema>;
export const tenantListSchema = listOf(tenantSchema);

export const createdTenantSchema = z.object({ tenantId: id, apiKey: str }).loose();
export type CreatedTenant = z.infer<typeof createdTenantSchema>;

export const issuedCredentialSchema = z
  .object({ credentialId: id, keyPrefix: str, apiKey: str })
  .loose();
export type IssuedCredential = z.infer<typeof issuedCredentialSchema>;

export const portalUserSchema = z
  .object({
    id: id,
    email: str,
    displayName: str,
    userType: str,
    tenantId: str,
    canMake: flag,
    canCheck: flag,
    isTenantAdmin: flag,
    isPlatformAdmin: flag,
    phoneNumber: str,
    preferredNotificationChannel: str,
    isActive: flag,
    lastLoginAt: str,
    createdAt: str,
  })
  .loose();
export type PortalUser = z.infer<typeof portalUserSchema>;
export const portalUserListSchema = listOf(portalUserSchema);

export const passwordSetSchema = z.object({ success: flag }).loose();
export const deactivatedSchema = z.object({ deactivated: flag }).loose();

/* ---------- Approvals ---------- */

export const approvalRequestSchema = z
  .object({
    id: id,
    actionKey: str,
    tenantId: str,
    resourceType: str,
    resourceId: str,
    /** The pending action's payload, as a JSON string. */
    rawPayloadJson: str,
    status: str,
    requiredApprovals: num,
    requestedBy: str,
    decidedSummary: str,
    decidedAt: str,
    createdAt: str,
  })
  .loose();
export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;
export const approvalRequestListSchema = listOf(approvalRequestSchema);

/** Reads the pending action's payload; a payload we cannot parse is shown as text. */
export function parseApprovalPayload(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/* ---------- Wallets, fees, policies ---------- */

export const walletBalanceSchema = z
  .object({ availableBalance: num, reservedBalance: num, totalBalance: num, currency: str })
  .loose();
export type WalletBalance = z.infer<typeof walletBalanceSchema>;

/** One wallet inside TenantDetailResponse. */
export const tenantWalletSchema = z
  .object({ walletType: str, currency: str, availableBalance: num, reservedBalance: num, totalBalance: num })
  .loose();
export type TenantWallet = z.infer<typeof tenantWalletSchema>;

export const tenantDetailSchema = z
  .object({
    id: id,
    code: str,
    legalName: str,
    displayName: str,
    status: str,
    currency: str,
    dailyLimit: num,
    perTransactionLimit: num,
    requestsPerMinute: num,
    requireNameVerification: flag,
    wallets: listOf(tenantWalletSchema),
    createdAt: str,
  })
  .loose();
export type TenantDetail = z.infer<typeof tenantDetailSchema>;

export const feeConfigSchema = z
  .object({ id: id, transactionType: str, percentageFee: num, isActive: flag })
  .loose();
export type FeeConfig = z.infer<typeof feeConfigSchema>;
export const feeConfigListSchema = listOf(feeConfigSchema);

export const approvalPolicySchema = z
  .object({
    id: id,
    actionKey: str,
    tenantId: str,
    isEnabled: flag,
    requiredApprovals: num,
    allowRequesterToApprove: flag,
  })
  .loose();
export type ApprovalPolicy = z.infer<typeof approvalPolicySchema>;
export const approvalPolicyListSchema = listOf(approvalPolicySchema);

/* ---------- Payments ---------- */

export const institutionSchema = z.object({ code: str, name: str, type: str }).loose();
export type Institution = z.infer<typeof institutionSchema>;
export const institutionListSchema = listOf(institutionSchema);

export const nameVerifySchema = z
  .object({ accountName: str, accountNumber: str, status: str, message: str })
  .loose();
export type NameVerification = z.infer<typeof nameVerifySchema>;

export const bulkNameVerifyResultSchema = z
  .object({ accountName: str, accountNumber: str, status: str, message: str })
  .loose();
export type BulkNameVerifyResult = z.infer<typeof bulkNameVerifyResultSchema>;
/** BulkNameVerifyResponse wraps the rows in `results`. */
export const bulkNameVerifySchema = z.unknown().transform((value) => {
  const source = value && typeof value === "object" && "results" in value ? (value as { results: unknown }).results : value;
  return findArray(source).map((row) => bulkNameVerifyResultSchema.parse(row));
});

export const gatewayResponseSchema = z
  .object({ transactionId: str, status: str, code: str, message: str, providerTransactionId: str })
  .loose();
export type GatewayResponse = z.infer<typeof gatewayResponseSchema>;

export const gatewayStatusSchema = z
  .object({
    accountName: str,
    accountNumber: str,
    amount: str,
    dateCreated: str,
    providerTransactionId: str,
    isReversed: flag,
    clientTransactionId: str,
    message: str,
  })
  .loose();
export type GatewayStatus = z.infer<typeof gatewayStatusSchema>;

/* ---------- Bulk disbursements ---------- */

export const batchSchema = z
  .object({
    id: id,
    clientBatchId: str,
    providerBulkTransactionId: str,
    currency: str,
    totalAmount: num,
    itemCount: num,
    status: str,
    errorMessage: str,
    createdAt: str,
    updatedAt: str,
  })
  .loose();
export type Batch = z.infer<typeof batchSchema>;
export const batchListSchema = listOf(batchSchema);

export const batchItemSchema = z
  .object({
    clientTransactionId: str,
    providerTransactionId: str,
    externalTransactionId: str,
    status: str,
    amount: num,
    currency: str,
    accountName: str,
    accountNumberMasked: str,
    institutionCode: str,
    reference: str,
    providerMessage: str,
    platformFee: num,
  })
  .loose();
export type BatchItem = z.infer<typeof batchItemSchema>;

export const batchDetailSchema = z
  .object({ batch: batchSchema, items: listOf(batchItemSchema) })
  .loose();
export type BatchDetail = z.infer<typeof batchDetailSchema>;

export const batchStatusItemSchema = z
  .object({ clientTransactionId: str, providerTransactionId: str, externalTransactionId: str, status: str, message: str })
  .loose();
export const batchStatusSchema = z
  .object({
    id: id,
    clientBatchId: str,
    providerBulkTransactionId: str,
    status: str,
    items: listOf(batchStatusItemSchema),
  })
  .loose();
export type BatchStatus = z.infer<typeof batchStatusSchema>;

/* ---------- Reports ---------- */

export const collectionReportRowSchema = z
  .object({
    dateCreated: str,
    dateUpdated: str,
    branch: str,
    branchType: str,
    customerEmail: str,
    transactionId: str,
    institutionCode: str,
    reference: str,
    channel: str,
    transactionAction: str,
    currency: str,
    transactionStatus: str,
    amount: num,
    fee: num,
    merchantFeeValue: num,
    customerFeeValue: num,
    transactedAmount: num,
    netToMerchant: num,
    transactionAccountNumber: str,
    transactionAccountName: str,
    domain: str,
    failureReason: str,
    paymentSlug: str,
  })
  .loose();
export type CollectionReportRow = z.infer<typeof collectionReportRowSchema>;
export const collectionReportSchema = listOf(collectionReportRowSchema);

export const disbursementReportRowSchema = collectionReportRowSchema.extend({
  businessName: str,
  externalTransactionId: str,
  totalAmount: num,
  transactionMessage: str,
  ipAddress: str,
  transactionType: str,
  transactionMemo: str,
});
export type DisbursementReportRow = z.infer<typeof disbursementReportRowSchema>;
export const disbursementReportSchema = listOf(disbursementReportRowSchema);

export type ReportRow = CollectionReportRow & Partial<DisbursementReportRow>;

/** Endpoints with no useful payload (204, or a bare acknowledgement). */
export const emptySchema = z.unknown().transform(() => null);
