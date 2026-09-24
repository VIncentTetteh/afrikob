"use client";

import { Check, X } from "lucide-react";
import { KeyValueList, recordToItems, type KvItem } from "@/components/domain/key-value-list";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { State } from "@/components/ui/state";
import { parseApprovalPayload, type ApprovalRequest } from "@/lib/api/schemas/models";
import { display, formatDate, formatMoney, humanize } from "@/lib/format";

interface Props {
  request: ApprovalRequest | null;
  canDecide: boolean;
  onOpenChange: (open: boolean) => void;
  onDecide: (request: ApprovalRequest, approve: boolean) => void;
}

const MONEY_FIELD = /amount|balance|limit|fee/i;

/** Renders the held action's payload, formatting the money fields. */
function payloadItems(payload: Record<string, unknown>): KvItem[] {
  return Object.entries(payload).map(([key, value]) => ({
    label: humanize(key),
    value: MONEY_FIELD.test(key) && typeof value === "number" ? formatMoney(value) : display(value),
  }));
}

/** The full request beside the ledger, with what it would do if approved. */
export function ApprovalSheet({ request, canDecide, onOpenChange, onDecide }: Props) {
  const payload = request ? parseApprovalPayload(request.rawPayloadJson) : null;
  const waiting = /pend|await|request|open/i.test(request?.status ?? "");

  return (
    <Sheet
      open={request !== null}
      onOpenChange={onOpenChange}
      title={request ? humanize(request.actionKey ?? "Request") : "Request"}
      description={request?.requestedBy ? `Asked by ${request.requestedBy}` : undefined}
      footer={
        request &&
        canDecide &&
        waiting && (
          <>
            <Button variant="danger" onClick={() => onDecide(request, false)}>
              <X /> Reject
            </Button>
            <Button variant="settle" onClick={() => onDecide(request, true)}>
              <Check /> Approve
            </Button>
          </>
        )
      }
    >
      {request && (
        <div className="space-y-6">
          <KeyValueList
            items={[
              { label: "State", value: <State status={request.status} /> },
              { label: "Approvals needed", value: display(request.requiredApprovals ?? 1) },
              { label: "Requested", value: formatDate(request.createdAt) },
              { label: "Decided", value: request.decidedAt ? formatDate(request.decidedAt) : "Not yet" },
              { label: "Outcome", value: display(request.decidedSummary) },
            ]}
          />

          <section>
            <h3 className="mb-1 text-sm font-medium">What this would do</h3>
            {payload ? (
              <KeyValueList items={payloadItems(payload)} />
            ) : request.rawPayloadJson ? (
              // Not JSON we can read: show it verbatim rather than hiding it.
              <pre className="overflow-x-auto rounded-lg border border-line bg-field p-3 text-xs">
                {request.rawPayloadJson}
              </pre>
            ) : (
              <p className="text-sm text-ink-soft">The request carries no payload.</p>
            )}
          </section>

          <section>
            <h3 className="mb-1 text-sm font-medium">Everything on this request</h3>
            <KeyValueList items={recordToItems(request).filter((i) => i.label !== "Raw Payload Json")} />
          </section>
        </div>
      )}
    </Sheet>
  );
}
