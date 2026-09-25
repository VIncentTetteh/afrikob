"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { CopyButton } from "@/components/domain/feedback";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Sheet } from "@/components/ui/sheet";
import { FirstAdminSheet } from "./first-admin-sheet";
import { useCreateTenant } from "@/lib/api/hooks";
import { createTenantSchema, type CreateTenant, type CreateTenantInput } from "@/lib/api/schemas/requests";

const defaults: CreateTenantInput = {
  code: "",
  legalName: "",
  displayName: "",
  dailyLimit: "",
  perTransactionLimit: "",
  requestsPerMinute: 60,
};

/**
 * Onboards a merchant in two steps: the tenant, whose integration key the gateway
 * returns once, then the first administrator who signs in for them.
 */
export function CreateTenantSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useCreateTenant();
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);
  const [adminFor, setAdminFor] = useState<{ id: string; name: string } | null>(null);
  const form = useForm<CreateTenantInput, unknown, CreateTenant>({ resolver: zodResolver(createTenantSchema), defaultValues: defaults });
  const e = form.formState.errors;

  const close = (o: boolean) => {
    if (!o) {
      form.reset(defaults);
      create.reset();
    }
    onOpenChange(o);
  };

  const submit = form.handleSubmit((body) =>
    create.mutate(body, {
      onSuccess: (result) => {
        close(false);
        // A 202 queues the tenant for approval: nothing exists yet to add people to.
        const tenant = result.data?.tenantId ? { id: result.data.tenantId, name: body.displayName } : null;
        if (result.data?.apiKey) {
          setIssuedKey(result.data.apiKey);
          setAcknowledged(false);
          setCreated(tenant);
        } else {
          setAdminFor(tenant);
        }
      },
    }),
  );

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={close}
        title="Add a tenant"
        description="Onboard a merchant onto the gateway."
        footer={
          <>
            <Button variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button onClick={submit} loading={create.isPending}>
              Create tenant
            </Button>
          </>
        }
      >
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <Field label="Code" htmlFor="t-code" error={e.code?.message} hint="Short and unique, e.g. AFIKOB">
            <Input id="t-code" className="font-mono uppercase" autoComplete="off" spellCheck={false} maxLength={20} {...form.register("code")} />
          </Field>
          <Field label="Trading name" htmlFor="t-display" error={e.displayName?.message}>
            <Input id="t-display" autoComplete="off" maxLength={150} {...form.register("displayName")} />
          </Field>
          <Field label="Registered name" htmlFor="t-legal" error={e.legalName?.message} className="sm:col-span-2">
            <Input id="t-legal" autoComplete="off" maxLength={150} {...form.register("legalName")} />
          </Field>
          <Field label="Daily limit (GHS)" htmlFor="t-daily" error={e.dailyLimit?.message} hint="Leave blank for no limit">
            <MoneyInput id="t-daily" placeholder="No limit" {...form.register("dailyLimit")} />
          </Field>
          <Field label="Per-payment limit (GHS)" htmlFor="t-per" error={e.perTransactionLimit?.message} hint="Leave blank for no limit">
            <MoneyInput id="t-per" placeholder="No limit" {...form.register("perTransactionLimit")} />
          </Field>
          <Field label="Requests per minute" htmlFor="t-rpm" error={e.requestsPerMinute?.message} className="sm:col-span-2">
            <Input id="t-rpm" inputMode="numeric" autoComplete="off" maxLength={6} {...form.register("requestsPerMinute")} />
          </Field>
        </form>
      </Sheet>

      <RevealKeyDialog
        apiKey={issuedKey}
        acknowledged={acknowledged}
        onAcknowledge={setAcknowledged}
        onClose={() => {
          setIssuedKey(null);
          setAdminFor(created);
          setCreated(null);
        }}
        title="Save their integration key"
      />

      <FirstAdminSheet tenantId={adminFor?.id ?? null} tenantName={adminFor?.name} onClose={() => setAdminFor(null)} />
    </>
  );
}

/** Shows a secret once: it cannot be retrieved again. */
export function RevealKeyDialog({
  apiKey,
  acknowledged,
  onAcknowledge,
  onClose,
  title = "Save this API key",
}: {
  apiKey: string | null;
  acknowledged: boolean;
  onAcknowledge: (v: boolean) => void;
  onClose: () => void;
  title?: string;
}) {
  return (
    <Dialog
      open={apiKey !== null}
      onOpenChange={(o) => {
        if (!o && acknowledged) onClose();
      }}
      title={title}
      description="For the tenant's own systems to call the gateway, not for signing in. This is the only time it is shown."
      footer={
        <Button disabled={!acknowledged} onClick={onClose}>
          Done
        </Button>
      }
    >
      {apiKey && (
        <div className="space-y-4">
          <p className="flex gap-2 rounded-lg border border-pending/25 bg-pending-wash px-3 py-2.5 text-sm text-pending">
            <ShieldAlert className="size-4 shrink-0" aria-hidden />
            Put it in a secrets manager. Never paste it into chat or commit it.
          </p>
          <code className="block break-all rounded-lg border border-line bg-field p-3 text-sm">{apiKey}</code>
          <CopyButton value={apiKey} label="Copy key" className="w-full" />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => onAcknowledge(e.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            I have stored this key
          </label>
        </div>
      )}
    </Dialog>
  );
}
