"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Check, Eye, MoreHorizontal, RefreshCw, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ApprovalSheet } from "./approval-sheet";
import { DecideDialog } from "./decide-dialog";
import { Ref } from "@/components/domain/feedback";
import { PageHeader } from "@/components/domain/page-header";
import { Ledger } from "@/components/ledger/ledger";
import { Button } from "@/components/ui/button";
import { DropdownContent, DropdownItem, DropdownMenu, DropdownTrigger } from "@/components/ui/dropdown";
import { State } from "@/components/ui/state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ApprovalScope } from "@/lib/api/endpoints";
import { useApprovals } from "@/lib/api/hooks";
import type { ApprovalRequest } from "@/lib/api/schemas/models";
import { useSession } from "@/lib/api/session";
import { display, formatDate, humanize } from "@/lib/format";

/** Status values passed to ?status=. Confirm the casing against the gateway. */
const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "Pending", label: "Waiting" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
];

const AWAITING = /pend|await|request|open/i;

type Decision = { request: ApprovalRequest; approve: boolean } | null;

interface Props {
  scope: ApprovalScope;
  description: string;
}

/**
 * Where actions held for a second pair of eyes come to rest. Afrikob staff and
 * a tenant's own admin get the same inbox at their own scope.
 */
export function ApprovalsInbox({ scope, description }: Props) {
  const [status, setStatus] = useState("");
  const approvals = useApprovals(scope, status || undefined);
  const { data: session } = useSession();
  const [viewing, setViewing] = useState<ApprovalRequest | null>(null);
  const [decision, setDecision] = useState<Decision>(null);
  const canDecide = session?.canCheck ?? true;

  const columns = useMemo<ColumnDef<ApprovalRequest, unknown>[]>(
    () => [
      { id: "createdAt", header: "Requested", accessorFn: (a) => a.createdAt ?? "", cell: ({ row }) => formatDate(row.original.createdAt) },
      {
        id: "actionKey",
        header: "Action",
        accessorFn: (a) => a.actionKey ?? "",
        cell: ({ row }) => <span className="font-medium">{humanize(row.original.actionKey ?? "Unknown")}</span>,
      },
      { id: "status", header: "State", accessorFn: (a) => a.status ?? "", cell: ({ row }) => <State status={row.original.status} /> },
      { id: "requestedBy", header: "Asked by", accessorFn: (a) => a.requestedBy ?? "", cell: ({ getValue }) => display(getValue()) },
      {
        id: "requiredApprovals",
        header: "Approvals needed",
        accessorFn: (a) => a.requiredApprovals ?? 1,
        cell: ({ row }) => display(row.original.requiredApprovals ?? 1),
      },
      { id: "resourceType", header: "About", accessorFn: (a) => a.resourceType ?? "", cell: ({ getValue }) => humanize(String(getValue() ?? "")) || "N/A" },
      { id: "decidedSummary", header: "Outcome", accessorFn: (a) => a.decidedSummary ?? "", cell: ({ getValue }) => display(getValue()) },
      { id: "tenantId", header: "Tenant", accessorFn: (a) => a.tenantId ?? "", cell: ({ getValue }) => <Ref>{display(getValue())}</Ref> },
      { id: "id", header: "Request ID", accessorFn: (a) => a.id, cell: ({ getValue }) => <Ref>{display(getValue())}</Ref> },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => {
          const request = row.original;
          const waiting = AWAITING.test(request.status ?? "");
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Request actions">
                    <MoreHorizontal />
                  </Button>
                </DropdownTrigger>
                <DropdownContent>
                  <DropdownItem onSelect={() => setViewing(request)}>
                    <Eye /> Open
                  </DropdownItem>
                  <DropdownItem disabled={!canDecide || !waiting} onSelect={() => setDecision({ request, approve: true })}>
                    <Check /> Approve
                  </DropdownItem>
                  <DropdownItem
                    disabled={!canDecide || !waiting}
                    destructive
                    onSelect={() => setDecision({ request, approve: false })}
                  >
                    <X /> Reject
                  </DropdownItem>
                </DropdownContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [canDecide],
  );

  return (
    <>
      <PageHeader
        title="Approvals"
        description={description}
        actions={
          <Button variant="outline" onClick={() => approvals.refetch()} loading={approvals.isRefetching}>
            {!approvals.isRefetching && <RefreshCw />} Refresh
          </Button>
        }
      />
      <Tabs value={status} onValueChange={setStatus}>
        <TabsList>
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.label} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Ledger
        tableId={`approvals-${scope}`}
        columns={columns}
        data={approvals.data ?? []}
        loading={approvals.isLoading}
        error={approvals.error}
        onRetry={() => approvals.refetch()}
        onRowClick={setViewing}
        getRowId={(a, i) => a.id || String(i)}
        emptyTitle="Nothing waiting"
        emptyDescription="Actions that need a second pair of eyes will appear here."
        searchPlaceholder="Search by action, person or tenant"
      />

      <ApprovalSheet
        request={viewing}
        canDecide={canDecide}
        onOpenChange={(open) => !open && setViewing(null)}
        onDecide={(request, approve) => {
          setViewing(null);
          setDecision({ request, approve });
        }}
      />
      <DecideDialog scope={scope} decision={decision} onClose={() => setDecision(null)} />
    </>
  );
}
