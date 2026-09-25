"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, RefreshCw, Scale, SearchCheck } from "lucide-react";
import Link from "next/link";
import { use, useMemo, useState } from "react";
import { toast } from "sonner";
import { BalanceStrip } from "@/components/domain/balance-strip";
import { ErrorState, Ref } from "@/components/domain/feedback";
import { KeyValueList, recordToItems } from "@/components/domain/key-value-list";
import { PageHeader } from "@/components/domain/page-header";
import { Ledger } from "@/components/ledger/ledger";
import { Button, buttonVariants } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { Sheet } from "@/components/ui/sheet";
import { State } from "@/components/ui/state";
import { useBulkBatch, useBulkStatus, useReconcileBulk } from "@/lib/api/hooks";
import type { BatchItem } from "@/lib/api/schemas/models";
import { statusTone } from "@/lib/api/schemas/normalize";
import { display, formatDate, formatMoney, formatNumber } from "@/lib/format";

export default function BatchDetailPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId: raw } = use(params);
  const batchId = decodeURIComponent(raw);
  const detail = useBulkBatch(batchId);
  const reconcile = useReconcileBulk();
  const status = useBulkStatus();
  const [statusOpen, setStatusOpen] = useState(false);

  const batch = detail.data?.batch;
  const items = useMemo(() => detail.data?.items ?? [], [detail.data]);
  const tally = useMemo(() => {
    const counts = { success: 0, pending: 0, failed: 0, neutral: 0 };
    for (const item of items) counts[statusTone(item.status)] += 1;
    return counts;
  }, [items]);

  const columns = useMemo<ColumnDef<BatchItem, unknown>[]>(
    () => [
      {
        id: "accountName",
        header: "Beneficiary",
        accessorFn: (i) => `${i.accountName ?? ""} ${i.accountNumberMasked ?? ""}`,
        cell: ({ row }) => (
          <span className="block max-w-56 truncate">
            {row.original.accountName ?? "Not provided"}
            {row.original.accountNumberMasked && <span className="text-ink-soft"> · {row.original.accountNumberMasked}</span>}
          </span>
        ),
      },
      {
        id: "amount",
        header: "Amount",
        accessorFn: (i) => i.amount ?? 0,
        cell: ({ row }) => <span className="figure">{formatMoney(row.original.amount, row.original.currency)}</span>,
      },
      { id: "status", header: "State", accessorFn: (i) => i.status ?? "", cell: ({ row }) => <State status={row.original.status} /> },
      { id: "institutionCode", header: "Institution", accessorFn: (i) => i.institutionCode ?? "", cell: ({ getValue }) => display(getValue()) },
      { id: "reference", header: "Reference", accessorFn: (i) => i.reference ?? "", cell: ({ getValue }) => display(getValue()) },
      { id: "providerMessage", header: "Message", accessorFn: (i) => i.providerMessage ?? "", cell: ({ getValue }) => display(getValue()) },
      {
        id: "clientTransactionId",
        header: "Your reference",
        accessorFn: (i) => i.clientTransactionId ?? "",
        cell: ({ getValue }) => <Ref>{display(getValue())}</Ref>,
      },
    ],
    [],
  );

  return (
    <>
      <Link href="/disbursements/bulk" className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-2 w-fit" })}>
        <ArrowLeft /> All batches
      </Link>
      <PageHeader
        title="Batch"
        description={batch?.clientBatchId ?? batchId}
        actions={
          <>
            <Button variant="outline" onClick={() => detail.refetch()} loading={detail.isRefetching}>
              {!detail.isRefetching && <RefreshCw />} Refresh
            </Button>
            <Button
              variant="outline"
              loading={status.isPending}
              onClick={() => status.mutate({ bulk_transaction_id: batchId }, { onSuccess: () => setStatusOpen(true) })}
            >
              {!status.isPending && <SearchCheck />} Ask the provider
            </Button>
            <Button
              loading={reconcile.isPending}
              onClick={() => reconcile.mutate(batchId, { onSuccess: () => toast.success("Reconciliation started") })}
            >
              {!reconcile.isPending && <Scale />} Reconcile
            </Button>
          </>
        }
      />

      {detail.isError ? (
        <Panel>
          <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
        </Panel>
      ) : (
        <>
          <BalanceStrip
            heroLabel="Batch total"
            heroAmount={batch?.totalAmount ?? null}
            heroCurrency={batch?.currency}
            heroNote={batch ? `${batch.status ?? "Submitted"} · ${formatDate(batch.createdAt)}` : undefined}
            loading={detail.isLoading}
            figures={[
              { label: "Disbursements", value: formatNumber(batch?.itemCount ?? items.length) },
              { label: "Settled", value: formatNumber(tally.success), tone: "settled" },
              { label: "In flight", value: formatNumber(tally.pending), tone: "pending" },
              { label: "Failed", value: formatNumber(tally.failed), tone: tally.failed > 0 ? "failed" : "default" },
            ]}
          />
          {batch?.errorMessage && (
            <p role="alert" className="rounded-lg border border-failed/30 bg-failed-wash px-3 py-2.5 text-sm text-failed">
              {batch.errorMessage}
            </p>
          )}
          <Ledger
            tableId="batch-items"
            columns={columns}
            data={items}
            loading={detail.isLoading}
            getRowId={(i, index) => i.clientTransactionId ?? String(index)}
            getDirection={() => "out"}
            emptyTitle="No disbursements in this batch"
            emptyDescription="The gateway has not returned the individual disbursements yet."
          />
        </>
      )}

      <Sheet open={statusOpen} onOpenChange={setStatusOpen} title="Provider status" description={batchId}>
        {status.data && (
          <div className="space-y-5">
            <KeyValueList
              items={[
                { label: "State", value: <State status={status.data.status} /> },
                { label: "Provider batch", value: display(status.data.providerBulkTransactionId) },
                { label: "Your reference", value: display(status.data.clientBatchId) },
              ]}
            />
            {status.data.items.length > 0 && (
              <section>
                <h3 className="mb-1 text-sm font-medium">Per disbursement</h3>
                <ul className="divide-y divide-line">
                  {status.data.items.map((item, index) => (
                    <li key={item.clientTransactionId ?? index} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                      <Ref>{display(item.clientTransactionId)}</Ref>
                      <span className="flex items-center gap-2">
                        <span className="text-ink-soft">{item.message}</span>
                        <State status={item.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section>
              <h3 className="mb-1 text-sm font-medium">Raw response</h3>
              <KeyValueList items={recordToItems(status.data)} />
            </section>
          </div>
        )}
      </Sheet>
    </>
  );
}
