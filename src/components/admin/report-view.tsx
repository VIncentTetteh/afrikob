"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Download, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BalanceStrip } from "@/components/domain/balance-strip";
import { PageHeader } from "@/components/domain/page-header";
import { Ledger } from "@/components/ledger/ledger";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Panel, PanelBody } from "@/components/ui/panel";
import { State } from "@/components/ui/state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminApi } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/api/errors";
import { useReport, useTenants } from "@/lib/api/hooks";
import type { ReportRow } from "@/lib/api/schemas/models";
import { statusTone } from "@/lib/api/schemas/normalize";
import { reportFilterSchema, type ReportFilter } from "@/lib/api/schemas/requests";
import { display, formatDate, formatMoney, formatNumber } from "@/lib/format";

type Kind = "collections" | "disbursements";

const STATUSES = ["", "Successful", "Pending", "Failed"];
const EMPTY: ReportFilter = { tenantId: undefined, fromDate: undefined, toDate: undefined, status: undefined, currency: undefined };

/**
 * Reconciliation view: filter, read on screen, or download the same rows as a
 * file. With `tenantId` it is locked to one tenant (the tenant record's
 * Transactions tab); without, it spans every tenant (Reports).
 */
export function ReportView({ tenantId }: { tenantId?: string }) {
  const locked: ReportFilter = { ...EMPTY, tenantId };
  const [kind, setKind] = useState<Kind>("collections");
  const [draft, setDraft] = useState<ReportFilter>(locked);
  const [filter, setFilter] = useState<ReportFilter>(locked);
  const [filterError, setFilterError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [downloading, setDownloading] = useState(false);
  const tenants = useTenants(!tenantId);
  const report = useReport(kind, filter);
  const rows = useMemo<ReportRow[]>(() => report.data ?? [], [report.data]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          amount: acc.amount + (row.amount ?? 0),
          fees: acc.fees + (row.fee ?? 0),
          net: acc.net + (row.netToMerchant ?? 0),
          failed: acc.failed + (statusTone(row.transactionStatus) === "failed" ? 1 : 0),
        }),
        { amount: 0, fees: 0, net: 0, failed: 0 },
      ),
    [rows],
  );

  const columns = useMemo<ColumnDef<ReportRow, unknown>[]>(
    () => [
      { id: "dateCreated", header: "Date", accessorFn: (r) => r.dateCreated ?? "", cell: ({ row }) => formatDate(row.original.dateCreated) },
      {
        id: "transactionAccountName",
        header: "Counterparty",
        accessorFn: (r) => `${r.transactionAccountName ?? ""} ${r.transactionAccountNumber ?? ""}`,
        cell: ({ row }) => (
          <span className="block max-w-56 truncate">
            {display(row.original.transactionAccountName)}
            {row.original.transactionAccountNumber && (
              <span className="text-ink-soft"> · {row.original.transactionAccountNumber}</span>
            )}
          </span>
        ),
      },
      {
        id: "amount",
        header: "Amount",
        accessorFn: (r) => r.amount ?? 0,
        cell: ({ row }) => <span className="figure">{formatMoney(row.original.amount, row.original.currency)}</span>,
      },
      {
        id: "fee",
        header: "Fee",
        accessorFn: (r) => r.fee ?? 0,
        cell: ({ row }) => <span className="figure text-ink-soft">{formatMoney(row.original.fee, row.original.currency)}</span>,
      },
      {
        id: "netToMerchant",
        header: "Net to merchant",
        accessorFn: (r) => r.netToMerchant ?? 0,
        cell: ({ row }) => <span className="figure">{formatMoney(row.original.netToMerchant, row.original.currency)}</span>,
      },
      {
        id: "transactionStatus",
        header: "State",
        accessorFn: (r) => r.transactionStatus ?? "",
        cell: ({ row }) => <State status={row.original.transactionStatus} />,
      },
      { id: "branch", header: "Branch", accessorFn: (r) => r.branch ?? "", cell: ({ getValue }) => display(getValue()) },
      { id: "channel", header: "Channel", accessorFn: (r) => r.channel ?? "", cell: ({ getValue }) => display(getValue()) },
      { id: "institutionCode", header: "Institution", accessorFn: (r) => r.institutionCode ?? "", cell: ({ getValue }) => display(getValue()) },
      { id: "reference", header: "Reference", accessorFn: (r) => r.reference ?? "", cell: ({ getValue }) => display(getValue()) },
      { id: "customerEmail", header: "Customer", accessorFn: (r) => r.customerEmail ?? "", cell: ({ getValue }) => display(getValue()) },
      { id: "failureReason", header: "Why it failed", accessorFn: (r) => r.failureReason ?? "", cell: ({ getValue }) => display(getValue()) },
      { id: "transactionId", header: "Transaction", accessorFn: (r) => r.transactionId ?? "", cell: ({ getValue }) => display(getValue()) },
    ],
    [],
  );

  const downloadFile = async () => {
    setDownloading(true);
    try {
      const { blob, filename } = await adminApi.downloadReport(kind, filter);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <PageHeader
        title={tenantId ? "Transactions" : "Reports"}
        description={tenantId ? "Everything this tenant collected and disbursed" : "Reconcile what moved, by tenant and date"}
        actions={
          <>
            <Button variant="outline" onClick={() => report.refetch()} loading={report.isFetching}>
              {!report.isFetching && <RefreshCw />} Refresh
            </Button>
            <Button onClick={downloadFile} loading={downloading}>
              {!downloading && <Download />} Download
            </Button>
          </>
        }
      />

      <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)}>
        <TabsList>
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="disbursements">Disbursements</TabsTrigger>
        </TabsList>
      </Tabs>

      <Panel>
        <PanelBody>
          <form
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
            onSubmit={(e) => {
              e.preventDefault();
              const parsed = reportFilterSchema.safeParse({ ...draft, tenantId: tenantId ?? draft.tenantId });
              if (!parsed.success) {
                setFilterError(parsed.error.issues[0]?.message ?? "Check the filters");
                return;
              }
              setFilterError(null);
              setFilter(parsed.data);
            }}
          >
            {!tenantId && (
              <Field label="Tenant" htmlFor="r-tenant">
                <Select id="r-tenant" value={draft.tenantId ?? ""} onChange={(e) => setDraft({ ...draft, tenantId: e.target.value || undefined })}>
                  <option value="">Every tenant</option>
                  {(tenants.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.displayName ?? t.code ?? t.id}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="From" htmlFor="r-from">
              <Input id="r-from" type="date" max={draft.toDate ?? today} value={draft.fromDate ?? ""} onChange={(e) => setDraft({ ...draft, fromDate: e.target.value || undefined })} />
            </Field>
            <Field label="To" htmlFor="r-to">
              <Input id="r-to" type="date" value={draft.toDate ?? ""} min={draft.fromDate} max={today} onChange={(e) => setDraft({ ...draft, toDate: e.target.value || undefined })} />
            </Field>
            <Field label="State" htmlFor="r-status">
              <Select id="r-status" value={draft.status ?? ""} onChange={(e) => setDraft({ ...draft, status: e.target.value || undefined })}>
                {STATUSES.map((s) => (
                  <option key={s || "any"} value={s}>
                    {s || "Any state"}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end gap-2">
              <Button type="submit" className="flex-1">
                Apply
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDraft(locked);
                  setFilter(locked);
                  setFilterError(null);
                }}
              >
                Clear
              </Button>
            </div>
            {filterError && (
              <p role="alert" className="text-sm text-failed sm:col-span-2 lg:col-span-5">
                {filterError}
              </p>
            )}
          </form>
        </PanelBody>
      </Panel>

      <BalanceStrip
        heroLabel={kind === "collections" ? "Collected" : "Disbursed"}
        heroAmount={totals.amount}
        heroCurrency={rows[0]?.currency ?? "GHS"}
        heroNote={`${formatNumber(rows.length)} records in this report`}
        loading={report.isLoading}
        figures={[
          { label: "Fees", value: formatMoney(totals.fees, rows[0]?.currency ?? "GHS") },
          { label: "Net to merchant", value: formatMoney(totals.net, rows[0]?.currency ?? "GHS"), tone: "settled" },
          { label: "Failed", value: formatNumber(totals.failed), tone: totals.failed > 0 ? "failed" : "default" },
        ]}
      />

      <Ledger
        tableId={`report-${kind}${tenantId ? "-tenant" : ""}`}
        columns={columns}
        data={rows}
        loading={report.isLoading}
        error={report.error}
        onRetry={() => report.refetch()}
        getRowId={(r, i) => r.transactionId ?? String(i)}
        getDirection={() => (kind === "collections" ? "in" : "out")}
        emptyTitle="No records for these filters"
        emptyDescription={tenantId ? "Widen the date range, or clear the filters." : "Widen the date range, or choose a different tenant."}
        searchPlaceholder="Search this report"
      />
    </>
  );
}
