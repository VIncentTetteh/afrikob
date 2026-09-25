"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { useUserMutations } from "@/lib/api/hooks";
import { createPortalUserSchema, type CreatePortalUser } from "@/lib/api/schemas/requests";

const firstAdminSchema = createPortalUserSchema.pick({ email: true, displayName: true, password: true });
type FirstAdminInput = { email: string; displayName: string; password: string };

/** The fixed part of a tenant's first administrator: they run the tenant and may submit and approve. */
export function firstAdminBody(tenantId: string, values: FirstAdminInput): CreatePortalUser {
  return createPortalUserSchema.parse({
    ...values,
    userType: "Tenant",
    tenantId,
    canMake: true,
    canCheck: true,
    isTenantAdmin: true,
    isPlatformAdmin: false,
    preferredNotificationChannel: "Email",
  });
}

/**
 * Right after a tenant is created: the person who will sign in for them. Without
 * this the tenant exists but nobody on their side can reach their portal; the
 * API key alone only serves their integration.
 */
export function FirstAdminSheet({
  tenantId,
  tenantName,
  onClose,
}: {
  tenantId: string | null;
  tenantName?: string;
  onClose: () => void;
}) {
  const { create } = useUserMutations();
  const form = useForm<FirstAdminInput>({
    resolver: zodResolver(firstAdminSchema),
    defaultValues: { email: "", displayName: "", password: "" },
  });
  const e = form.formState.errors;

  const close = () => {
    form.reset();
    create.reset();
    onClose();
  };

  const submit = form.handleSubmit((values) => {
    if (!tenantId) return;
    create.mutate(firstAdminBody(tenantId, values), {
      onSuccess: () => {
        toast.success("Administrator added. They can sign in now.");
        close();
      },
    });
  });

  return (
    <Sheet
      open={tenantId !== null}
      onOpenChange={(o) => {
        if (!o) close();
      }}
      title="Add their first administrator"
      description={`The person who signs in for ${tenantName || "this tenant"} and adds the rest of their team.`}
      footer={
        <>
          <Button variant="outline" onClick={close}>
            Later
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            Add administrator
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Name" htmlFor="fa-name" error={e.displayName?.message}>
          <Input id="fa-name" autoComplete="off" maxLength={100} {...form.register("displayName")} />
        </Field>
        <Field label="Email" htmlFor="fa-email" error={e.email?.message}>
          <Input id="fa-email" type="email" autoComplete="off" inputMode="email" autoCapitalize="none" spellCheck={false} maxLength={254} {...form.register("email")} />
        </Field>
        <Field
          label="Temporary password"
          htmlFor="fa-password"
          error={e.password?.message}
          className="sm:col-span-2"
          hint="At least 8 characters with a letter and a number. Share it securely; they confirm each sign-in with a code sent to this email."
        >
          <Input id="fa-password" type="text" autoComplete="new-password" spellCheck={false} maxLength={128} {...form.register("password")} />
        </Field>
      </form>
    </Sheet>
  );
}
