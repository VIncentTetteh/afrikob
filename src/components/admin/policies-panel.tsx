"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Ledger } from "@/components/ledger/ledger";
import { ConfirmDialog } from "@/components/domain/feedback";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input } from "@/components/ui/input";
import { State } from "@/components/ui/state";
import { useApprovalPolicies, usePolicyMutations } from "@/lib/api/hooks";
import type { ApprovalPolicy } from "@/lib/api/schemas/models";
import { upsertApprovalPolicySchema, type UpsertApprovalPolicy, type UpsertApprovalPolicyInput } from "@/lib/api/schemas/requests";
import { display } from "@/lib/format";

const SUGGESTED_ACTIONS = ["DISBURSEMENT", "BULK_DISBURSEMENT", "REFUND", "WALLET_TOPUP", "FEE_CHANGE"];

/** Maker-checker rules, optionally scoped to one tenant. */
export function PoliciesPanel({ tenantId, showHeader = true }: { tenantId?: string; showHeader?: boolean }) {
  const policies = useApprovalPolicies(tenantId);
  const { upsert, remove } = usePolicyMutations();
  const [editing, setEditing] = useState<UpsertApprovalPolicyInput | null>(null);
  const [deleting, setDeleting] = useState<ApprovalPolicy | null>(null);
  const blank: UpsertApprovalPolicyInput = { actionKey: "", tenantId: tenantId ?? "", isEnabled: true, requiredApprovals: 1, allowRequesterToApprove: false };
  const form = useForm<UpsertApprovalPolicyInput, unknown, UpsertApprovalPolicy>({ resolver: zodResolver(upsertApprovalPolicySchema), values: editing ?? blank });

  const columns = useMemo<ColumnDef<ApprovalPolicy, unknown>[]>(
    () => [
      { id: "actionKey", header: "Action", accessorFn: (p) => p.actionKey ?? "", cell: ({ getValue }) => <span className="text-sm">{String(getValue() ?? "")}</span> },
      { id: "tenantId", header: "Scope", accessorFn: (p) => p.tenantId ?? "", cell: ({ row }) => display(row.original.tenantId ?? "Global") },
      { id: "isEnabled", header: "Status", accessorFn: (p) => (p.isEnabled ? "enabled" : "disabled"), cell: ({ row }) => <State status={row.original.isEnabled ? "Active" : "Off"} /> },
      { id: "requiredApprovals", header: "Approvals needed", accessorFn: (p) => p.requiredApprovals ?? 1 },
      { id: "allowRequesterToApprove", header: "Can self-approve", accessorFn: (p) => (p.allowRequesterToApprove ? "Yes" : "No") },
      {
        id: "actions",
        header: "Actions",
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Edit policy" onClick={() => setEditing({ actionKey: row.original.actionKey ?? "", tenantId: row.original.tenantId ?? "", isEnabled: row.original.isEnabled, requiredApprovals: row.original.requiredApprovals ?? 1, allowRequesterToApprove: row.original.allowRequesterToApprove })}><Pencil /></Button>
            <Button variant="ghost" size="icon-sm" aria-label="Delete policy" disabled={!row.original.id} onClick={() => setDeleting(row.original)}><Trash2 className="text-failed" /></Button>
          </div>
        ),
      },
    ],
    [],
  );

  const submit = form.handleSubmit((body) =>
    upsert.mutate(body, { onSuccess: () => { toast.success("Rule saved"); setEditing(null); } }),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        {showHeader && <h2 className="text-lg font-semibold">Approval rules</h2>}
        <Button size="sm" className="ml-auto" onClick={() => setEditing(blank)}><Plus /> Add rule</Button>
      </div>
      <Ledger
        tableId={`policies-${tenantId ? "tenant" : "global"}`}
        columns={columns}
        data={policies.data ?? []}
        loading={policies.isLoading}
        error={policies.error}
        onRetry={() => policies.refetch()}
        getRowId={(p, i) => p.id || `${p.actionKey}-${i}`}
        emptyTitle="No approval rules"
        emptyDescription="Actions run as soon as they are submitted."
      />
      <Dialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Approval rule"
        description="Hold an action until enough people approve it."
        size="sm"
        footer={<><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={submit} loading={upsert.isPending}>Save policy</Button></>}
      >
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Action" htmlFor="pol-action" error={form.formState.errors.actionKey?.message}>
            <Input id="pol-action" list="pol-actions" className="font-mono uppercase" {...form.register("actionKey")} />
            <datalist id="pol-actions">{SUGGESTED_ACTIONS.map((a) => <option key={a} value={a} />)}</datalist>
          </Field>
          <Field label="Tenant" htmlFor="pol-tenant" hint="Leave blank to apply to every tenant" error={form.formState.errors.tenantId?.message}>
            <Input id="pol-tenant" disabled={Boolean(tenantId)} {...form.register("tenantId")} />
          </Field>
          <Field label="Approvals needed" htmlFor="pol-count" error={form.formState.errors.requiredApprovals?.message}>
            <Input id="pol-count" type="number" min="1" max="10" {...form.register("requiredApprovals")} />
          </Field>
          <Controller control={form.control} name="isEnabled" render={({ field }) => <Checkbox label="Rule is on" checked={Boolean(field.value)} onChange={(e) => field.onChange(e.target.checked)} />} />
          <Controller control={form.control} name="allowRequesterToApprove" render={({ field }) => <Checkbox label="The person who submits may also approve" checked={Boolean(field.value)} onChange={(e) => field.onChange(e.target.checked)} />} />
        </form>
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Remove this rule?"
        description={<>Actions of type <b>{deleting?.actionKey}</b> will run without approval.</>}
        confirmLabel="Remove"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => toast.success("Rule removed"), onSettled: () => setDeleting(null) })}
      />
    </div>
  );
}
