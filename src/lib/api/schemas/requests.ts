import { z } from "zod";

/**
 * Request payload schemas transcribed from Afrikob Swagger v1, tightened with
 * UI-level validation (the spec marks nearly every field nullable).
 */
const MAX_REFERENCE = 100;
const MAX_NAME = 150;
const MAX_CODE = 50;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 256;
const ACCOUNT_NUMBER = /^[0-9A-Za-z]{6,20}$/;
const MOBILE = /^\+?[0-9]{9,15}$/;

const money = z.coerce.number({ error: "Enter an amount" }).positive("Must be greater than 0").max(1_000_000_000);
const currency = z.string().trim().length(3, "Use a 3-letter ISO code").toUpperCase().default("GHS");
const requiredText = (label: string, max = MAX_NAME) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);
const optionalText = (max = MAX_REFERENCE) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v ? v : undefined))
    .optional();

/* ---------- Portal auth ---------- */

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD, `Use at least ${MIN_PASSWORD} characters`)
  .max(MAX_PASSWORD);

export const portalLoginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password").max(MAX_PASSWORD),
});
export type PortalLogin = z.output<typeof portalLoginSchema>;

export const apiKeyLoginSchema = z.object({
  apiKey: z.string().trim().min(8, "Enter your API key").max(512),
});
export type ApiKeyLogin = z.output<typeof apiKeyLoginSchema>;

export const forgotPasswordSchema = z.object({ email: z.email("Enter a valid email address") });
export type ForgotPassword = z.output<typeof forgotPasswordSchema>;

export const verifyCodeSchema = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9-]{4,12}$/, "Enter the code from your email"),
});
export type VerifyCode = z.output<typeof verifyCodeSchema>;

export const resetPasswordSchema = z
  .object({ newPassword: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "The passwords do not match",
    path: ["confirmPassword"],
  });
export type ResetPassword = z.output<typeof resetPasswordSchema>;

/* ---------- Admin: tenants, users, fees, policies ---------- */

export const createTenantSchema = z.object({
  code: requiredText("Code", MAX_CODE).regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, - and _ only"),
  legalName: requiredText("Legal name"),
  displayName: requiredText("Display name"),
  dailyLimit: z.coerce.number().nonnegative().optional(),
  requestsPerMinute: z.coerce.number().int().positive().max(100_000).default(60),
  perTransactionLimit: z.coerce.number().nonnegative().optional(),
});
export type CreateTenantInput = z.input<typeof createTenantSchema>;
export type CreateTenant = z.output<typeof createTenantSchema>;

export const issueCredentialSchema = z.object({ name: requiredText("Credential name", MAX_NAME) });
export type IssueCredential = z.output<typeof issueCredentialSchema>;

/** The only values the gateway accepts: "UserType must be 'Platform' or 'Tenant'." */
export const USER_TYPES = ["Platform", "Tenant"] as const;
export type UserType = (typeof USER_TYPES)[number];

/** How the gateway may reach someone about approvals. */
export const NOTIFICATION_CHANNELS = ["Email", "SMS"] as const;
const notificationChannel = z.enum(NOTIFICATION_CHANNELS).default("Email");
const phoneNumber = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{9,15}$/, "Enter a valid phone number")
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined))
  .optional();

export const createPortalUserSchema = z.object({
  email: z.email("Enter a valid email address"),
  displayName: requiredText("Name"),
  userType: z.enum(USER_TYPES),
  tenantId: optionalText(MAX_CODE),
  password: passwordSchema,
  canMake: z.boolean().default(true),
  canCheck: z.boolean().default(false),
  isTenantAdmin: z.boolean().default(false),
  isPlatformAdmin: z.boolean().default(false),
  phoneNumber,
  preferredNotificationChannel: notificationChannel,
});

/** A tenant admin creating someone inside their own tenant: no tenantId, no platform flag. */
export const createTenantScopedUserSchema = z.object({
  email: z.email("Enter a valid email address"),
  displayName: requiredText("Name"),
  password: passwordSchema,
  canMake: z.boolean().default(true),
  canCheck: z.boolean().default(false),
  isTenantAdmin: z.boolean().default(false),
  phoneNumber,
  preferredNotificationChannel: notificationChannel,
});
export type CreateTenantScopedUserInput = z.input<typeof createTenantScopedUserSchema>;
export type CreateTenantScopedUser = z.output<typeof createTenantScopedUserSchema>;

