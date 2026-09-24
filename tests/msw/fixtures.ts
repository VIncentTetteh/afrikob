/**
 * Payloads shaped by Afrikob Swagger v1 (docs/api/swagger-v1.json).
 * Replace values (not shapes) with Phase 0 captures once the gateway is reachable.
 */
export const envelope = <T>(data: T, overrides: Record<string, unknown> = {}) => ({
  statusCode: 0,
  message: "Success",
  data,
  transactionReference: null,
  timestamp: "2026-09-18T09:00:00Z",
  errors: [],
  validationErrors: null,
  metadata: {},
  ...overrides,
});

export const failure = (message: string, overrides: Record<string, unknown> = {}) =>
  envelope(null, { statusCode: 1, message, ...overrides });

export const pendingApproval = (approvalRequestId = "apr-1") =>
  envelope({ pendingApproval: true, approvalRequestId }, { message: "Sent for approval." });

export const problem = (title: string, detail?: string) => ({
  type: "https://tools.ietf.org/html/rfc7231",
  title,
  status: 400,
  detail,
  instance: null,
});

export const portalUser = {
  userId: "usr-1",
  email: "ops@afrikob.com",
  displayName: "Doris Bosompem",
  userType: "Admin",
  tenantId: null,
  canMake: true,
  canCheck: true,
};

export const transactions = [
  {
    id: "3f1a5d20-0000-4000-8000-000000000001",
    clientTransactionId: "COL-1",
    providerTransactionId: "TXM_DWtkXVoW42XLTkn3",
    externalTransactionId: null,
    type: "Collection",
    status: "Successful",
    amount: 10,
    currency: "GHS",
    fee: 0.2,
    netAmount: 9.8,
    platformFee: 0.1,
    accountName: "Afikob Limited Company",
    accountNumberMasked: "024****567",
    institutionCode: "MTN",
    reference: "test 1",
    providerCode: "000",
    providerMessage: "Approved",
    completedAt: "2026-09-16T15:58:00Z",
    refundedAmount: 0,
    createdAt: "2026-09-16T15:39:00Z",
    updatedAt: "2026-09-16T15:58:00Z",
  },
  {
    id: "3f1a5d20-0000-4000-8000-000000000002",
    clientTransactionId: "PAY-1",
    providerTransactionId: "1230024234",
    externalTransactionId: "EXT-9",
    type: "Disbursement",
    status: "Failed",
    amount: 25.5,
    currency: "GHS",
    fee: 1,
    netAmount: 24.5,
    platformFee: 0.5,
    accountName: "Kofi Boateng",
    accountNumberMasked: "851****680",
    institutionCode: "GCB",
    reference: "QW12",
    providerCode: "909",
    providerMessage: "Account not found",
    completedAt: null,
    refundedAmount: 0,
    createdAt: "2026-09-15T19:24:00Z",
    updatedAt: "2026-09-15T19:25:00Z",
  },
  {
    id: "3f1a5d20-0000-4000-8000-000000000003",
    clientTransactionId: "COL-2",
    providerTransactionId: null,
    externalTransactionId: null,
    type: "Collection",
    status: "Pending",
    amount: 5,
    currency: "GHS",
    fee: 0,
    netAmount: 5,
    platformFee: 0,
    accountName: null,
    accountNumberMasked: "055****111",
    institutionCode: "VOD",
    reference: "XWVYI0",
    providerCode: null,
    providerMessage: "Awaiting customer approval",
    completedAt: null,
    refundedAmount: 0,
    createdAt: "2026-09-10T08:00:00Z",
    updatedAt: "2026-09-10T08:00:00Z",
  },
];

export const tenants = [
  { id: "ten-1", code: "AFIKOB", displayName: "Afikob", status: "Active", createdAt: "2026-01-04T10:00:00Z" },
  { id: "ten-2", code: "KOBO", displayName: "Kobo Ventures", status: "Suspended", createdAt: "2026-02-11T10:00:00Z" },
];

export const refunds = [
  {
    id: "ref-1",
    tenantId: "ten-1",
    transactionId: "3f1a5d20-0000-4000-8000-000000000001",
    clientRefundId: null,
    type: "Full",
    amount: 10,
    currency: "GHS",
    reason: "Duplicate charge",
    status: "Pending",
    requestedBy: "ops@afikob.com",
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    providerReference: null,
    providerNote: null,
    completedBy: null,
    completedAt: null,
    createdAt: "2026-09-17T09:00:00Z",
  },
  {
    id: "ref-2",
    tenantId: "ten-1",
    transactionId: "3f1a5d20-0000-4000-8000-000000000002",
    clientRefundId: null,
    type: "Partial",
    amount: 5,
    currency: "GHS",
    reason: "Customer request",
    status: "Approved",
    requestedBy: "ops@afikob.com",
    approvedBy: "Doris Bosompem",
    approvedAt: "2026-09-17T10:00:00Z",
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    providerReference: null,
    providerNote: null,
    completedBy: null,
    completedAt: null,
    createdAt: "2026-09-16T09:00:00Z",
  },
];

