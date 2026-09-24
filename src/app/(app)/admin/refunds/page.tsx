"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Check, CheckCheck, Eye, MoreHorizontal, RefreshCw, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog, Ref } from "@/components/domain/feedback";
import { KeyValueList, recordToItems } from "@/components/domain/key-value-list";
import { PageHeader } from "@/components/domain/page-header";
import { Ledger } from "@/components/ledger/ledger";
import { Button } from "@/components/ui/button";
import { DropdownContent, DropdownItem, DropdownMenu, DropdownTrigger } from "@/components/ui/dropdown";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { State } from "@/components/ui/state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminRefunds, useRefundDecision } from "@/lib/api/hooks";
import type { Refund } from "@/lib/api/schemas/models";
import { useSession } from "@/lib/api/session";
import { display, formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Status values passed to ?status=. Confirm the exact casing against the gateway. */
const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "Pending", label: "Waiting" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
  { value: "Completed", label: "Settled" },
];

const AWAITING = /pend|request|await/i;
const APPROVED = /approv|process/i;

type Action = { kind: "view" | "approve" | "reject" | "complete"; refund: Refund } | null;

export default function AdminRefundsPage() {
  const [status, setStatus] = useState("");
  const refunds = useAdminRefunds(status || undefined);
  const { data: session } = useSession();
  const [action, setAction] = useState<Action>(null);
  const canCheck = session?.canCheck ?? true;

  const columns = useMemo<ColumnDef<Refund, unknown>[]>(
    () => [
      { id: "createdAt", header: "Requested", accessorFn: (r) => r.createdAt ?? "", cell: ({ row }) => formatDate(row.original.createdAt) },
      {
        id: "amount",
        header: "Amount",
        accessorFn: (r) => r.amount ?? 0,
        cell: ({ row }) => <span className="figure">{formatMoney(row.original.amount, row.original.currency)}</span>,
      },
      { id: "status", header: "State", accessorFn: (r) => r.status ?? "", cell: ({ row }) => <State status={row.original.status} /> },
      {
        id: "reason",
        header: "Reason",
        accessorFn: (r) => r.reason ?? "",
        cell: ({ getValue }) => <span className="block max-w-56 truncate">{display(getValue())}</span>,
      },
      { id: "requestedBy", header: "Asked by", accessorFn: (r) => r.requestedBy ?? "", cell: ({ getValue }) => display(getValue()) },
      { id: "approvedBy", header: "Approved by", accessorFn: (r) => r.approvedBy ?? "", cell: ({ getValue }) => display(getValue()) },
      { id: "tenantId", header: "Tenant", accessorFn: (r) => r.tenantId ?? "", cell: ({ getValue }) => <Ref>{display(getValue())}</Ref> },
      {
        id: "transactionId",
        header: "Transaction",
        accessorFn: (r) => r.transactionId ?? "",
        cell: ({ getValue }) => <Ref>{display(getValue())}</Ref>,
      },
      { id: "id", header: "Refund ID", accessorFn: (r) => r.id, cell: ({ getValue }) => <Ref>{display(getValue())}</Ref> },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          const state = r.status ?? "";
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Refund actions">
                    <MoreHorizontal />
                  </Button>
                </DropdownTrigger>
                <DropdownContent>
                  <DropdownItem onSelect={() => setAction({ kind: "view", refund: r })}>
                    <Eye /> Open
                  </DropdownItem>
                  <DropdownItem disabled={!canCheck || !AWAITING.test(state)} onSelect={() => setAction({ kind: "approve", refund: r })}>
                    <Check /> Approve
                  </DropdownItem>
                  <DropdownItem
                    disabled={!canCheck || !AWAITING.test(state)}
                    destructive
                    onSelect={() => setAction({ kind: "reject", refund: r })}
                  >
                    <X /> Reject
                  </DropdownItem>
                  <DropdownItem disabled={!APPROVED.test(state)} onSelect={() => setAction({ kind: "complete", refund: r })}>
                    <CheckCheck /> Record outcome
                  </DropdownItem>
                </DropdownContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [canCheck],
  );

  const close = () => setAction(null);

  return (
    <>
      <PageHeader
        title="Refunds"
        description="Money going back to customers, across every tenant"
        actions={
          <Button variant="outline" onClick={() => refunds.refetch()} loading={refunds.isRefetching}>
            {!refunds.isRefetching && <RefreshCw />} Refresh
          </Button>
        }
      />
      <Tabs value={status} onValueChange={setStatus}>
        <TabsList>
          {STATUS_TABS.map((t) => (
            <TabsTrigger key={t.label} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Ledger
        tableId="admin-refunds"
        columns={columns}
        data={refunds.data ?? []}
        loading={refunds.isLoading}
        error={refunds.error}
        onRetry={() => refunds.refetch()}
        onRowClick={(r) => setAction({ kind: "view", refund: r })}
        getRowId={(r, i) => r.id || String(i)}
        getDirection={() => "out"}
        emptyTitle="Nothing in this state"
        emptyDescription="Refund requests from tenants land here for review."
      />

      <Sheet
        open={action?.kind === "view"}
        onOpenChange={(o) => !o && close()}
        title={action ? formatMoney(action.refund.amount, action.refund.currency) : "Refund"}
        description={action?.refund.reason ?? undefined}
      >
        {action && <KeyValueList items={recordToItems(action.refund)} />}
      </Sheet>
      <ApproveDialog action={action} onClose={close} />
      <RejectDialog action={action} onClose={close} />
      <CompleteDialog action={action} onClose={close} />
    </>
  );
}

function ApproveDialog({ action, onClose }: { action: Action; onClose: () => void }) {
  const { approve } = useRefundDecision();
  const refund = action?.kind === "approve" ? action.refund : null;
  return (
    <ConfirmDialog
      open={refund !== null}
      onOpenChange={(o) => !o && onClose()}
      title="Approve this refund?"
      description={
        refund && (
          <>
            Return <b>{formatMoney(refund.amount, refund.currency)}</b> to the customer on transaction{" "}
            <b>{refund.transactionId}</b>. Your name is recorded on the approval.
          </>
        )
      }
      confirmLabel="Approve"
      tone="settle"
      loading={approve.isPending}
      onConfirm={() => refund && approve.mutate(refund.id, { onSuccess: onClose })}
    />
  );
}

function RejectDialog({ action, onClose }: { action: Action; onClose: () => void }) {
  const { reject } = useRefundDecision();
  const [reason, setReason] = useState("");
  const refund = action?.kind === "reject" ? action.refund : null;
  return (
    <ConfirmDialog
      open={refund !== null}
      onOpenChange={(o) => {
        if (!o) {
          setReason("");
          onClose();
        }
      }}
      title="Reject this refund"
      description="The tenant sees this reason."
      confirmLabel="Reject refund"
      tone="danger"
      loading={reject.isPending}
      onConfirm={() => {
        if (!reason.trim()) {
          toast.error("Give a reason so the tenant knows why.");
          return;
        }
        if (refund)
          reject.mutate(
            { id: refund.id, body: { reason: reason.trim() } },
            {
              onSuccess: () => {
                setReason("");
                onClose();
              },
            },
          );
      }}
    >
      <Field label="Reason" htmlFor="reject-reason">
        <Textarea id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      </Field>
    </ConfirmDialog>
  );
}

function CompleteDialog({ action, onClose }: { action: Action; onClose: () => void }) {
  const { complete } = useRefundDecision();
  const [success, setSuccess] = useState(true);
  const [providerReference, setRef] = useState("");
  const [providerNote, setNote] = useState("");
  const refund = action?.kind === "complete" ? action.refund : null;
  const reset = () => {
    setSuccess(true);
    setRef("");
    setNote("");
  };
  return (
    <ConfirmDialog
      open={refund !== null}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
      title="What did the provider do?"
      description="Record the outcome after the refund was executed."
      confirmLabel={success ? "Mark as paid" : "Mark as failed"}
      tone={success ? "settle" : "danger"}
      loading={complete.isPending}
      onConfirm={() =>
        refund &&
        complete.mutate(
          {
            id: refund.id,
            body: {
              success,
              providerReference: providerReference.trim() || undefined,
              providerNote: providerNote.trim() || undefined,
            },
          },
          {
            onSuccess: () => {
              reset();
              onClose();
            },
          },
        )
      }
    >
      <div role="radiogroup" aria-label="Outcome" className="grid grid-cols-2 gap-1 rounded-lg bg-field p-0.5">
        {[true, false].map((value) => (
          <button
            key={String(value)}
            type="button"
            role="radio"
            aria-checked={success === value}
            onClick={() => setSuccess(value)}
            className={cn("rounded-md py-1.5 text-sm font-medium", success === value ? "bg-paper text-ink shadow-sm" : "text-ink-soft")}
          >
            {value ? "Paid" : "Failed"}
          </button>
        ))}
      </div>
      <Field label="Provider reference" htmlFor="c-ref">
        <Input id="c-ref" value={providerReference} onChange={(e) => setRef(e.target.value)} maxLength={100} />
      </Field>
      <Field label="Note" htmlFor="c-note">
        <Textarea id="c-note" value={providerNote} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </Field>
    </ConfirmDialog>
  );
}
