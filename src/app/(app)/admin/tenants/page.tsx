"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Plus, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CreateTenantSheet } from "@/components/admin/create-tenant-dialog";
import { PageHeader } from "@/components/domain/page-header";
import { Ref } from "@/components/domain/feedback";
import { Ledger } from "@/components/ledger/ledger";
import { Button } from "@/components/ui/button";
import { State } from "@/components/ui/state";
import { useTenants } from "@/lib/api/hooks";
import type { Tenant } from "@/lib/api/schemas/models";
import { display, formatDate } from "@/lib/format";

export default function TenantsPage() {
  const tenants = useTenants();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const columns = useMemo<ColumnDef<Tenant, unknown>[]>(
    () => [
      {
        id: "displayName",
        header: "Tenant",
        accessorFn: (t) => `${t.displayName ?? ""} ${t.code ?? ""}`,
        cell: ({ row }) => (
          <span className="block max-w-64 truncate font-medium">
            {row.original.displayName ?? "Unnamed"}
            <span className="block text-xs font-normal text-ink-soft">{row.original.code}</span>
          </span>
        ),
      },
      { id: "status", header: "State", accessorFn: (t) => t.status ?? "", cell: ({ row }) => <State status={row.original.status ?? "Active"} /> },
      { id: "createdAt", header: "Onboarded", accessorFn: (t) => t.createdAt ?? "", cell: ({ row }) => formatDate(row.original.createdAt) },
      { id: "id", header: "Tenant ID", accessorFn: (t) => t.id, cell: ({ getValue }) => <Ref>{display(getValue())}</Ref> },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Tenants"
        description="Merchants on the gateway"
        actions={
          <>
            <Button variant="outline" onClick={() => tenants.refetch()} loading={tenants.isRefetching}>
              {!tenants.isRefetching && <RefreshCw />} Refresh
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus /> Add tenant
            </Button>
          </>
        }
      />
      <Ledger
        tableId="tenants"
        columns={columns}
        data={tenants.data ?? []}
        loading={tenants.isLoading}
        error={tenants.error}
        onRetry={() => tenants.refetch()}
        getRowId={(t, i) => t.id || String(i)}
        onRowClick={(t) => t.id && router.push(`/admin/tenants/${encodeURIComponent(t.id)}`)}
        emptyTitle="No tenants yet"
        emptyDescription="Add your first merchant to start processing payments."
        emptyAction={
          <Button onClick={() => setOpen(true)}>
            <Plus /> Add tenant
          </Button>
        }
        searchPlaceholder="Search by name, code or ID"
      />
      <CreateTenantSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
