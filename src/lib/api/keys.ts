import type { ReportFilter } from "./schemas/requests";

/** Query-key factory; hierarchical so invalidating a prefix refreshes all children. */
export const qk = {
  session: ["session"] as const,
  tenants: { all: ["tenants"] as const },
  users: {
    all: ["users"] as const,
    list: (tenantId?: string, userType?: string) => ["users", "list", tenantId ?? "all", userType ?? "all"] as const,
    detail: (id: string) => ["users", "detail", id] as const,
  },
  refunds: {
    all: ["refunds"] as const,
    admin: (status?: string) => ["refunds", "admin", status ?? "all"] as const,
    forTransaction: (txId: string) => ["refunds", "tx", txId] as const,
    detail: (id: string) => ["refunds", "detail", id] as const,
  },
  wallets: {
    all: ["wallets"] as const,
    tenant: (tenantId: string, currency?: string, walletType?: string) =>
      ["wallets", tenantId, currency ?? "all", walletType ?? "all"] as const,
  },
  fees: { tenant: (tenantId: string) => ["fees", tenantId] as const },
  approvals: {
    all: ["approvals"] as const,
    list: (scope: string, status?: string) => ["approvals", scope, status ?? "all"] as const,
    detail: (scope: string, id: string) => ["approvals", scope, "detail", id] as const,
  },
  tenantAdmin: {
    all: ["tenant-admin"] as const,
    tenant: ["tenant-admin", "tenant"] as const,
    users: ["tenant-admin", "users"] as const,
  },
  policies: {
    all: ["policies"] as const,
    list: (tenantId?: string) => ["policies", tenantId ?? "global"] as const,
  },
  reports: {
    all: ["reports"] as const,
    list: (kind: "collections" | "disbursements", filter: ReportFilter) => ["reports", kind, filter] as const,
  },
  transactions: {
    all: ["transactions"] as const,
    list: (page: number, size: number) => ["transactions", "list", page, size] as const,
    detail: (id: string) => ["transactions", "detail", id] as const,
  },
  payments: {
    all: ["payments"] as const,
    telcos: ["payments", "telcos"] as const,
    banks: ["payments", "banks"] as const,
    balances: ["payments", "balances"] as const,
    balance: (kind: "collection" | "disbursement") => ["payments", "balances", kind] as const,
    bulk: ["payments", "bulk"] as const,
    bulkDetail: (id: string) => ["payments", "bulk", id] as const,
  },
};
