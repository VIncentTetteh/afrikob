"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusCircle, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { BalanceStrip } from "@/components/domain/balance-strip";
import { ConfirmDialog, ErrorState } from "@/components/domain/feedback";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { CurrencySelect } from "@/components/ui/currency-select";
import { MoneyInput } from "@/components/ui/money-input";
import { Panel } from "@/components/ui/panel";
import { useTenantWallet, useTopUp } from "@/lib/api/hooks";
import { topUpSchema, type TopUp, type TopUpInput } from "@/lib/api/schemas/requests";
import { formatMoney } from "@/lib/format";
import type { ClientSession } from "@/lib/api/session";

const WALLET_TYPES = [
  { value: "", label: "Default wallet" },
  { value: "DISBURSEMENT", label: "Disbursements" },
  { value: "COLLECTION", label: "Collections" },
];

export function WalletPanel({ tenantId, session }: { tenantId: string; session: ClientSession }) {
  const [walletType, setWalletType] = useState("");
  const wallet = useTenantWallet(tenantId, undefined, walletType || undefined);
  const topUp = useTopUp(tenantId);
  const [formOpen, setFormOpen] = useState(false);
  const [pending, setPending] = useState<TopUp | null>(null);
  const form = useForm<TopUpInput, unknown, TopUp>({
    resolver: zodResolver(topUpSchema),
    defaultValues: { currency: "GHS", amount: "", reference: "", walletType: "" },
  });
  const e = form.formState.errors;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label htmlFor="wallet-type" className="text-sm text-ink-soft">
            Wallet
          </label>
          <Select id="wallet-type" value={walletType} onChange={(ev) => setWalletType(ev.target.value)} className="w-44">
            {WALLET_TYPES.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => wallet.refetch()} loading={wallet.isRefetching}>
            {!wallet.isRefetching && <RefreshCw />} Refresh
          </Button>
          {session.canMake && (
            <Button
              onClick={() => {
                form.setValue("walletType", walletType || undefined);
                setFormOpen(true);
              }}
            >
              <PlusCircle /> Add funds
            </Button>
          )}
        </div>
      </div>

      {wallet.isError ? (
        <Panel>
          <ErrorState error={wallet.error} onRetry={() => wallet.refetch()} />
        </Panel>
      ) : (
        <BalanceStrip
          heroLabel="Available"
          heroAmount={wallet.data?.availableBalance ?? null}
          heroCurrency={wallet.data?.currency}
          heroNote="What this tenant can spend right now"
          loading={wallet.isLoading}
          figures={[
            { label: "Reserved", value: formatMoney(wallet.data?.reservedBalance, wallet.data?.currency), tone: "pending" },
            { label: "Total", value: formatMoney(wallet.data?.totalBalance, wallet.data?.currency) },
          ]}
        />
      )}

      <Dialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title="Add funds"
        description="Credit this tenant's wallet after money lands in the settlement account."
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={form.handleSubmit((v) => {
                setPending(v);
                setFormOpen(false);
              })}
            >
              Review
            </Button>
          </>
        }
      >
        <form
          className="space-y-4"
          noValidate
          onSubmit={form.handleSubmit((v) => {
            setPending(v);
            setFormOpen(false);
          })}
        >
          <div className="grid grid-cols-3 gap-3">
            <Field label="Currency" htmlFor="tu-cur" error={e.currency?.message}>
              <CurrencySelect id="tu-cur" {...form.register("currency")} />
            </Field>
            <Field label="Amount" htmlFor="tu-amt" error={e.amount?.message} className="col-span-2">
              <MoneyInput id="tu-amt" aria-invalid={Boolean(e.amount) || undefined} {...form.register("amount")} />
            </Field>
          </div>
          <Field label="Reference" htmlFor="tu-ref" error={e.reference?.message} hint="Deposit slip or transfer reference">
            <Input id="tu-ref" autoComplete="off" maxLength={100} {...form.register("reference")} />
          </Field>
        </form>
      </Dialog>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title="Add these funds?"
        description={
          pending && (
            <>
              Credit <b>{formatMoney(pending.amount, pending.currency)}</b> to this tenant against reference{" "}
              <b>{pending.reference}</b>. Your name is recorded on the entry.
            </>
          )
        }
        confirmLabel="Add funds"
        tone="settle"
        loading={topUp.isPending}
        onConfirm={() =>
          pending &&
          topUp.mutate(pending, {
            onSuccess: () => form.reset({ currency: "GHS", amount: "", reference: "", walletType: walletType || undefined }),
            onSettled: () => setPending(null),
          })
        }
      />
    </div>
  );
}
