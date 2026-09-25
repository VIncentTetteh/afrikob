"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { InstitutionSelect } from "./institution-select";
import { toast } from "sonner";
import { ResultPanel, toastFor } from "./result-panel";
import { ConfirmDialog } from "@/components/domain/feedback";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { useCollect } from "@/lib/api/hooks";
import { collectionSchema, newClientTransactionId, type Collection, type CollectionInput } from "@/lib/api/schemas/requests";
import { formatMoney } from "@/lib/format";

/** Mobile money wallets here are Ghanaian. */
const GHANA_ONLY = ["GH"] as const;

const blank = (): CollectionInput => ({
  clientTransactionId: newClientTransactionId("COL"),
  walletNumber: "",
  institutionCode: "",
  amount: "",
  currency: "GHS",
  reference: "",
  walletName: "",
});

/** Charges a mobile money wallet; the customer approves the prompt on their phone. */
export function CollectionSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const collect = useCollect();
  const [pending, setPending] = useState<Collection | null>(null);
  const form = useForm<CollectionInput, unknown, Collection>({ resolver: zodResolver(collectionSchema), defaultValues: blank() });
  const e = form.formState.errors;

  const close = (o: boolean) => {
    if (!o) {
      form.reset(blank());
      collect.reset();
    }
    onOpenChange(o);
  };

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={close}
        title="Collect payment"
        description="Charge a customer's mobile money wallet."
        footer={
          collect.isSuccess ? (
            <Button onClick={() => close(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button onClick={form.handleSubmit(setPending)}>Review</Button>
            </>
          )
        }
      >
        {collect.isSuccess ? (
          <ResultPanel outcome={collect.data} />
        ) : (
          <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(setPending)} noValidate>
            <Field label="Network" htmlFor="c-inst" error={e.institutionCode?.message}>
              <InstitutionSelect id="c-inst" include="telcos" {...form.register("institutionCode")} />
            </Field>
            <Field label="Wallet number" htmlFor="c-wallet" error={e.walletNumber?.message}>
              <Controller
                control={form.control}
                name="walletNumber"
                render={({ field, fieldState }) => (
                  <PhoneInput id="c-wallet" countries={GHANA_ONLY} value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={Boolean(fieldState.error)} />
                )}
              />
            </Field>
            <Field label="Wallet name" htmlFor="c-name" error={e.walletName?.message} hint="Optional">
              <Input id="c-name" autoComplete="off" maxLength={150} {...form.register("walletName")} />
            </Field>
            <Field label="Amount (GHS)" htmlFor="c-amount" error={e.amount?.message}>
              <MoneyInput id="c-amount" aria-invalid={Boolean(e.amount) || undefined} {...form.register("amount")} />
            </Field>
            <Field label="Reference" htmlFor="c-ref" error={e.reference?.message} className="sm:col-span-2" hint="What the customer is paying for.">
              <Input id="c-ref" placeholder="Invoice 1042" autoComplete="off" maxLength={100} {...form.register("reference")} />
            </Field>
            <Field label="Your reference" htmlFor="c-ctid" error={e.clientTransactionId?.message} className="sm:col-span-2" hint="Generated for you; must be unique.">
              <Input id="c-ctid" autoComplete="off" spellCheck={false} maxLength={64} className="font-mono" {...form.register("clientTransactionId")} />
            </Field>
          </form>
        )}
      </Sheet>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title="Send this charge?"
        description={
          pending && (
            <>
              Charge <b>{formatMoney(pending.amount, pending.currency)}</b> to wallet <b>{pending.walletNumber}</b>.
            </>
          )
        }
        confirmLabel="Send charge"
        loading={collect.isPending}
        onConfirm={() =>
          pending &&
          collect.mutate(pending, {
            onSuccess: (outcome) => {
              const [kind, message] = toastFor(outcome);
              toast[kind](message);
            },
            onSettled: () => setPending(null),
          })
        }
      />
    </>
  );
}
