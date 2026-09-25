"use client";

import { ArrowDownLeft, ArrowUpRight, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { VolumeChart } from "@/components/charts/volume-chart";
import { BalanceStrip } from "@/components/domain/balance-strip";
import { ErrorState } from "@/components/domain/feedback";
import { PageHeader } from "@/components/domain/page-header";
import { CollectionSheet } from "@/components/payments/collection-dialog";
import { DisbursementSheet } from "@/components/payments/disbursement-dialog";
import { countByTone, directionOf } from "@/components/transactions/filters";
import { Button, buttonVariants } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader, Skeleton } from "@/components/ui/panel";
import { DirectionRail, State } from "@/components/ui/state";
import { useBalance, useTransactions } from "@/lib/api/hooks";
import { useCanMake } from "@/lib/api/session";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";

const SAMPLE_SIZE = 100;
const RECENT_COUNT = 7;

export default function OverviewPage() {
  const tx = useTransactions(1, SAMPLE_SIZE);
  const disbursements = useBalance("disbursement");
  const collections = useBalance("collection");
  const [collectOpen, setCollectOpen] = useState(false);
  const [disbursementOpen, setDisbursementOpen] = useState(false);
  const canMake = useCanMake();
  const items = useMemo(() => tx.data ?? [], [tx.data]);
  const counts = useMemo(() => countByTone(items), [items]);

  return (
    <>
      <PageHeader
        title="Overview"
        description="What moved, what is still moving, and what you can spend"
        actions={
          canMake && (
            <>
              <Button variant="outline" onClick={() => setCollectOpen(true)}>
                <ArrowDownLeft /> Collect
              </Button>
              <Button onClick={() => setDisbursementOpen(true)}>
                <ArrowUpRight /> Send money
              </Button>
            </>
          )
        }
      />

      <BalanceStrip
        heroLabel="Available to disburse"
        heroAmount={disbursements.data?.availableBalance ?? disbursements.data?.totalBalance ?? null}
        heroCurrency={disbursements.data?.currency}
        heroNote={
          disbursements.data?.reservedBalance
            ? `${formatMoney(disbursements.data.reservedBalance, disbursements.data.currency)} reserved for disbursements in flight`
            : undefined
        }
        loading={disbursements.isLoading}
        figures={[
          {
            label: "Collections balance",
            value: formatMoney(collections.data?.availableBalance ?? collections.data?.totalBalance, collections.data?.currency),
            tone: "in",
          },
          { label: "Settled", value: formatNumber(counts.success), tone: "settled" },
          { label: "In flight", value: formatNumber(counts.pending), tone: "pending" },
          { label: "Failed", value: formatNumber(counts.failed), tone: counts.failed > 0 ? "failed" : "default" },
        ]}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader title="Daily volume" description={`Across the last ${SAMPLE_SIZE} records`} />
          <PanelBody>
            {tx.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : tx.isError ? (
              <ErrorState error={tx.error} onRetry={() => tx.refetch()} />
            ) : (
              <VolumeChart items={items.map((t) => ({ date: t.createdAt, amount: t.amount }))} />
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Latest records"
            actions={
              <Link href="/collections" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                See all
              </Link>
            }
          />
          <ul className="divide-y divide-line">
            {tx.isLoading
              ? Array.from({ length: 4 }, (_, i) => (
                  <li key={i} className="p-4">
                    <Skeleton className="h-10 w-full" />
                  </li>
                ))
              : items.slice(0, RECENT_COUNT).map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <DirectionRail direction={directionOf(t)} className="h-8" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{t.accountName ?? t.reference ?? t.clientTransactionId ?? "Record"}</p>
                      <p className="text-xs text-ink-soft">{formatDate(t.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="figure text-sm">{formatMoney(t.amount, t.currency)}</p>
                      <State status={t.status} className="text-xs" />
                    </div>
                  </li>
                ))}
            {!tx.isLoading && items.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-ink-soft">Nothing has moved yet.</li>
            )}
          </ul>
        </Panel>
      </div>

      <Panel>
        <PanelBody className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="size-5 text-ink-soft" aria-hidden />
            <div>
              <p className="font-medium">Paying many people at once?</p>
              <p className="text-sm text-ink-soft">Upload a CSV, check every name, then send the batch.</p>
            </div>
          </div>
          <Link href="/disbursements/bulk" className={buttonVariants({ variant: "quiet" })}>
            Start a batch
          </Link>
        </PanelBody>
      </Panel>

      <CollectionSheet open={collectOpen} onOpenChange={setCollectOpen} />
      <DisbursementSheet open={disbursementOpen} onOpenChange={setDisbursementOpen} />
    </>
  );
}
