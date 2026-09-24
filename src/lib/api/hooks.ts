"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Result } from "./client";
import { adminApi, approvalsApi, paymentsApi, refundsApi, tenantAdminApi, type ApprovalScope } from "./endpoints";
import { transactionsApi } from "./endpoints";
import { qk } from "./keys";
import type * as Req from "./schemas/requests";
import { useSession } from "./session";
import { approvalsHrefFor } from "@/lib/session/types";

const REFERENCE_DATA_STALE_MS = 60 * 60 * 1000;
const BALANCE_REFRESH_MS = 60 * 1000;

/* ---------- Queries ---------- */

export const useTenants = (enabled = true) =>
  useQuery({ queryKey: qk.tenants.all, queryFn: ({ signal }) => adminApi.listTenants(signal), enabled });

export const useAdminRefunds = (status?: string) =>
  useQuery({ queryKey: qk.refunds.admin(status), queryFn: ({ signal }) => adminApi.listRefunds(status, signal) });

export const useTenantWallet = (tenantId: string, currency?: string, walletType?: string) =>
  useQuery({
    queryKey: qk.wallets.tenant(tenantId, currency, walletType),
    queryFn: ({ signal }) => adminApi.getWallet(tenantId, { currency, walletType }, signal),
    enabled: Boolean(tenantId),
  });

export const useTenantFees = (tenantId: string) =>
  useQuery({
    queryKey: qk.fees.tenant(tenantId),
    queryFn: ({ signal }) => adminApi.listFees(tenantId, signal),
    enabled: Boolean(tenantId),
  });

export const usePortalUsers = (tenantId?: string, userType?: string, enabled = true) =>
  useQuery({
    queryKey: qk.users.list(tenantId, userType),
    queryFn: ({ signal }) => adminApi.listUsers({ tenantId, userType }, signal),
    enabled,
  });

export const useApprovalPolicies = (tenantId?: string) =>
  useQuery({
    queryKey: qk.policies.list(tenantId),
    queryFn: ({ signal }) => adminApi.listApprovalPolicies(tenantId, signal),
  });

export const useReport = (kind: "collections" | "disbursements", filter: Req.ReportFilter, enabled = true) =>
  useQuery({
    queryKey: qk.reports.list(kind, filter),
    queryFn: ({ signal }) =>
      kind === "collections" ? adminApi.collectionReport(filter, signal) : adminApi.disbursementReport(filter, signal),
    enabled,
    placeholderData: keepPreviousData,
  });

export const useTransactions = (page: number, size: number) =>
  useQuery({
    queryKey: qk.transactions.list(page, size),
    queryFn: ({ signal }) => transactionsApi.list(page, size, signal),
    placeholderData: keepPreviousData,
  });

export const useTransaction = (id: string | null) =>
  useQuery({
    queryKey: qk.transactions.detail(id ?? ""),
    queryFn: ({ signal }) => transactionsApi.get(id ?? "", signal),
    enabled: Boolean(id),
  });

export const useTransactionRefunds = (txId: string | null) =>
  useQuery({
    queryKey: qk.refunds.forTransaction(txId ?? ""),
    queryFn: ({ signal }) => refundsApi.listForTransaction(txId ?? "", signal),
    enabled: Boolean(txId),
  });

export const useRefund = (id: string | null) =>
  useQuery({
    queryKey: qk.refunds.detail(id ?? ""),
    queryFn: ({ signal }) => refundsApi.get(id ?? "", signal),
    enabled: Boolean(id),
  });

export const useTelcos = () =>
  useQuery({ queryKey: qk.payments.telcos, queryFn: ({ signal }) => paymentsApi.telcos(signal), staleTime: REFERENCE_DATA_STALE_MS });

export const useBanks = () =>
  useQuery({ queryKey: qk.payments.banks, queryFn: ({ signal }) => paymentsApi.banks(signal), staleTime: REFERENCE_DATA_STALE_MS });

export const useBalance = (kind: "collection" | "disbursement", enabled = true) =>
  useQuery({
    queryKey: qk.payments.balance(kind),
    queryFn: ({ signal }) =>
      kind === "collection" ? paymentsApi.collectionBalance(undefined, signal) : paymentsApi.disbursementBalance(undefined, signal),
    refetchInterval: BALANCE_REFRESH_MS,
    enabled,
  });

export const useBulkBatches = () =>
  useQuery({ queryKey: qk.payments.bulk, queryFn: ({ signal }) => paymentsApi.listBulk(signal) });

export const useBulkBatch = (batchId: string) =>
  useQuery({
    queryKey: qk.payments.bulkDetail(batchId),
    queryFn: ({ signal }) => paymentsApi.getBulk(batchId, signal),
    enabled: Boolean(batchId),
  });

