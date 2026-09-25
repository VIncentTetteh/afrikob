"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { CurrencySelect } from "@/components/ui/currency-select";
import { Field, Input, Select } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Sheet } from "@/components/ui/sheet";
import { useRequestTopUp } from "@/lib/api/hooks";
import { topUpSchema, type TopUp, type TopUpInput } from "@/lib/api/schemas/requests";
import { humanize } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: string;
  walletTypes: string[];
}

/** Asks Afrikob to fund a wallet. The request waits for approval, it does not move money. */
export function TopUpRequestSheet({ open, onOpenChange, currency, walletTypes }: Props) {
  const requestTopUp = useRequestTopUp();
  const defaults: TopUpInput = { currency, amount: "", reference: "", walletType: walletTypes[0] ?? "" };
  const form = useForm<TopUpInput, unknown, TopUp>({ resolver: zodResolver(topUpSchema), values: defaults });
  const errors = form.formState.errors;

  const close = (next: boolean) => {
    if (!next) {
      form.reset(defaults);
      requestTopUp.reset();
    }
    onOpenChange(next);
  };

  const submit = form.handleSubmit((body) => requestTopUp.mutate(body, { onSuccess: () => close(false) }));

  return (
    <Sheet
      open={open}
      onOpenChange={close}
      title="Request funds"
      description="Afrikob reviews the request before anything is credited."
      footer={
        <>
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button onClick={submit} loading={requestTopUp.isPending}>
            Send request
          </Button>
        </>
      }
    >
      <form className="space-y-4" noValidate onSubmit={submit}>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Currency" htmlFor="tr-currency" error={errors.currency?.message}>
            <CurrencySelect id="tr-currency" {...form.register("currency")} />
          </Field>
          <Field label="Amount" htmlFor="tr-amount" error={errors.amount?.message} className="col-span-2">
            <MoneyInput id="tr-amount" aria-invalid={Boolean(errors.amount) || undefined} {...form.register("amount")} />
          </Field>
        </div>
        {walletTypes.length > 0 && (
          <Field label="Wallet" htmlFor="tr-wallet" error={errors.walletType?.message}>
            <Select id="tr-wallet" {...form.register("walletType")}>
              {walletTypes.map((type) => (
                <option key={type} value={type}>
                  {humanize(type)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field
          label="Reference"
          htmlFor="tr-reference"
          error={errors.reference?.message}
          hint="The deposit slip or transfer reference Afrikob should match this against."
        >
          <Input id="tr-reference" autoComplete="off" maxLength={100} {...form.register("reference")} />
        </Field>
      </form>
    </Sheet>
  );
}