export const updateTenantScopedUserSchema = z.object({
  displayName: requiredText("Name"),
  canMake: z.boolean().default(true),
  canCheck: z.boolean().default(false),
  isTenantAdmin: z.boolean().default(false),
  phoneNumber,
  preferredNotificationChannel: notificationChannel,
});
export type UpdateTenantScopedUserInput = z.input<typeof updateTenantScopedUserSchema>;
export type UpdateTenantScopedUser = z.output<typeof updateTenantScopedUserSchema>;

/**
 * One form shape behind both People screens. The scope decides which request
 * schema it is parsed into on submit, and Zod drops the fields that scope does
 * not send.
 */
export const personFormSchema = z.object({
  email: z.email("Enter a valid email address"),
  displayName: requiredText("Name"),
  userType: z.enum(USER_TYPES).default("Platform"),
  tenantId: optionalText(MAX_CODE),
  password: passwordSchema,
  canMake: z.boolean().default(true),
  canCheck: z.boolean().default(false),
  isTenantAdmin: z.boolean().default(false),
  isPlatformAdmin: z.boolean().default(false),
  phoneNumber,
  preferredNotificationChannel: notificationChannel,
});
export type PersonFormInput = z.input<typeof personFormSchema>;
export type PersonForm = z.output<typeof personFormSchema>;

export const personEditFormSchema = z.object({
  displayName: requiredText("Name"),
  canMake: z.boolean().default(true),
  canCheck: z.boolean().default(false),
  isTenantAdmin: z.boolean().default(false),
  isPlatformAdmin: z.boolean().default(false),
  phoneNumber,
  preferredNotificationChannel: notificationChannel,
});
export type PersonEditFormInput = z.input<typeof personEditFormSchema>;
export type PersonEditForm = z.output<typeof personEditFormSchema>;

/** Approve or reject a pending action; a rejection explains itself. */
export const decideApprovalSchema = z
  .object({ approve: z.boolean(), comment: optionalText(500) })
  .refine((v) => v.approve || Boolean(v.comment), {
    message: "Say why you are rejecting it",
    path: ["comment"],
  });
export type DecideApprovalInput = z.input<typeof decideApprovalSchema>;
export type DecideApproval = z.output<typeof decideApprovalSchema>;
export type CreatePortalUserInput = z.input<typeof createPortalUserSchema>;
export type CreatePortalUser = z.output<typeof createPortalUserSchema>;

export const updatePortalUserSchema = z.object({
  displayName: requiredText("Name"),
  canMake: z.boolean().default(true),
  canCheck: z.boolean().default(false),
  isTenantAdmin: z.boolean().default(false),
  isPlatformAdmin: z.boolean().default(false),
  phoneNumber,
  preferredNotificationChannel: notificationChannel,
});
export type UpdatePortalUserInput = z.input<typeof updatePortalUserSchema>;
export type UpdatePortalUser = z.output<typeof updatePortalUserSchema>;

export const adminSetPasswordSchema = z.object({ newPassword: passwordSchema });
export type AdminSetPassword = z.output<typeof adminSetPasswordSchema>;

export const rejectRefundSchema = z.object({ reason: requiredText("Reason", 500) });
export type RejectRefund = z.output<typeof rejectRefundSchema>;

export const completeRefundSchema = z.object({
  success: z.boolean(),
  providerReference: optionalText(),
  providerNote: optionalText(500),
});
export type CompleteRefund = z.output<typeof completeRefundSchema>;

export const topUpSchema = z.object({
  currency,
  amount: money,
  reference: requiredText("Reference", MAX_REFERENCE),
  walletType: optionalText(MAX_CODE),
});
export type TopUpInput = z.input<typeof topUpSchema>;
export type TopUp = z.output<typeof topUpSchema>;

