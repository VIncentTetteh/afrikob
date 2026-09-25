import { z } from "zod";
import {
  accountHolder,
  amount,
  anyAccount,
  clientReference,
  code,
  currency,
  destinationAccount,
  emailAddress,
  ghanaMobile,
  isoDate,
  narration,
  newPassword,
  optionalLimit,
  personName,
  phoneNumber,
  text,
  entityId,
} from "@/lib/validation/fields";

/**
 * Request payload schemas transcribed from Afrikob Swagger v1. The spec declares
 * no constraints (every field nullable, none required), so every rule here is
 * ours: see src/lib/validation/fields.ts.
 */
const MAX_PASSWORD = 256;
const MAX_NOTE = 500;

/** Blank means "not given"; otherwise the value must pass `schema`. */
function optional<S extends z.ZodType>(schema: S) {
  return z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), schema.optional());
}

/* ---------- Portal auth ---------- */

/** A password being set. Signing in accepts whatever the gateway already holds. */
export const passwordSchema = newPassword;

export const portalLoginSchema = z.object({
  email: emailAddress,
  password: z.string().min(1, "Enter your password").max(MAX_PASSWORD),
});
export type PortalLogin = z.output<typeof portalLoginSchema>;

export const forgotPasswordSchema = z.object({ email: emailAddress });
export type ForgotPassword = z.output<typeof forgotPasswordSchema>;

export const verifyCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s/g, ""))
    .pipe(z.string().regex(/^[A-Za-z0-9-]{4,12}$/, "Enter the code from your email")),
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

export const createTenantSchema = z
  .object({
    code: code("Code", 20),
    legalName: accountHolder("Registered name"),
    displayName: accountHolder("Trading name"),
    dailyLimit: optionalLimit("Daily limit"),
    requestsPerMinute: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.coerce.number({ error: "Enter a whole number" }).int("Enter a whole number").min(1).max(100_000).default(60),
    ),
    perTransactionLimit: optionalLimit("Per-payment limit"),
  })
  .refine((t) => t.dailyLimit === undefined || t.perTransactionLimit === undefined || t.perTransactionLimit <= t.dailyLimit, {
    message: "Cannot be more than the daily limit",
    path: ["perTransactionLimit"],
  });
export type CreateTenantInput = z.input<typeof createTenantSchema>;
export type CreateTenant = z.output<typeof createTenantSchema>;

export const issueCredentialSchema = z.object({ name: narration("Key name", 100) });
export type IssueCredential = z.output<typeof issueCredentialSchema>;

/** The only values the gateway accepts: "UserType must be 'Platform' or 'Tenant'." */
export const USER_TYPES = ["Platform", "Tenant"] as const;
export type UserType = (typeof USER_TYPES)[number];

/** How the gateway may reach someone about approvals. */
export const NOTIFICATION_CHANNELS = ["Email", "SMS"] as const;
const notificationChannel = z.enum(NOTIFICATION_CHANNELS).default("Email");
/** SMS needs a number to send to. */
const smsNeedsPhone = (v: { preferredNotificationChannel?: string; phoneNumber?: string }) =>
  v.preferredNotificationChannel !== "SMS" || Boolean(v.phoneNumber);
const SMS_NEEDS_PHONE = { message: "Add a phone number to be reached by SMS", path: ["phoneNumber"] };

