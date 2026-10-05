"use client";

import { useQueries } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { RefreshCw } from "lucide-react";
import { useMemo } from "react";
import { BalanceStrip } from "@/components/domain/balance-strip";
import { PageHeader } from "@/components/domain/page-header";
import { Ledger } from "@/components/ledger/ledger";
import { Button } from "@/components/ui/button";
import { State } from "@/components/ui/state";
import { adminApi } from "@/lib/api/endpoints";
import { useTenants } from "@/lib/api/hooks";
import { qk } from "@/lib/api/keys";
import type { Tenant, WalletBalance } from "@/lib/api/schemas/models";
import { formatMoney } from "@/lib/format";

type WalletKind = "COLLECTION" | "DISBURSEMENT";

interface WalletRow {
  tenant: Tenant;
  collection?: WalletBalance;
  disbursement?: WalletBalance;
}

const kinds: WalletKind[] = ["COLLECTION", "DISBURSEMENT"];

function amount(wallet?: WalletBalance): number {
  return wallet?.totalBalance ?? 0;
}

/** Platform-wide wallet balances, kept separate because each wallet can settle independently. */
export default function AdminWalletsPage() {
  const tenants = useTenants();
  const tenantList = useMemo(() => tenants.data ?? [], [tenants.data]);
  const wallets = useQueries({
    queries: tenantList.flatMap((tenant) =>
      kinds.map((walletType) => ({
        queryKey: qk.wallets.tenant(tenant.id, "GHS", walletType),
        queryFn: ({ signal }: { signal: AbortSignal }) => adminApi.getWallet(tenant.id, { currency: "GHS", walletType }, signal),
        enabled: Boolean(tenant.id),
      })),
    ),
  });

  const rows = useMemo<WalletRow[]>(
    () =>
      tenantList.map((tenant, index) => ({
        tenant,
        collection: wallets[index * 2]?.data,
        disbursement: wallets[index * 2 + 1]?.data,
      })),
    [tenantList, wallets],
  );
  const loading = tenants.isLoading || wallets.some((wallet) => wallet.isLoading);
  const error = tenants.error ?? wallets.find((wallet) => wallet.error)?.error;
  const collectionTotal = rows.reduce((sum, row) => sum + amount(row.collection), 0);
  const disbursementTotal = rows.reduce((sum, row) => sum + amount(row.disbursement), 0);

  const columns = useMemo<ColumnDef<WalletRow, unknown>[]>(
    () => [
      {
        id: "tenant",
        header: "Tenant",
        accessorFn: (row) => `${row.tenant.displayName ?? ""} ${row.tenant.code ?? ""}`,
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.tenant.displayName ?? "Unnamed tenant"}
            <span className="block text-xs font-normal text-ink-soft">{row.original.tenant.code}</span>
          </span>
        ),
      },
      {
        id: "collections",
        header: "Collection funds",
        accessorFn: (row) => amount(row.collection),
        cell: ({ row }) => <span className="figure text-in">{formatMoney(amount(row.original.collection), row.original.collection?.currency ?? "GHS")}</span>,
      },
      {
        id: "disbursements",
        header: "Disbursement funds",
        accessorFn: (row) => amount(row.disbursement),
        cell: ({ row }) => <span className="figure text-out">{formatMoney(amount(row.original.disbursement), row.original.disbursement?.currency ?? "GHS")}</span>,
      },
      {
        id: "total",
        header: "Combined total",
        accessorFn: (row) => amount(row.collection) + amount(row.disbursement),
        cell: ({ row }) => <span className="figure font-medium">{formatMoney(amount(row.original.collection) + amount(row.original.disbursement), "GHS")}</span>,
      },
      {
        id: "status",
        header: "Tenant state",
        accessorFn: (row) => row.tenant.status ?? "",
        cell: ({ row }) => <State status={row.original.tenant.status ?? "Active"} />,
      },
    ],
    [],
  );

  const refresh = () => {
    void tenants.refetch();
    wallets.forEach((wallet) => void wallet.refetch());
  };

  return (
    <>
      <PageHeader
        title="Wallets"
        description="Collection and disbursement funds held for each tenant"
        actions={
          <Button variant="outline" onClick={refresh} loading={tenants.isFetching || wallets.some((wallet) => wallet.isFetching)}>
            {!(tenants.isFetching || wallets.some((wallet) => wallet.isFetching)) && <RefreshCw />} Refresh
          </Button>
        }
      />
      <BalanceStrip
        heroLabel="Total tenant funds"
        heroAmount={collectionTotal + disbursementTotal}
        heroCurrency="GHS"
        heroNote="Combined collection and disbursement wallet totals"
        loading={loading}
        figures={[
          { label: "Collection funds", value: formatMoney(collectionTotal, "GHS"), tone: "in" },
          { label: "Disbursement funds", value: formatMoney(disbursementTotal, "GHS"), tone: "out" },
          { label: "Tenants", value: tenantList.length },
        ]}
      />
      <Ledger
        tableId="admin-wallets"
        columns={columns}
        data={rows}
        loading={loading}
        error={error}
        onRetry={refresh}
        getRowId={(row) => row.tenant.id}
        emptyTitle="No tenant wallets yet"
        emptyDescription="Wallet balances appear here after a tenant is onboarded."
        searchPlaceholder="Search tenants or wallet totals"
      />
    </>
  );
}
