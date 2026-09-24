"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Ledger } from "@/components/ledger/ledger";
import { ConfirmDialog } from "@/components/domain/feedback";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { useFeeMutations, useTenantFees } from "@/lib/api/hooks";
import type { FeeConfig } from "@/lib/api/schemas/models";
import { State } from "@/components/ui/state";
import { upsertFeeSchema, type UpsertFee, type UpsertFeeInput } from "@/lib/api/schemas/requests";

const SUGGESTED_TYPES = ["COLLECTION", "DISBURSEMENT", "BULK_DISBURSEMENT", "REFUND"];

export function FeesPanel({ tenantId }: { tenantId: string }) {
  const fees = useTenantFees(tenantId);
  const { upsert, remove } = useFeeMutations(tenantId);
  const [editing, setEditing] = useState<UpsertFeeInput | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const form = useForm<UpsertFeeInput, unknown, UpsertFee>({ resolver: zodResolver(upsertFeeSchema), values: editing ?? { transactionType: "", percentageFee: "" } });

  const columns = useMemo<ColumnDef<FeeConfig, unknown>[]>(
    () => [
      { id: "transactionType", header: "Applies to", accessorFn: (f) => f.transactionType ?? "", cell: ({ getValue }) => String(getValue() ?? "") },
      { id: "percentageFee", header: "Fee", accessorFn: (f) => f.percentageFee ?? 0, cell: ({ row }) => <span className="figure">{row.original.percentageFee ?? 0}%</span> },
      { id: "isActive", header: "State", accessorFn: (f) => (f.isActive ? "active" : "inactive"), cell: ({ row }) => <State status={row.original.isActive ? "Active" : "Inactive"} /> },
      {
        id: "actions",
        header: "Actions",
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Edit fee" onClick={() => setEditing({ transactionType: row.original.transactionType ?? "", percentageFee: row.original.percentageFee ?? 0 })}><Pencil /></Button>
            <Button variant="ghost" size="icon-sm" aria-label="Delete fee" onClick={() => setDeleting(row.original.transactionType ?? "")}><Trash2 className="text-failed" /></Button>
          </div>
        ),
      },
    ],
    [],
  );

  const submit = form.handleSubmit((body) =>
    upsert.mutate(body, { onSuccess: () => { toast.success("Fee saved"); setEditing(null); } }),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Fees</h2>
        <Button size="sm" onClick={() => setEditing({ transactionType: "", percentageFee: "" })}><Plus /> Add fee</Button>
      </div>
      <Ledger
        tableId="tenant-fees"
        columns={columns}
        data={fees.data ?? []}
        loading={fees.isLoading}
        error={fees.error}
        onRetry={() => fees.refetch()}
        getRowId={(f, i) => f.transactionType ?? String(i)}
        emptyTitle="No fees set"
        emptyDescription="This tenant is not charged a percentage fee."
      />
      <Dialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Fee rule"
        size="sm"
        footer={<><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={submit} loading={upsert.isPending}>Save</Button></>}
      >
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Applies to" htmlFor="fee-type" error={form.formState.errors.transactionType?.message}>
            <Input id="fee-type" list="fee-types" className="uppercase" {...form.register("transactionType")} />
            <datalist id="fee-types">{SUGGESTED_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
          </Field>
          <Field label="Fee percentage" htmlFor="fee-pct" error={form.formState.errors.percentageFee?.message} hint="Percent of each payment, e.g. 1.5">
            <Input id="fee-pct" type="number" min="0" max="100" step="0.01" {...form.register("percentageFee")} />
          </Field>
        </form>
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Remove this fee?"
        description={<>New payments of type <b>{deleting}</b> will no longer carry this fee.</>}
        confirmLabel="Remove"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting, { onSuccess: () => toast.success("Fee removed"), onSettled: () => setDeleting(null) })}
      />
    </div>
  );
}