export const createPortalUserSchema = z.object({
  email: emailAddress,
  displayName: personName(),
  userType: z.enum(USER_TYPES),
  tenantId: optional(entityId("Tenant")),
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
  email: emailAddress,
  displayName: personName(),
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
  displayName: personName(),
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
export const personFormSchema = z
  .object({
    email: emailAddress,
    displayName: personName(),
    userType: z.enum(USER_TYPES).default("Platform"),
    tenantId: optional(entityId("Tenant")),
    password: passwordSchema,
    canMake: z.boolean().default(true),
    canCheck: z.boolean().default(false),
    isTenantAdmin: z.boolean().default(false),
    isPlatformAdmin: z.boolean().default(false),
    phoneNumber,
    preferredNotificationChannel: notificationChannel,
  })
  // Staff forms send userType; a tenant user must name their tenant, staff must not.
  .refine((v) => v.userType !== "Tenant" || Boolean(v.tenantId), { message: "Choose the tenant they work for", path: ["tenantId"] })
  .refine((v) => v.userType !== "Platform" || !v.tenantId, { message: "Afrikob staff do not belong to a tenant", path: ["tenantId"] })
  .refine((v) => v.userType !== "Tenant" || !v.isPlatformAdmin, { message: "A tenant user cannot be a platform administrator", path: ["isPlatformAdmin"] })
  .refine(smsNeedsPhone, SMS_NEEDS_PHONE);
export type PersonFormInput = z.input<typeof personFormSchema>;
export type PersonForm = z.output<typeof personFormSchema>;

export const personEditFormSchema = z
  .object({
    displayName: personName(),
    canMake: z.boolean().default(true),
    canCheck: z.boolean().default(false),
    isTenantAdmin: z.boolean().default(false),
    isPlatformAdmin: z.boolean().default(false),
    phoneNumber,
    preferredNotificationChannel: notificationChannel,
  })
  .refine(smsNeedsPhone, SMS_NEEDS_PHONE);
export type PersonEditFormInput = z.input<typeof personEditFormSchema>;
export type PersonEditForm = z.output<typeof personEditFormSchema>;

/** Approve or reject a pending action; a rejection explains itself. */
export const decideApprovalSchema = z
  .object({ approve: z.boolean(), comment: text("Comment", MAX_NOTE, { required: false }) })
  .refine((v) => v.approve || Boolean(v.comment), {
    message: "Say why you are rejecting it",
    path: ["comment"],
  });
export type DecideApprovalInput = z.input<typeof decideApprovalSchema>;
export type DecideApproval = z.output<typeof decideApprovalSchema>;
export type CreatePortalUserInput = z.input<typeof createPortalUserSchema>;
export type CreatePortalUser = z.output<typeof createPortalUserSchema>;

export const updatePortalUserSchema = z.object({
  displayName: personName(),
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

export const rejectRefundSchema = z.object({ reason: text("Reason", MAX_NOTE) });
export type RejectRefund = z.output<typeof rejectRefundSchema>;

export const completeRefundSchema = z
  .object({
    success: z.boolean(),
    providerReference: optional(narration("Provider reference", 100)),
    providerNote: text("Note", MAX_NOTE, { required: false }),
  })
  // A refund marked as paid must say where the money went.
  .refine((v) => !v.success || Boolean(v.providerReference), {
    message: "Add the provider's reference for a completed refund",
    path: ["providerReference"],
  });
export type CompleteRefund = z.output<typeof completeRefundSchema>;

/** The two wallets a tenant holds. */
export const WALLET_TYPES = ["COLLECTION", "DISBURSEMENT"] as const;

export const topUpSchema = z.object({
  currency,
  amount: amount(),
  reference: narration(),
  walletType: optional(z.enum(WALLET_TYPES, { error: "Choose a wallet" })),
});
export type TopUpInput = z.input<typeof topUpSchema>;
export type TopUp = z.output<typeof topUpSchema>;

export const upsertFeeSchema = z.object({
  transactionType: code("Transaction type"),
  percentageFee: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z
      .union([z.number(), z.string().regex(/^\d{1,3}(\.\d{1,2})?$/, "Use a percentage with at most 2 decimal places")])
      .transform(Number)
      .refine((n) => n >= 0 && n <= 100, "Use a percentage from 0 to 100"),
  ),
});
export type UpsertFeeInput = z.input<typeof upsertFeeSchema>;
export type UpsertFee = z.output<typeof upsertFeeSchema>;

export const upsertApprovalPolicySchema = z.object({
  actionKey: code("Action"),
  tenantId: optional(entityId("Tenant")),
  isEnabled: z.boolean().default(true),
  requiredApprovals: z.coerce.number().int().min(1).max(10).default(1),
  allowRequesterToApprove: z.boolean().default(false),
});
export type UpsertApprovalPolicyInput = z.input<typeof upsertApprovalPolicySchema>;
export type UpsertApprovalPolicy = z.output<typeof upsertApprovalPolicySchema>;

/** Filters shared by both report endpoints (table view and file export). */
export const reportFilterSchema = z
  .object({
    tenantId: optional(entityId("Tenant")),
    fromDate: optional(isoDate),
    toDate: optional(isoDate),
    status: optional(z.string().trim().max(50).regex(/^[A-Za-z_ -]+$/, "Choose a state from the list")),
    currency: optional(currency),
  })
  .refine((f) => !f.fromDate || !f.toDate || f.fromDate <= f.toDate, { message: "The start date is after the end date", path: ["toDate"] });
export type ReportFilterInput = z.input<typeof reportFilterSchema>;
export type ReportFilter = z.output<typeof reportFilterSchema>;

/* ---------- Payments ---------- */

export const createRefundSchema = z.object({
  amount: optional(amount("Refund amount")),
  reason: text("Reason", MAX_NOTE),
});
export type CreateRefundInput = z.input<typeof createRefundSchema>;
export type CreateRefund = z.output<typeof createRefundSchema>;

export const nameVerifySchema = z.object({
  accountNumber: anyAccount,
  institutionCode: code("Institution"),
});
export type NameVerify = z.output<typeof nameVerifySchema>;

export const statusCheckSchema = z.object({
  clientTransactionId: clientReference,
});
export type StatusCheck = z.output<typeof statusCheckSchema>;

export const disbursementSchema = z.object({
  clientTransactionId: clientReference,
  accountNumber: anyAccount,
  institutionCode: code("Institution"),
  amount: amount(),
  currency,
  reference: narration(),
  accountName: accountHolder(),
});

/**
 * Checks the destination against the institution's kind: a telco gets a
 * Ghanaian mobile number (sent in national form), a bank an account number.
 * `telcoCodes` come from `payments/get-all-telcos`.
 */
export function withDestination<S extends z.ZodType<{ accountNumber: string; institutionCode: string }>>(
  schema: S,
  telcoCodes: ReadonlySet<string>,
) {
  return schema.transform((value, ctx) => {
    const checked = destinationAccount(value.institutionCode, telcoCodes).safeParse(value.accountNumber);
    if (!checked.success) {
      ctx.addIssue({ code: "custom", message: checked.error.issues[0]?.message ?? "Invalid account", path: ["accountNumber"] });
      return z.NEVER;
    }
    return { ...value, accountNumber: checked.data };
  });
}
export type DisbursementInput = z.input<typeof disbursementSchema>;
export type Disbursement = z.output<typeof disbursementSchema>;

export const collectionSchema = z.object({
  clientTransactionId: clientReference,
  walletNumber: ghanaMobile,
  institutionCode: code("Network"),
  amount: amount(),
  currency,
  reference: narration(),
  walletName: optional(accountHolder("Wallet name")),
});
export type CollectionInput = z.input<typeof collectionSchema>;
export type Collection = z.output<typeof collectionSchema>;

export const bulkNameVerifySchema = z.object({ accounts: z.array(nameVerifySchema).min(1).max(1000) });
export type BulkNameVerify = z.output<typeof bulkNameVerifySchema>;

export const bulkDisbursementItemSchema = disbursementSchema.extend({
  transactionId: optional(clientReference),
});
export type BulkDisbursementItem = z.output<typeof bulkDisbursementItemSchema>;

export const bulkDisbursementSchema = z.object({
  disbursements: z.array(bulkDisbursementItemSchema).min(1, "Add at least one row").max(1000, "Max 1000 rows per batch"),
});
export type BulkDisbursement = z.output<typeof bulkDisbursementSchema>;

export const bulkStatusSchema = z.object({ bulk_transaction_id: clientReference });
export type BulkStatus = z.output<typeof bulkStatusSchema>;

/** Client-generated unique id for idempotent payment submissions. */
export function newClientTransactionId(prefix = "AFK"): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}
