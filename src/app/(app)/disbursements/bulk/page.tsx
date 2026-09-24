"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Download, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { BulkUploader } from "./uploader";
import { PageHeader } from "@/components/domain/page-header";
import { Ref } from "@/components/domain/feedback";
import { Ledger } from "@/components/ledger/ledger";
import { Button } from "@/components/ui/button";
import { State } from "@/components/ui/state";
import { useBulkBatches } from "@/lib/api/hooks";
import type { Batch } from "@/lib/api/schemas/models";
import { BULK_TEMPLATE_HEADERS, BULK_TEMPLATE_SAMPLE } from "@/lib/csv/bulk";
import { downloadCsv, toCsv } from "@/lib/csv";
import { display, formatDate, formatMoney, formatNumber } from "@/lib/format";

export default function BulkPayoutsPage() {
  const batches = useBulkBatches();
  const columns = useMemo<ColumnDef<Batch, unknown>[]>(
    () => [
      { id: "createdAt", header: "Submitted", accessorFn: (b) => b.createdAt ?? "", cell: ({ row }) => formatDate(row.original.createdAt) },
      {
        id: "id",
        header: "Batch",
        accessorFn: (b) => b.id,
        cell: ({ row }) => (
          <Link href={`/disbursements/bulk/${encodeURIComponent(row.original.id)}`} className="text-accent hover:underline">
            <Ref className="text-accent">{row.original.id}</Ref>
          </Link>
        ),
      },
      { id: "clientBatchId", header: "Your reference", accessorFn: (b) => b.clientBatchId ?? "", cell: ({ getValue }) => <Ref>{display(getValue())}</Ref> },
      { id: "status", header: "State", accessorFn: (b) => b.status ?? "", cell: ({ row }) => <State status={row.original.status} /> },
      { id: "itemCount", header: "Payouts", accessorFn: (b) => b.itemCount ?? 0, cell: ({ row }) => formatNumber(row.original.itemCount) },
      {
        id: "totalAmount",
        header: "Total",
        accessorFn: (b) => b.totalAmount ?? 0,
        cell: ({ row }) => <span className="figure">{formatMoney(row.original.totalAmount, row.original.currency)}</span>,
      },
      { id: "errorMessage", header: "Problem", accessorFn: (b) => b.errorMessage ?? "", cell: ({ getValue }) => display(getValue()) },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Bulk payouts"
        description="Upload a CSV, check every name, then pay everyone at once"
        actions={
          <>
            <Button variant="outline" onClick={() => downloadCsv("bulk-payout-template", toCsv(BULK_TEMPLATE_HEADERS, [BULK_TEMPLATE_SAMPLE]))}>
              <Download /> Template
            </Button>
            <Button variant="outline" onClick={() => batches.refetch()} loading={batches.isRefetching}>
              {!batches.isRefetching && <RefreshCw />} Refresh
            </Button>
          </>
        }
      />
      <BulkUploader />
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Batches</h2>
        <Ledger
          tableId="bulk-batches"
          columns={columns}
          data={batches.data ?? []}
          loading={batches.isLoading}
          error={batches.error}
          onRetry={() => batches.refetch()}
          getRowId={(b, i) => b.id || String(i)}
          emptyTitle="No batches yet"
          emptyDescription="Batches you submit will be listed here."
        />
      </div>
    </>
  );
}
