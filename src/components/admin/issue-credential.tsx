"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { RevealKeyDialog } from "./create-tenant-dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { useIssueCredential } from "@/lib/api/hooks";
import { issueCredentialSchema, type IssueCredential } from "@/lib/api/schemas/requests";

/**
 * Issues an API key. The secret only lives in component state for the reveal
 * dialog and is dropped when it closes.
 */
export function IssueCredentialPanel({ tenantId }: { tenantId: string }) {
  const issue = useIssueCredential();
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const form = useForm<IssueCredential>({ resolver: zodResolver(issueCredentialSchema), defaultValues: { name: "" } });

  const submit = form.handleSubmit((body) =>
    issue.mutate(
      { tenantId, body },
      {
        onSuccess: (credential) => {
          setIssuedKey(credential.apiKey ?? null);
          setAcknowledged(false);
          form.reset();
          issue.reset();
        },
      },
    ),
  );

  return (
    <Panel>
      <PanelHeader title="API keys" description="Issue a key for this tenant. Existing keys are not listed by the gateway." />
      <PanelBody>
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
          <Field
            label="What is this key for?"
            htmlFor="cred-name"
            error={form.formState.errors.name?.message}
            className="flex-1"
            hint="For example: production server, staging"
          >
            <Input id="cred-name" {...form.register("name")} />
          </Field>
          <Button type="submit" loading={issue.isPending}>
            {!issue.isPending && <KeyRound />} Issue key
          </Button>
        </form>
      </PanelBody>
      <RevealKeyDialog
        apiKey={issuedKey}
        acknowledged={acknowledged}
        onAcknowledge={setAcknowledged}
        onClose={() => setIssuedKey(null)}
      />
    </Panel>
  );
}