export const upsertFeeSchema = z.object({
  transactionType: requiredText("Transaction type", MAX_CODE),
  percentageFee: z.coerce.number().min(0, "Cannot be negative").max(100, "Max 100%"),
});
export type UpsertFeeInput = z.input<typeof upsertFeeSchema>;
export type UpsertFee = z.output<typeof upsertFeeSchema>;

export const upsertApprovalPolicySchema = z.object({
  actionKey: requiredText("Action key", MAX_CODE),
  tenantId: optionalText(MAX_CODE),
  isEnabled: z.boolean().default(true),
  requiredApprovals: z.coerce.number().int().min(1).max(10).default(1),
  allowRequesterToApprove: z.boolean().default(false),
});
export type UpsertApprovalPolicyInput = z.input<typeof upsertApprovalPolicySchema>;
export type UpsertApprovalPolicy = z.output<typeof upsertApprovalPolicySchema>;

/** Filters shared by both report endpoints (table view and file export). */
export const reportFilterSchema = z.object({
  tenantId: optionalText(MAX_CODE),
  fromDate: optionalText(30),
  toDate: optionalText(30),
  status: optionalText(MAX_CODE),
  currency: optionalText(3),
});
export type ReportFilterInput = z.input<typeof reportFilterSchema>;
export type ReportFilter = z.output<typeof reportFilterSchema>;

/* ---------- Payments ---------- */

export const createRefundSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  reason: requiredText("Reason", 500),
});
export type CreateRefundInput = z.input<typeof createRefundSchema>;
export type CreateRefund = z.output<typeof createRefundSchema>;

export const nameVerifySchema = z.object({
  accountNumber: z.string().trim().regex(ACCOUNT_NUMBER, "Enter a valid account or wallet number"),
  institutionCode: requiredText("Institution", MAX_CODE),
});
export type NameVerify = z.output<typeof nameVerifySchema>;

export const statusCheckSchema = z.object({
  clientTransactionId: requiredText("Client transaction ID", MAX_REFERENCE),
});
export type StatusCheck = z.output<typeof statusCheckSchema>;

export const disbursementSchema = z.object({
  clientTransactionId: requiredText("Client transaction ID", MAX_REFERENCE),
  accountNumber: z.string().trim().regex(ACCOUNT_NUMBER, "Enter a valid account or wallet number"),
  institutionCode: requiredText("Institution", MAX_CODE),
  amount: money,
  currency,
  reference: requiredText("Reference", MAX_REFERENCE),
  accountName: requiredText("Account name"),
});
export type DisbursementInput = z.input<typeof disbursementSchema>;
export type Disbursement = z.output<typeof disbursementSchema>;

export const collectionSchema = z.object({
  clientTransactionId: requiredText("Client transaction ID", MAX_REFERENCE),
  walletNumber: z.string().trim().regex(MOBILE, "Enter a valid mobile wallet number"),
  institutionCode: requiredText("Network", MAX_CODE),
  amount: money,
  currency,
  reference: requiredText("Reference", MAX_REFERENCE),
  walletName: optionalText(MAX_NAME),
});
export type CollectionInput = z.input<typeof collectionSchema>;
export type Collection = z.output<typeof collectionSchema>;

export const bulkNameVerifySchema = z.object({ accounts: z.array(nameVerifySchema).min(1).max(1000) });
export type BulkNameVerify = z.output<typeof bulkNameVerifySchema>;

export const bulkDisbursementItemSchema = disbursementSchema.extend({
  transactionId: optionalText(MAX_REFERENCE),
});
export type BulkDisbursementItem = z.output<typeof bulkDisbursementItemSchema>;

export const bulkDisbursementSchema = z.object({
  disbursements: z.array(bulkDisbursementItemSchema).min(1, "Add at least one row").max(1000, "Max 1000 rows per batch"),
});
export type BulkDisbursement = z.output<typeof bulkDisbursementSchema>;

export const bulkStatusSchema = z.object({ bulk_transaction_id: requiredText("Batch ID", MAX_REFERENCE) });
export type BulkStatus = z.output<typeof bulkStatusSchema>;

/** Client-generated unique id for idempotent payment submissions. */
export function newClientTransactionId(prefix = "AFK"): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}
