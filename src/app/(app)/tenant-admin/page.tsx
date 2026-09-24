"use client";

import { BadgeCheck, PlusCircle, RefreshCw } from "lucide-react";
import { useState } from "react";
import { TopUpRequestSheet } from "./topup-request";
import { BalanceStrip } from "@/components/domain/balance-strip";
import { ErrorState } from "@/components/domain/feedback";
import { KeyValueList } from "@/components/domain/key-value-list";
import { PageHeader } from "@/components/domain/page-header";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader, Skeleton } from "@/components/ui/panel";
import { State } from "@/components/ui/state";
import { useTenantDetail } from "@/lib/api/hooks";
import type { TenantWallet } from "@/lib/api/schemas/models";
import { useSession } from "@/lib/api/session";
import { display, formatMoney, formatNumber, humanize } from "@/lib/format";

function walletLabel(wallet: TenantWallet, index: number): string {
  return wallet.walletType ? humanize(wallet.walletType) : `Wallet ${index + 1}`;
}

/** A tenant's own view of itself: what it may do, and what it holds. */
export default function TenantAdminPage() {
  const tenant = useTenantDetail();
  const { data: session } = useSession();
  const [requesting, setRequesting] = useState(false);
  const detail = tenant.data;
  const wallets = detail?.wallets ?? [];
  const primary = wallets[0];

  return (
    <>
      <PageHeader
        title={detail?.displayName ?? "Your business"}
        description={detail?.legalName ?? "Limits, wallets and how money may move"}
        actions={
          <>
            <Button variant="outline" onClick={() => tenant.refetch()} loading={tenant.isRefetching}>
              {!tenant.isRefetching && <RefreshCw />} Refresh
            </Button>
            {session?.canMake && (
              <Button onClick={() => setRequesting(true)}>
                <PlusCircle /> Request funds
              </Button>
            )}
          </>
        }
      />

      {tenant.isError ? (
        <Panel>
          <ErrorState error={tenant.error} onRetry={() => tenant.refetch()} />
        </Panel>
      ) : (
        <BalanceStrip
          heroLabel={primary ? `${walletLabel(primary, 0)} available` : "Available"}
          heroAmount={primary?.availableBalance ?? null}
          heroCurrency={primary?.currency ?? detail?.currency}
          heroNote={
            primary?.reservedBalance
              ? `${formatMoney(primary.reservedBalance, primary.currency)} reserved for payments in flight`
              : "What you can spend right now"
          }
          loading={tenant.isLoading}
          figures={
            wallets.length > 1
              ? wallets.slice(1).map((wallet, index) => ({
                  label: `${walletLabel(wallet, index + 1)} available`,
                  value: formatMoney(wallet.availableBalance, wallet.currency),
                }))
              : [
                  { label: "Reserved", value: formatMoney(primary?.reservedBalance, primary?.currency), tone: "pending" as const },
                  { label: "Total", value: formatMoney(primary?.totalBalance, primary?.currency) },
                ]
          }
        />
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Your limits"
            description="Set by Afrikob"
            actions={detail && <State status={detail.status ?? "Active"} />}
          />
          <PanelBody>
            {tenant.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <KeyValueList
                items={[
                  { label: "Code", value: display(detail?.code) },
                  { label: "Currency", value: display(detail?.currency) },
                  {
                    label: "Daily limit",
                    value: detail?.dailyLimit == null ? "No limit" : formatMoney(detail.dailyLimit, detail.currency),
                  },
                  {
                    label: "Per payment",
                    value:
                      detail?.perTransactionLimit == null
                        ? "No limit"
                        : formatMoney(detail.perTransactionLimit, detail.currency),
                  },
                  { label: "Requests per minute", value: formatNumber(detail?.requestsPerMinute) },
                  {
                    label: "Name checks",
                    value: detail?.requireNameVerification ? (
                      <span className="inline-flex items-center gap-1.5 text-settled">
                        <BadgeCheck className="size-4" aria-hidden /> Required before a payout
                      </span>
                    ) : (
                      "Optional"
                    ),
                  },
                ]}
              />
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Wallets" description="Each wallet and what it holds" />
          <PanelBody>
            {tenant.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : wallets.length === 0 ? (
              <p className="text-sm text-ink-soft">No wallets yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {wallets.map((wallet, index) => (
                  <li key={`${wallet.walletType ?? index}`} className="flex items-baseline justify-between gap-4 py-3">
                    <span>
                      <span className="block text-sm font-medium">{walletLabel(wallet, index)}</span>
                      <span className="block text-xs text-ink-soft">
                        {formatMoney(wallet.reservedBalance, wallet.currency)} reserved ·{" "}
                        {formatMoney(wallet.totalBalance, wallet.currency)} total
                      </span>
                    </span>
                    <span className="figure text-lg">{formatMoney(wallet.availableBalance, wallet.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </PanelBody>
        </Panel>
      </div>

      <TopUpRequestSheet
        open={requesting}
        onOpenChange={setRequesting}
        currency={detail?.currency ?? "GHS"}
        walletTypes={wallets.map((w) => w.walletType).filter((t): t is string => Boolean(t))}
      />
    </>
  );
}