export const useApprovals = (scope: ApprovalScope, status?: string) =>
  useQuery({
    queryKey: qk.approvals.list(scope, status),
    queryFn: ({ signal }) => approvalsApi.list(scope, status, signal),
  });

export const useTenantDetail = (enabled = true) =>
  useQuery({ queryKey: qk.tenantAdmin.tenant, queryFn: ({ signal }) => tenantAdminApi.tenant(signal), enabled });

export const useTenantAdminUsers = (enabled = true) =>
  useQuery({ queryKey: qk.tenantAdmin.users, queryFn: ({ signal }) => tenantAdminApi.listUsers(signal), enabled });

/* ---------- Mutations ---------- */

const invalidate = (qc: QueryClient, keys: readonly (readonly unknown[])[]) => {
  for (const queryKey of keys) void qc.invalidateQueries({ queryKey });
};

/**
 * Reports a maker-checker outcome: actions that need a second pair of eyes come
 * back as 202 with an approval request instead of the finished resource, so the
 * person is pointed at the inbox where it now waits.
 */
export function announce<T>(result: Result<T>, doneMessage: string, inboxHref: string): Result<T> {
  if (result.pending) {
    toast.info(result.pending.message || "Sent for approval.", {
      description: "It is waiting in Approvals.",
      action: { label: "Open approvals", onClick: () => window.location.assign(inboxHref) },
    });
  } else {
    toast.success(doneMessage);
  }
  return result;
}

/** Where to send someone whose action is now waiting for approval. */
function useApprovalsHref(): string {
  const { data: session } = useSession();
  return approvalsHrefFor(session?.role ?? "tenant");
}

/** Approve or reject a pending action. */
export function useDecideApproval(scope: ApprovalScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Req.DecideApproval }) => approvalsApi.decide(scope, id, body),
    onSuccess: (_result, variables) => {
      toast.success(variables.body.approve ? "Approved" : "Rejected");
      // The decided action may have changed the thing it was waiting on.
      invalidate(qc, [qk.approvals.all, qk.wallets.all, qk.refunds.all, qk.tenants.all, qk.tenantAdmin.all]);
    },
  });
}

/** A tenant admin asking the platform to fund their wallet. */
export function useRequestTopUp() {
  const qc = useQueryClient();
  const inbox = useApprovalsHref();
  return useMutation({
    mutationFn: (body: Req.TopUp) => tenantAdminApi.requestTopUp(body),
    onSuccess: (result) => {
      announce(result, "Funds credited", inbox);
      invalidate(qc, [qk.tenantAdmin.all, qk.approvals.all]);
    },
  });
}

export function useTenantAdminUserMutations() {
  const qc = useQueryClient();
  const onSuccess = () => invalidate(qc, [qk.tenantAdmin.users]);
  return {
    create: useMutation({ mutationFn: (body: Req.CreateTenantScopedUser) => tenantAdminApi.createUser(body), onSuccess }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: Req.UpdateTenantScopedUser }) => tenantAdminApi.updateUser(id, body),
      onSuccess,
    }),
    activate: useMutation({ mutationFn: (id: string) => tenantAdminApi.activateUser(id), onSuccess }),
    deactivate: useMutation({ mutationFn: (id: string) => tenantAdminApi.deactivateUser(id), onSuccess }),
    setPassword: useMutation({
      mutationFn: ({ id, body }: { id: string; body: Req.AdminSetPassword }) => tenantAdminApi.setUserPassword(id, body),
    }),
  };
}

export function useCreateTenant() {
  const qc = useQueryClient();
  const inbox = useApprovalsHref();
  return useMutation({
    mutationFn: (body: Req.CreateTenant) => adminApi.createTenant(body),
    onSuccess: (result) => {
      announce(result, "Tenant created", inbox);
      invalidate(qc, [qk.tenants.all]);
    },
  });
}

/** Issued keys are returned once; the result is never written to the query cache. */
export const useIssueCredential = () =>
  useMutation({
    mutationFn: ({ tenantId, body }: { tenantId: string; body: Req.IssueCredential }) =>
      adminApi.issueCredential(tenantId, body),
    gcTime: 0,
  });

