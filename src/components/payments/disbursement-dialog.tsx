"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BadgeCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { InstitutionSelect } from "./institution-select";
import { ResultPanel } from "./result-panel";
import { ConfirmDialog } from "@/components/domain/feedback";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { useDisburse, useVerifyName } from "@/lib/api/hooks";
import { disbursementSchema, newClientTransactionId, type Disbursement, type DisbursementInput } from "@/lib/api/schemas/requests";
import { formatMoney } from "@/lib/format";

const blank = (): DisbursementInput => ({
  clientTransactionId: newClientTransactionId("PAY"),
  accountNumber: "",
  institutionCode: "",
  amount: "",
  currency: "GHS",
  reference: "",
  accountName: "",
});

/** Single payout: verify the beneficiary, then confirm and send. */
export function PayoutSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const disburse = useDisburse();
  const verify = useVerifyName();
  const [pending, setPending] = useState<Disbursement | null>(null);
  const form = useForm<DisbursementInput, unknown, Disbursement>({ resolver: zodResolver(disbursementSchema), defaultValues: blank() });
  const e = form.formState.errors;

  const close = (o: boolean) => {
    if (!o) {
      form.reset(blank());
      disburse.reset();
      verify.reset();
    }
    onOpenChange(o);
  };

  const runVerify = async () => {
    const ok = await form.trigger(["accountNumber", "institutionCode"]);
    if (!ok) return;
    const { accountNumber, institutionCode } = form.getValues();
    verify.mutate(
      { accountNumber: accountNumber.trim(), institutionCode },
      {
        onSuccess: (res) => {
          if (res.accountName) {
            form.setValue("accountName", res.accountName, { shouldValidate: true });
            toast.success(`This account belongs to ${res.accountName}`);
          } else {
            toast.warning(res.message ?? "No name came back. Enter it yourself.");
          }
        },
      },
    );
  };

  const verified = verify.isSuccess && Boolean(verify.data.accountName);

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={close}
        title="Send a payout"
        description="Pay a bank account or mobile wallet."
        footer={
          disburse.isSuccess ? (
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
        {disburse.isSuccess ? (
          <ResultPanel title="Payout submitted" data={disburse.data} />
        ) : (
          <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(setPending)} noValidate>
            <Field label="Institution" htmlFor="d-inst" error={e.institutionCode?.message}>
              <InstitutionSelect id="d-inst" include="both" {...form.register("institutionCode", { onChange: () => verify.reset() })} />
            </Field>
            <Field label="Account or wallet number" htmlFor="d-acct" error={e.accountNumber?.message}>
              <div className="flex gap-2">
                <Input id="d-acct" inputMode="numeric" {...form.register("accountNumber", { onChange: () => verify.reset() })} />
                <Button variant="quiet" onClick={runVerify} loading={verify.isPending} className="shrink-0">
                  Check name
                </Button>
              </div>
            </Field>
            <Field
              label="Account name"
              htmlFor="d-name"
              error={e.accountName?.message}
              className="sm:col-span-2"
              hint={
                verified ? (
                  <span className="inline-flex items-center gap-1 text-settled">
                    <BadgeCheck className="size-3.5" /> Confirmed by the institution
                  </span>
                ) : (
                  "Check the name before sending money."
                )
              }
            >
              <Input id="d-name" {...form.register("accountName")} />
            </Field>
            <Field label="Amount (GHS)" htmlFor="d-amount" error={e.amount?.message}>
              <Input id="d-amount" type="number" step="0.01" min="0" inputMode="decimal" {...form.register("amount")} />
            </Field>
            <Field label="Reference" htmlFor="d-ref" error={e.reference?.message}>
              <Input id="d-ref" placeholder="September salary" {...form.register("reference")} />
            </Field>
            <Field label="Your reference" htmlFor="d-ctid" error={e.clientTransactionId?.message} className="sm:col-span-2" hint="Generated for you; must be unique.">
              <Input id="d-ctid" {...form.register("clientTransactionId")} />
            </Field>
          </form>
        )}
      </Sheet>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title="Send this money?"
        description={
          pending && (
            <>
              Send <b>{formatMoney(pending.amount, pending.currency)}</b> to <b>{pending.accountName}</b> ({pending.accountNumber}).
              {!verified && <span className="mt-2 block text-pending">This name has not been checked with the institution.</span>}
            </>
          )
        }
        confirmLabel="Send money"
        loading={disburse.isPending}
        onConfirm={() =>
          pending &&
          disburse.mutate(pending, {
            onSuccess: () => toast.success("Payout submitted"),
            onSettled: () => setPending(null),
          })
        }
      />
    </>
  );
}
