"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ConfirmDialog } from "@/components/domain/feedback";
import { Field, Textarea } from "@/components/ui/input";
import type { ApprovalScope } from "@/lib/api/endpoints";
import { useApproval, useDecideApproval } from "@/lib/api/hooks";
import { decideApprovalSchema, type DecideApproval, type DecideApprovalInput } from "@/lib/api/schemas/requests";
import type { ApprovalRequest } from "@/lib/api/schemas/models";
import { humanize } from "@/lib/format";
import { statusTone } from "@/lib/api/schemas/normalize";

interface Props {
  scope: ApprovalScope;
  decision: { request: ApprovalRequest; approve: boolean } | null;
  onClose: () => void;
}

/** Confirms a decision. Approving runs the held action; rejecting needs a reason. */
export function DecideDialog({ scope, decision, onClose }: Props) {
  const decide = useDecideApproval(scope);
  // Someone else may have decided it since the list loaded: read it again first.
  const fresh = useApproval(scope, decision?.request.id ?? null);
  const current = fresh.data ?? null;
  const alreadyDecided = current !== null && statusTone(current.status) !== "pending";
  const form = useForm<DecideApprovalInput, unknown, DecideApproval>({
    resolver: zodResolver(decideApprovalSchema),
    values: { approve: decision?.approve ?? true, comment: "" },
  });

  const close = () => {
    form.reset();
    onClose();
  };

  const submit = form.handleSubmit((body) =>
    decision ? decide.mutate({ id: decision.request.id, body }, { onSuccess: close }) : undefined,
  );

  const approving = decision?.approve ?? true;
  const action = decision ? humanize(decision.request.actionKey ?? "this action") : "";

  return (
    <ConfirmDialog
      open={decision !== null}
      onOpenChange={(open) => !open && close()}
      title={approving ? "Approve this request?" : "Reject this request"}
      description={
        approving ? (
          <>
            Approving runs <b>{action}</b> as it was submitted. Your name is recorded on the decision.
          </>
        ) : (
          <>
            <b>{action}</b> will not run. Tell the person who asked why.
          </>
        )
      }
      confirmLabel={approving ? "Approve" : "Reject"}
      tone={approving ? "settle" : "danger"}
      loading={decide.isPending || fresh.isLoading}
      confirmDisabled={alreadyDecided || fresh.isError}
      onConfirm={submit}
    >
      {alreadyDecided && (
        <p role="alert" className="rounded-lg border border-pending/25 bg-pending-wash px-3 py-2 text-sm text-pending">
          This request is already {current?.status?.toLowerCase() ?? "decided"}. Nothing more to do.
        </p>
      )}
      {fresh.isError && (
        <p role="alert" className="rounded-lg border border-failed/30 bg-failed-wash px-3 py-2 text-sm text-failed">
          Could not confirm this request is still waiting. Close and try again.
        </p>
      )}
      <Field
        label={approving ? "Comment (optional)" : "Reason"}
        htmlFor="decide-comment"
        error={form.formState.errors.comment?.message}
      >
        <Textarea id="decide-comment" maxLength={500} {...form.register("comment")} />
      </Field>
    </ConfirmDialog>
  );
}
