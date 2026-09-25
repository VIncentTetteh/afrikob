"use client";

import { AlertCircle, BadgeCheck, HelpCircle, UploadCloud, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/domain/feedback";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { useBulkNameVerify, useCreateBulk, useTelcoCodes } from "@/lib/api/hooks";
import { applyVerification, buildRows, flagDuplicates, summarize, type BulkRow, type NameMatch } from "@/lib/csv/bulk";
import { parseCsvFile } from "@/lib/csv";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const PREVIEW_LIMIT = 200;

const matchBadge: Record<NameMatch, { label: string; className: string; icon: typeof BadgeCheck }> = {
  unverified: { label: "Not checked", className: "text-ink-soft", icon: HelpCircle },
  match: { label: "Match", className: "text-settled", icon: BadgeCheck },
  mismatch: { label: "Mismatch", className: "text-pending", icon: AlertCircle },
  not_found: { label: "Not found", className: "text-failed", icon: XCircle },
};

export function BulkUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [clientBatchId, setClientBatchId] = useState("");
  const verify = useBulkNameVerify();
  const create = useCreateBulk();
  const telcoCodes = useTelcoCodes();
  const stats = useMemo(() => summarize(rows), [rows]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const parsed = await parseCsvFile(file);
    setFileName(file.name);
    setParseErrors(parsed.errors);
    setRows(flagDuplicates(buildRows(parsed.rows, telcoCodes)));
    setClientBatchId(`BATCH-${crypto.randomUUID()}`);
    verify.reset();
    create.reset();
  };

  const runVerify = () => {
    const accounts = rows.flatMap((r) => (r.item ? [{ accountNumber: r.item.accountNumber, institutionCode: r.item.institutionCode }] : []));
    verify.mutate({ accounts }, { onSuccess: (results) => setRows((current) => applyVerification(current, results)) });
  };

  const applyVerifiedNames = () =>
    setRows((current) =>
      current.map((r) => (r.item && r.verifiedName && r.nameMatch === "mismatch" ? { ...r, item: { ...r.item, accountName: r.verifiedName }, nameMatch: "match" } : r)),
    );

  const submit = () => {
    const disbursements = rows.flatMap((r) => (r.item ? [r.item] : []));
    create.mutate(
      { body: { disbursements }, clientBatchId },
      {
        onSuccess: (outcome) => {
          setConfirming(false);
          // A refused batch keeps its rows, so they can be fixed and sent again.
          if (outcome.tone === "failed") {
            toast.error(outcome.detail ? `${outcome.title}: ${outcome.detail}` : outcome.title);
            return;
          }
          toast[outcome.tone === "success" ? "success" : "info"](`${outcome.title}: ${disbursements.length} disbursements`);
          setRows([]);
          setFileName(null);
          const batchId = outcome.data?.id;
          if (batchId) router.push(`/disbursements/bulk/${encodeURIComponent(batchId)}`);
        },
      },
    );
  };

  const reset = () => {
    setRows([]);
    setFileName(null);
    setParseErrors([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <Panel>
      <PanelHeader
        title="New batch"
        description={fileName ? `${fileName}: ${stats.valid} of ${stats.total} rows ready · ${formatMoney(stats.amount)}` : "Columns: accountNumber, institutionCode, accountName, amount, currency, reference"}
        actions={
          rows.length > 0 && (
            <>
              <Button variant="ghost" onClick={reset}>Clear</Button>
              <Button variant="outline" onClick={runVerify} loading={verify.isPending} disabled={stats.valid === 0}>Check names</Button>
              {stats.mismatches > 0 && <Button variant="quiet" onClick={applyVerifiedNames}>Use checked names ({stats.mismatches})</Button>}
              <Button onClick={() => setConfirming(true)} disabled={stats.valid === 0}>Send batch</Button>
            </>
          )
        }
      />
      <PanelBody>
        {rows.length === 0 ? (
          <label
            htmlFor="bulk-file"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); void onFile(e.dataTransfer.files[0]); }}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong px-6 py-12 text-center transition hover:border-accent hover:bg-accent-wash/40"
          >
            <UploadCloud className="size-8 text-ink-soft" aria-hidden />
            <span className="font-medium">Drop a CSV here, or choose a file</span>
            <span className="text-sm text-ink-soft">Up to 1,000 rows, 2 MB</span>
            <input ref={inputRef} id="bulk-file" type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
          </label>
        ) : (
          <div className="space-y-3">
            {parseErrors.length > 0 && (
              <ul className="rounded-xl bg-failed-wash p-3 text-sm text-failed">{parseErrors.map((e) => <li key={e}>{e}</li>)}</ul>
            )}
            {stats.verified && (stats.mismatches > 0 || stats.notFound > 0) && (
              <p className="rounded-xl bg-pending-wash p-3 text-sm text-pending">
                {stats.mismatches} name mismatch(es) and {stats.notFound} account(s) not found. Review before submitting.
              </p>
            )}
            <div className="max-h-[28rem] overflow-auto rounded-lg border border-line">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-field text-xs uppercase tracking-wide text-ink-soft">
                  <tr>{["#", "Account", "Institution", "Name", "Verified name", "Amount", "Reference", "Check"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-3 font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(0, PREVIEW_LIMIT).map((r) => {
                    const badge = matchBadge[r.nameMatch];
                    return (
                      <tr key={r.index} className={cn("border-t border-line", !r.item && "bg-failed-wash/50")}>
                        <td className="px-3 py-2.5 text-ink-soft">{r.index}</td>
                        <td className="px-3 py-2.5 text-xs">{r.input.accountNumber}</td>
                        <td className="px-3 py-2.5">{r.input.institutionCode}</td>
                        <td className="px-3 py-2.5">{r.item?.accountName ?? r.input.accountName}</td>
                        <td className="px-3 py-2.5">{r.verifiedName ?? "-"}</td>
                        <td className="px-3 py-2.5 tabular-nums">{r.item ? formatMoney(r.item.amount, r.item.currency) : r.input.amount}</td>
                        <td className="px-3 py-2.5">{r.input.reference}</td>
                        <td className="px-3 py-2.5">
                          {r.item ? (
                            <span className={cn("inline-flex items-center gap-1 text-xs font-medium", badge.className)}><badge.icon className="size-3.5" aria-hidden />{badge.label}</span>
                          ) : (
                            <span className="text-xs text-failed">{r.errors.join("; ")}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {rows.length > PREVIEW_LIMIT && <p className="text-xs text-ink-soft">Showing first {PREVIEW_LIMIT} of {rows.length} rows.</p>}
          </div>
        )}
      </PanelBody>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Send this batch?"
        description={<>You are about to pay <b>{stats.valid}</b> beneficiaries a total of <b>{formatMoney(stats.amount)}</b>. {stats.invalid > 0 && `${stats.invalid} invalid row(s) will be skipped.`}</>}
        confirmLabel="Send batch"
        loading={create.isPending}
        onConfirm={submit}
      >
        {!stats.verified && <p className="text-pending">Names have not been checked.</p>}
        {stats.mismatches > 0 && <p className="text-pending">{stats.mismatches} row(s) do not match the registered name.</p>}
        <p className="text-xs">Batch reference: {clientBatchId}</p>
      </ConfirmDialog>
    </Panel>
  );
}
