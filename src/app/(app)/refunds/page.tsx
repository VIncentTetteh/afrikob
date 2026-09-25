"use client";

import { Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { EmptyState, ErrorState } from "@/components/domain/feedback";
import { KeyValueList, recordToItems } from "@/components/domain/key-value-list";
import { PageHeader } from "@/components/domain/page-header";
import { Button } from "@/components/ui/button";
import { Field, InlineAction, Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader, Skeleton } from "@/components/ui/panel";
import { State } from "@/components/ui/state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRefund, useTransactionRefunds } from "@/lib/api/hooks";
import type { Refund } from "@/lib/api/schemas/models";
import { formatDate, formatMoney } from "@/lib/format";

function RefundPanel({ refund }: { refund: Refund }) {
  return (
    <Panel>
      <PanelHeader
        title={<span className="figure">{formatMoney(refund.amount, refund.currency)}</span>}
        description={`Requested ${formatDate(refund.createdAt)}`}
        actions={<State status={refund.status} />}
      />
      <PanelBody>
        <KeyValueList items={recordToItems(refund)} />
      </PanelBody>
    </Panel>
  );
}

function Lookup({ id, label, placeholder, onSubmit }: { id: string; label: string; placeholder: string; onSubmit: (v: string) => void }) {
  const [value, setValue] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) onSubmit(value.trim());
  };
  return (
    <Panel>
      <PanelBody>
        <form onSubmit={submit}>
          <Field label={label} htmlFor={id}>
            <InlineAction
              action={
                <Button type="submit">
                  <Search /> Find
                </Button>
              }
            >
              <Input id={id} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} autoComplete="off" maxLength={64} />
            </InlineAction>
          </Field>
        </form>
      </PanelBody>
    </Panel>
  );
}

function ByTransaction() {
  const [txId, setTxId] = useState<string | null>(null);
  const q = useTransactionRefunds(txId);
  return (
    <div className="space-y-4">
      <Lookup id="lookup-tx" label="Transaction ID" placeholder="Paste the transaction ID" onSubmit={setTxId} />
      {q.isLoading && <Skeleton className="h-40 w-full rounded-[var(--radius-panel)]" />}
      {q.isError && (
        <Panel>
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        </Panel>
      )}
      {q.data?.length === 0 && (
        <Panel>
          <EmptyState title="No refunds on that transaction" description="Open a collection and request one from its record." />
        </Panel>
      )}
      {q.data?.map((r) => <RefundPanel key={r.id} refund={r} />)}
    </div>
  );
}

function ByRefund() {
  const [id, setId] = useState<string | null>(null);
  const q = useRefund(id);
  return (
    <div className="space-y-4">
      <Lookup id="lookup-refund" label="Refund ID" placeholder="Paste the refund ID" onSubmit={setId} />
      {q.isLoading && <Skeleton className="h-40 w-full rounded-[var(--radius-panel)]" />}
      {q.isError && (
        <Panel>
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        </Panel>
      )}
      {q.data && <RefundPanel refund={q.data} />}
    </div>
  );
}

export default function RefundsPage() {
  return (
    <>
      <PageHeader title="Refunds" description="Track a refund. Request new ones from a collection record." />
      <Tabs defaultValue="tx" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tx">By transaction</TabsTrigger>
          <TabsTrigger value="refund">By refund ID</TabsTrigger>
        </TabsList>
        <TabsContent value="tx">
          <ByTransaction />
        </TabsContent>
        <TabsContent value="refund">
          <ByRefund />
        </TabsContent>
      </Tabs>
    </>
  );
}
