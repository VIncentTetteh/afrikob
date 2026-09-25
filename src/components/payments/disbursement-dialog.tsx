"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BadgeCheck } from "lucide-react";
import { useRef, useState } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { InstitutionSelect } from "./institution-select";
import { ResultPanel, toastFor } from "./result-panel";
import { ConfirmDialog } from "@/components/domain/feedback";
import { Button } from "@/components/ui/button";
import { Field, InlineAction, Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Sheet } from "@/components/ui/sheet";
import { useBalance, useDisburse, useTelcoCodes, useVerifyName } from "@/lib/api/hooks";
import {
  disbursementSchema,
  newClientTransactionId,
  withDestination,
  type Disbursement,
  type DisbursementInput,
} from "@/lib/api/schemas/requests";
import { formatMoney } from "@/lib/format";
import { ghanaMobile } from "@/lib/validation/fields";

const GHANA_ONLY = ["GH"] as const;

const blank = (): DisbursementInput => ({
  clientTransactionId: newClientTransactionId("PAY"),
  accountNumber: "",
  institutionCode: "",
  amount: "",
  currency: "GHS",
  reference: "",
  accountName: "",
});

/** Single disbursement: verify the beneficiary, then confirm and send. */
export function DisbursementSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const disburse = useDisburse();
  const verify = useVerifyName();
  const balance = useBalance("disbursement", open);
  const telcoCodes = useTelcoCodes();
  const [pending, setPending] = useState<Disbursement | null>(null);

  // The destination rule depends on the telco list, which loads after the form
  // mounts; the resolver always reads the latest one.
  const telcoRef = useRef(telcoCodes);
  telcoRef.current = telcoCodes;
  const resolver: Resolver<DisbursementInput, unknown, Disbursement> = (values, context, options) =>
    zodResolver(withDestination(disbursementSchema, telcoRef.current))(values, context, options);

  const form = useForm<DisbursementInput, unknown, Disbursement>({ resolver, defaultValues: blank() });
  const e = form.formState.errors;
  const institution = form.watch("institutionCode");
  const isWallet = telcoCodes.has((institution ?? "").toUpperCase());

  const close = (o: boolean) => {
    if (!o) {
      form.reset(blank());
      disburse.reset();
      verify.reset();
    }
    onOpenChange(o);
  };

  const resetVerification = () => {
    if (verify.isSuccess) form.setValue("accountName", "");
    verify.reset();
  };

  const runVerify = async () => {
    const ok = await form.trigger(["accountNumber", "institutionCode"]);
    if (!ok) return;
    const { accountNumber, institutionCode } = form.getValues();
    const destination = isWallet ? ghanaMobile.safeParse(accountNumber) : null;
    if (destination && !destination.success) {
      form.setError("accountNumber", { message: destination.error.issues[0]?.message });
      return;
    }
    verify.mutate(
      { accountNumber: destination?.data ?? accountNumber.replace(/[\s-]/g, ""), institutionCode },
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
  const available = balance.data?.availableBalance ?? null;
  const overBalance = pending !== null && available !== null && pending.amount > available;

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={close}
        title="Send a disbursement"
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
          <ResultPanel outcome={disburse.data} />
        ) : (
          <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(setPending)} noValidate>
            <Field label="Institution" htmlFor="d-inst" error={e.institutionCode?.message}>
              <InstitutionSelect
                id="d-inst"
                include="both"
                aria-invalid={Boolean(e.institutionCode) || undefined}
                {...form.register("institutionCode", {
                  onChange: () => {
                    resetVerification();
                    form.setValue("accountNumber", "");
                  },
                })}
              />
            </Field>
            <Field
              label={isWallet ? "Wallet number" : "Account number"}
              htmlFor="d-acct"
              error={e.accountNumber?.message}
              className="sm:col-span-2"
            >
              <InlineAction
                action={
                  <Button variant="quiet" onClick={runVerify} loading={verify.isPending} disabled={!institution}>
                    Check name
                  </Button>
                }
              >
                  {isWallet ? (
                    <Controller
                      control={form.control}
                      name="accountNumber"
                      render={({ field, fieldState }) => (
                        <PhoneInput
                          id="d-acct"
                          countries={GHANA_ONLY}
                          value={field.value}
                          onChange={(v) => {
                            field.onChange(v);
                            resetVerification();
                          }}
                          onBlur={field.onBlur}
                          invalid={Boolean(fieldState.error)}
                        />
                      )}
                    />
                  ) : (
                    <Input
                      id="d-acct"
                      inputMode="numeric"
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={24}
                      placeholder="Account number"
                      aria-invalid={Boolean(e.accountNumber) || undefined}
                      {...form.register("accountNumber", { onChange: resetVerification })}
                    />
                  )}
              </InlineAction>
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
              {/* A confirmed name cannot be edited: change the number to check again. */}
              <Input id="d-name" readOnly={verified} autoComplete="off" maxLength={150} {...form.register("accountName")} />
            </Field>
            <Field
              label="Amount (GHS)"
              htmlFor="d-amount"
              error={e.amount?.message}
              hint={available !== null ? `Available: ${formatMoney(available, balance.data?.currency ?? "GHS")}` : undefined}
            >
              <MoneyInput id="d-amount" aria-invalid={Boolean(e.amount) || undefined} {...form.register("amount")} />
            </Field>
            <Field label="Reference" htmlFor="d-ref" error={e.reference?.message}>
              <Input id="d-ref" placeholder="September salary" autoComplete="off" maxLength={100} {...form.register("reference")} />
            </Field>
            <Field
              label="Your reference"
              htmlFor="d-ctid"
              error={e.clientTransactionId?.message}
              className="sm:col-span-2"
              hint="Generated for you; must be unique."
            >
              <Input id="d-ctid" autoComplete="off" spellCheck={false} maxLength={64} className="font-mono" {...form.register("clientTransactionId")} />
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
              {overBalance && (
                <span role="alert" className="mt-2 block text-failed">
                  That is more than the {formatMoney(available, balance.data?.currency ?? "GHS")} available to disburse.
                </span>
              )}
            </>
          )
        }
        confirmLabel="Send money"
        loading={disburse.isPending}
        confirmDisabled={overBalance}
        onConfirm={() =>
          pending &&
          !overBalance &&
          disburse.mutate(pending, {
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
