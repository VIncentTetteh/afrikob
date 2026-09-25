"use client";

import { Building2, FileSpreadsheet, RotateCcw, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { VolumeChart } from "@/components/charts/volume-chart";
import { BalanceStrip } from "@/components/domain/balance-strip";
import { ErrorState } from "@/components/domain/feedback";
import { PageHeader } from "@/components/domain/page-header";
import { Panel, PanelBody, PanelHeader, Skeleton } from "@/components/ui/panel";
import { useAdminRefunds, useApprovalPolicies, useReport, useTenants } from "@/lib/api/hooks";
import type { ReportRow } from "@/lib/api/schemas/models";
import { statusTone } from "@/lib/api/schemas/normalize";
import type { ReportFilter } from "@/lib/api/schemas/requests";
import { formatMoney, formatNumber } from "@/lib/format";

const REPORT_DAYS = 30;

const shortcuts = [
  { href: "/admin/tenants", label: "Tenants", icon: Building2, text: "Onboard merchants and their teams, issue integration keys, fund wallets" },
  { href: "/admin/refunds", label: "Refunds", icon: RotateCcw, text: "Approve, reject and settle refund requests" },
  { href: "/admin/reports", label: "Reports", icon: FileSpreadsheet, text: "Collections and disbursements, filtered and exportable" },
  { href: "/admin/users", label: "People", icon: Users, text: "Who can sign in, and what they may do" },
  { href: "/admin/approval-policies", label: "Approvals", icon: ShieldCheck, text: "Actions that need a second pair of eyes" },
];

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function settled(rows: ReportRow[]): number {
  return rows.filter((r) => statusTone(r.transactionStatus) === "success").reduce((sum, r) => sum + (r.amount ?? 0), 0);
}

/**
 * Platform view. It reads the admin report endpoints rather than /transactions:
 * that one needs tenant context and the gateway refuses it for staff sessions.
 */
export default function AdminOverviewPage() {
  const tenants = useTenants();
  const refunds = useAdminRefunds();
  const policies = useApprovalPolicies();
  const window = useMemo<ReportFilter>(
    () => ({ tenantId: undefined, fromDate: isoDaysAgo(REPORT_DAYS), toDate: undefined, status: undefined, currency: undefined }),
    [],
  );
  const collections = useReport("collections", window);
  const disbursements = useReport("disbursements", window);

  const collectionRows = useMemo<ReportRow[]>(() => collections.data ?? [], [collections.data]);
  const disbursementRows = useMemo<ReportRow[]>(() => disbursements.data ?? [], [disbursements.data]);
  const allRows = useMemo(() => [...collectionRows, ...disbursementRows], [collectionRows, disbursementRows]);
  const failed = allRows.filter((r) => statusTone(r.transactionStatus) === "failed").length;
  const waiting = (refunds.data ?? []).filter((r) => statusTone(r.status) === "pending").length;
  const loading = collections.isLoading || disbursements.isLoading;
  const error = collections.error ?? disbursements.error;

  return (
    <>
      <PageHeader title="Platform" description={`How Afrikob is running, over the last ${REPORT_DAYS} days`} />

      <BalanceStrip
        heroLabel={`Collected in ${REPORT_DAYS} days`}
        heroAmount={settled(collectionRows)}
        heroCurrency={collectionRows[0]?.currency ?? "GHS"}
        heroNote={`${formatMoney(settled(disbursementRows), disbursementRows[0]?.currency ?? "GHS")} disbursed · ${formatNumber(failed)} failed`}
        loading={loading}
        figures={[
          { label: "Tenants", value: formatNumber(tenants.data?.length) },
          { label: "Refunds waiting", value: formatNumber(waiting), tone: waiting > 0 ? "pending" : "default" },
          { label: "Approval rules", value: formatNumber(policies.data?.filter((p) => p.isEnabled).length) },
          { label: "Records", value: formatNumber(allRows.length) },
        ]}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader title="Collections by day" description={`Across the platform, last ${REPORT_DAYS} days`} />
          <PanelBody>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : error ? (
              <ErrorState
                error={error}
                onRetry={() => {
                  void collections.refetch();
                  void disbursements.refetch();
                }}
              />
            ) : (
              <VolumeChart items={collectionRows.map((r) => ({ date: r.dateCreated, amount: r.amount }))} />
            )}
          </PanelBody>
        </Panel>
        <nav aria-label="Shortcuts" className="grid gap-3">
          {shortcuts.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group flex items-start gap-3 rounded-[var(--radius-panel)] border border-line bg-paper p-4 transition hover:border-ink-faint"
            >
              <s.icon className="mt-0.5 size-5 shrink-0 text-ink-soft" aria-hidden />
              <span>
                <span className="block font-medium group-hover:text-accent">{s.label}</span>
                <span className="block text-sm text-ink-soft">{s.text}</span>
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