export function useRefundDecision() {
  const qc = useQueryClient();
  const inbox = useApprovalsHref();
  const refresh = () => invalidate(qc, [qk.refunds.all, qk.transactions.all]);
  return {
    approve: useMutation({
      mutationFn: (id: string) => adminApi.approveRefund(id),
      onSuccess: (result) => {
        announce(result, "Refund approved", inbox);
        refresh();
      },
    }),
    reject: useMutation({
      mutationFn: ({ id, body }: { id: string; body: Req.RejectRefund }) => adminApi.rejectRefund(id, body),
      onSuccess: () => {
        toast.success("Refund rejected");
        refresh();
      },
    }),
    complete: useMutation({
      mutationFn: ({ id, body }: { id: string; body: Req.CompleteRefund }) => adminApi.completeRefund(id, body),
      onSuccess: () => {
        toast.success("Refund outcome recorded");
        refresh();
      },
    }),
  };
}

export function useTopUp(tenantId: string) {
  const qc = useQueryClient();
  const inbox = useApprovalsHref();
  return useMutation({
    mutationFn: (body: Req.TopUp) => adminApi.topUpWallet(tenantId, body),
    onSuccess: (result) => {
      announce(result, "Wallet topped up", inbox);
      invalidate(qc, [qk.wallets.all]);
    },
  });
}

export function useFeeMutations(tenantId: string) {
  const qc = useQueryClient();
  const onSuccess = () => invalidate(qc, [qk.fees.tenant(tenantId)]);
  return {
    upsert: useMutation({ mutationFn: (body: Req.UpsertFee) => adminApi.upsertFee(tenantId, body), onSuccess }),
    remove: useMutation({ mutationFn: (type: string) => adminApi.deleteFee(tenantId, type), onSuccess }),
  };
}

export function useUserMutations() {
  const qc = useQueryClient();
  const onSuccess = () => invalidate(qc, [qk.users.all]);
  return {
    create: useMutation({ mutationFn: (body: Req.CreatePortalUser) => adminApi.createUser(body), onSuccess }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: Req.UpdatePortalUser }) => adminApi.updateUser(id, body),
      onSuccess,
    }),
    activate: useMutation({ mutationFn: (id: string) => adminApi.activateUser(id), onSuccess }),
    deactivate: useMutation({ mutationFn: (id: string) => adminApi.deactivateUser(id), onSuccess }),
    setPassword: useMutation({
      mutationFn: ({ id, body }: { id: string; body: Req.AdminSetPassword }) => adminApi.setUserPassword(id, body),
    }),
  };
}

export function usePolicyMutations() {
  const qc = useQueryClient();
  const onSuccess = () => invalidate(qc, [qk.policies.all]);
  return {
    upsert: useMutation({ mutationFn: (body: Req.UpsertApprovalPolicy) => adminApi.upsertApprovalPolicy(body), onSuccess }),
    remove: useMutation({ mutationFn: (id: string) => adminApi.deleteApprovalPolicy(id), onSuccess }),
  };
}

export function useCreateRefund() {
  const qc = useQueryClient();
  const inbox = useApprovalsHref();
  return useMutation({
    mutationFn: (v: { transactionId: string; body: Req.CreateRefund; idempotencyKey: string }) =>
      refundsApi.create(v.transactionId, v.body, v.idempotencyKey),
    onSuccess: (result, v) => {
      announce(result, "Refund requested", inbox);
      invalidate(qc, [qk.refunds.forTransaction(v.transactionId), qk.refunds.all]);
    },
  });
}

function usePaymentMutation<T, R>(fn: (body: T) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => invalidate(qc, [qk.transactions.all, qk.payments.balances]),
  });
}

export const useDisburse = () => usePaymentMutation((b: Req.Disbursement) => paymentsApi.disburse(b));
export const useCollect = () => usePaymentMutation((b: Req.Collection) => paymentsApi.collect(b));
export const useVerifyName = () => useMutation({ mutationFn: (b: Req.NameVerify) => paymentsApi.verifyName(b) });
export const useStatusCheck = () => useMutation({ mutationFn: (b: Req.StatusCheck) => paymentsApi.statusCheck(b) });
export const useBulkNameVerify = () =>
  useMutation({ mutationFn: (b: Req.BulkNameVerify) => paymentsApi.bulkNameVerify(b) });
export const useBulkStatus = () => useMutation({ mutationFn: (b: Req.BulkStatus) => paymentsApi.bulkStatus(b) });

export function useCreateBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { body: Req.BulkDisbursement; clientBatchId: string }) =>
      paymentsApi.createBulk(v.body, v.clientBatchId),
    onSuccess: () => invalidate(qc, [qk.payments.bulk, qk.payments.balances]),
  });
}

export function useReconcileBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string) => paymentsApi.reconcileBulk(batchId),
    onSuccess: (_d, batchId) => invalidate(qc, [qk.payments.bulkDetail(batchId), qk.payments.bulk]),
  });
}
