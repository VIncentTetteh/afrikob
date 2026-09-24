"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { SearchCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { KeyValueList, recordToItems } from "@/components/domain/key-value-list";
import { PageHeader } from "@/components/domain/page-header";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { State } from "@/components/ui/state";
import { useStatusCheck } from "@/lib/api/hooks";
import { statusCheckSchema, type StatusCheck } from "@/lib/api/schemas/requests";

/** Asks the gateway where a single payment stands, using your own reference. */
export default function StatusCheckPage() {
  const check = useStatusCheck();
  const form = useForm<StatusCheck>({ resolver: zodResolver(statusCheckSchema), defaultValues: { clientTransactionId: "" } });
  const result = check.data;

  return (
    <>
      <PageHeader title="Status check" description="Look up where a payment stands, using your own reference" />
      <Panel>
        <PanelBody>
          <form onSubmit={form.handleSubmit((v) => check.mutate(v))} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
            <Field
              label="Your reference"
              htmlFor="sc-id"
              error={form.formState.errors.clientTransactionId?.message}
              className="flex-1"
              hint="The client transaction ID you sent with the payment."
            >
              <Input id="sc-id" placeholder="COL-..." {...form.register("clientTransactionId")} />
            </Field>
            <Button type="submit" loading={check.isPending}>
              {!check.isPending && <SearchCheck />} Check
            </Button>
          </form>
        </PanelBody>
      </Panel>
      {result && (
        <Panel>
          <PanelHeader
            title={result.accountName ?? form.getValues("clientTransactionId")}
            description={result.message ?? undefined}
            actions={<State status={result.isReversed ? "Reversed" : (result.message ?? "Found")} />}
          />
          <PanelBody>
            <KeyValueList items={recordToItems(result)} />
          </PanelBody>
        </Panel>
      )}
    </>
  );
}
