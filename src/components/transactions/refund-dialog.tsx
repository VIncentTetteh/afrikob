"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { useCreateRefund } from "@/lib/api/hooks";
import type { Transaction } from "@/lib/api/schemas/models";
import { createRefundSchema, type CreateRefund, type CreateRefundInput } from "@/lib/api/schemas/requests";
import { formatMoney } from "@/lib/format";

interface Props {
  transaction: Transaction | null;
  onOpenChange: (open: boolean) => void;
}

/** Requests a (partial or full) refund. Idempotency key is fixed per dialog instance. */
export function RefundRequestDialog({ transaction, onOpenChange }: Props) {
  const create = useCreateRefund();
  // Fixed per opened record, so a double submit cannot create two refunds.
  const idempotencyKey = useMemo(() => (transaction ? crypto.randomUUID() : ""), [transaction]);
  const form = useForm<CreateRefundInput, unknown, CreateRefund>({
    resolver: zodResolver(createRefundSchema),
    values: { amount: transaction?.amount ?? undefined, reason: "" },
  });
  const txId = transaction?.id ?? "";
  const errors = form.formState.errors;

  const submit = form.handleSubmit((body) => {
    // What is left to refund: the original less anything already refunded.
    const refundable = transaction?.amount != null ? transaction.amount - (transaction.refundedAmount ?? 0) : null;
    if (refundable !== null && refundable <= 0) {
      form.setError("amount", { message: "This payment has already been refunded in full" });
      return;
    }
    if (refundable !== null && body.amount != null && body.amount > refundable) {
      form.setError("amount", { message: `Cannot exceed ${formatMoney(refundable, transaction?.currency)} still refundable` });
      return;
    }
    create.mutate(
      { transactionId: txId, body, idempotencyKey },
      { onSuccess: () => onOpenChange(false) },
    );
  });

  return (
    <Dialog
      open={transaction !== null}
      onOpenChange={onOpenChange}
      title="Request refund"
      description={transaction ? `Original amount ${formatMoney(transaction.amount, transaction.currency)}` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} loading={create.isPending}>Submit request</Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Amount (leave as-is for full refund)" htmlFor="refund-amount" error={errors.amount?.message}>
          <MoneyInput id="refund-amount" aria-invalid={Boolean(errors.amount) || undefined} {...form.register("amount")} />
        </Field>
        <Field label="Reason" htmlFor="refund-reason" error={errors.reason?.message}>
          <Textarea id="refund-reason" maxLength={500} {...form.register("reason")} />
        </Field>
      </form>
    </Dialog>
  );
}
