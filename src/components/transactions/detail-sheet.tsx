"use client";

import { RotateCcw } from "lucide-react";
import { KeyValueList, recordToItems, type KvItem } from "@/components/domain/key-value-list";
import { CopyButton } from "@/components/domain/feedback";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/panel";
import { Sheet } from "@/components/ui/sheet";
import { State } from "@/components/ui/state";
import { TENANT_REFUNDS_AVAILABLE } from "@/lib/api/features";
import { useTransaction, useTransactionRefunds } from "@/lib/api/hooks";
import type { Transaction } from "@/lib/api/schemas/models";
import { formatDate, formatMoney } from "@/lib/format";

interface Props {
  transaction: Transaction | null;
  onOpenChange: (open: boolean) => void;
  onRefund?: (tx: Transaction) => void;
}

function summary(t: Transaction): KvItem[] {
  return [
    { label: "State", value: <State status={t.status} /> },
    { label: "Fee", value: formatMoney(t.fee, t.currency) },
    { label: "Net", value: formatMoney(t.netAmount, t.currency) },
    { label: "Refunded", value: formatMoney(t.refundedAmount, t.currency) },
    { label: "Created", value: formatDate(t.createdAt) },
    { label: "Completed", value: t.completedAt ? formatDate(t.completedAt) : "Not yet" },
  ];
}

const SUMMARY_KEYS = new Set(["status", "fee", "netAmount", "refundedAmount", "createdAt", "completedAt", "amount", "currency"]);

/** Opens beside the ledger so the operator keeps their place. */
export function TransactionSheet({ transaction, onOpenChange, onRefund }: Props) {
  const id = transaction?.id ?? null;
  const detail = useTransaction(id);
  const refunds = useTransactionRefunds(id);
  const tx = detail.data ?? transaction;

  return (
    <Sheet
      open={transaction !== null}
      onOpenChange={onOpenChange}
      title={tx ? formatMoney(tx.amount, tx.currency) : "Record"}
      description={tx?.type ?? undefined}
      footer={
        tx && (
          <>
            <CopyButton value={tx.id} label="Copy ID" />
            {onRefund && (
              <Button variant="quiet" onClick={() => onRefund(tx)}>
                <RotateCcw /> Request refund
              </Button>
            )}
          </>
        )
      }
    >
      {tx && (
        <div className="space-y-6">
          <KeyValueList items={summary(tx)} />
          <section>
            <h3 className="mb-1 text-sm font-medium">Everything on this record</h3>
            {detail.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <KeyValueList items={recordToItems(tx).filter((i) => !SUMMARY_KEYS.has(i.label.replaceAll(" ", "")))} />
            )}
          </section>
          {TENANT_REFUNDS_AVAILABLE && (
            <section>
              <h3 className="mb-1 text-sm font-medium">Refunds</h3>
              {refunds.isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : refunds.data && refunds.data.length > 0 ? (
                <ul className="divide-y divide-line">
                  {refunds.data.map((r) => (
                    <li key={r.id} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                      <span>
                        <span className="figure">{formatMoney(r.amount, r.currency)}</span>
                        <span className="text-ink-soft"> · {r.reason ?? "No reason given"}</span>
                      </span>
                      <State status={r.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-soft">None yet.</p>
              )}
            </section>
          )}
        </div>
      )}
    </Sheet>
  );
}