export const wallet = { availableBalance: 9958.6, reservedBalance: 41.4, totalBalance: 10000, currency: "GHS" };

export const banks = [
  { code: "GCB", name: "GCB Bank", type: "Bank" },
  { code: "ECO", name: "Ecobank Ghana", type: "Bank" },
];
export const telcos = [
  { code: "MTN", name: "MTN Mobile Money", type: "Telco" },
  { code: "VOD", name: "Telecel Cash", type: "Telco" },
];

export const users = [
  {
    id: "usr-1",
    email: "ops@afrikob.com",
    displayName: "Doris Bosompem",
    userType: "Admin",
    tenantId: null,
    canMake: true,
    canCheck: true,
    isActive: true,
    lastLoginAt: "2026-09-18T08:00:00Z",
    createdAt: "2026-01-02T08:00:00Z",
  },
  {
    id: "usr-2",
    email: "finance@afrikob.com",
    displayName: "Yaw Owusu",
    userType: "Finance",
    tenantId: null,
    canMake: true,
    canCheck: false,
    isActive: false,
    lastLoginAt: null,
    createdAt: "2026-03-02T08:00:00Z",
  },
];

export const collectionReportRows = [
  {
    dateCreated: "2026-09-16T15:39:00Z",
    dateUpdated: "2026-09-16T15:58:00Z",
    branch: "Afikob Limited Company",
    branchType: "Main",
    customerEmail: "customer@example.com",
    transactionId: "TXM_DWtkXVoW42XLTkn3",
    institutionCode: "MTN",
    reference: "test 1",
    channel: "API",
    transactionAction: "Collection",
    currency: "GHS",
    transactionStatus: "Successful",
    amount: 10,
    fee: 0.2,
    merchantFeeValue: 0.2,
    customerFeeValue: 0,
    transactedAmount: 10,
    netToMerchant: 9.8,
    transactionAccountNumber: "024****567",
    transactionAccountName: "Ama Mensah",
    domain: "live",
    failureReason: null,
    paymentSlug: null,
  },
];

export const batch = {
  id: "bat-1",
  clientBatchId: "BATCH-001",
  providerBulkTransactionId: "PB-99",
  currency: "GHS",
  totalAmount: 35.5,
  itemCount: 2,
  status: "Processing",
  errorMessage: null,
  createdAt: "2026-09-17T12:00:00Z",
  updatedAt: "2026-09-17T12:05:00Z",
};

export const batchDetail = {
  batch,
  items: [
    {
      clientTransactionId: "BLK-1",
      providerTransactionId: "P-1",
      externalTransactionId: null,
      status: "Successful",
      amount: 10,
      currency: "GHS",
      accountName: "Ama Mensah",
      accountNumberMasked: "024****567",
      institutionCode: "MTN",
      reference: "r1",
      providerMessage: "Paid",
      platformFee: 0.1,
    },
    {
      clientTransactionId: "BLK-2",
      providerTransactionId: null,
      externalTransactionId: null,
      status: "Failed",
      amount: 25.5,
      currency: "GHS",
      accountName: "Kofi Boateng",
      accountNumberMasked: "851****680",
      institutionCode: "GCB",
      reference: "r2",
      providerMessage: "Account closed",
      platformFee: 0,
    },
  ],
};

export const approvals = [
  {
    id: "apr-1",
    actionKey: "WALLET_TOPUP",
    tenantId: "ten-1",
    resourceType: "Wallet",
    resourceId: "ten-1",
    rawPayloadJson: JSON.stringify({ currency: "GHS", amount: 2500, reference: "DEP-771", walletType: "DISBURSEMENT" }),
    status: "Pending",
    requiredApprovals: 1,
    requestedBy: "owner@afikob.com",
    decidedSummary: null,
    decidedAt: null,
    createdAt: "2026-09-23T10:00:00Z",
  },
];

export const tenantDetail = {
  id: "ten-1",
  code: "AFIKOB",
  legalName: "Afikob Limited Company",
  displayName: "Afikob",
  status: "Active",
  currency: "GHS",
  dailyLimit: 50000,
  perTransactionLimit: 5000,
  requestsPerMinute: 60,
  requireNameVerification: true,
  wallets: [
    { walletType: "DISBURSEMENT", currency: "GHS", availableBalance: 9958.6, reservedBalance: 41.4, totalBalance: 10000 },
    { walletType: "COLLECTION", currency: "GHS", availableBalance: 1200, reservedBalance: 0, totalBalance: 1200 },
  ],
};
