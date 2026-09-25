"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import { KeyRound, MoreHorizontal, Pencil, Plus, UserCheck, UserX } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm, type Control, type FieldValues, type Path } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/domain/feedback";
import { Ledger } from "@/components/ledger/ledger";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DropdownContent, DropdownItem, DropdownMenu, DropdownTrigger } from "@/components/ui/dropdown";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Sheet } from "@/components/ui/sheet";
import { State } from "@/components/ui/state";
import { usePortalUser, usePortalUsers, useTenantAdminUsers, useTenantAdminUserMutations, useTenants, useUserMutations } from "@/lib/api/hooks";
import type { PortalUser } from "@/lib/api/schemas/models";
import {
  adminSetPasswordSchema,
  createPortalUserSchema,
  createTenantScopedUserSchema,
  NOTIFICATION_CHANNELS,
  USER_TYPES,
  personEditFormSchema,
  personFormSchema,
  updatePortalUserSchema,
  updateTenantScopedUserSchema,
  type AdminSetPassword,
  type PersonEditForm,
  type PersonEditFormInput,
  type PersonForm,
  type PersonFormInput,
} from "@/lib/api/schemas/requests";
import { display, formatDate } from "@/lib/format";

/** A person belongs to Afrikob or to a tenant; the gateway accepts nothing else. */
const USER_TYPE_LABELS: Record<(typeof USER_TYPES)[number], string> = {
  Platform: "Afrikob staff",
  Tenant: "Belongs to a tenant",
};

export type PeopleScope = "platform" | "tenant-admin";

interface Props {
  scope: PeopleScope;
  /** Platform only: pre-fills and locks the tenant on the create form. */
  tenantId?: string;
  /** Off when the page title already says "People". */
  showHeading?: boolean;
}

/** A checkbox bound to react-hook-form, for the permission flags. */
function FlagField<T extends FieldValues>({ control, name, label }: { control: Control<T>; name: Path<T>; label: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Checkbox label={label} checked={Boolean(field.value)} onChange={(e) => field.onChange(e.target.checked)} />
      )}
    />
  );
}

/**
 * Who can sign in and what they may do. Afrikob staff manage everyone;
 * a tenant's admin manages only their own people, so the same screen runs
 * against whichever endpoints the scope names.
 */
export function PeoplePanel({ scope, tenantId, showHeading = true }: Props) {
  const isPlatform = scope === "platform";
  // Both hooks must be called, but only the scope in play may reach the gateway:
  // the other endpoint would answer 403 for this session.
  const platformUsers = usePortalUsers(tenantId, undefined, isPlatform);
  const tenantUsers = useTenantAdminUsers(!isPlatform);
  const users = isPlatform ? platformUsers : tenantUsers;
  // Staff choose the tenant from the list rather than typing an id.
  const tenants = useTenants(isPlatform && !tenantId);
  const platformMutations = useUserMutations();
  const tenantMutations = useTenantAdminUserMutations();
  const { create, update, activate, deactivate, setPassword } = isPlatform ? platformMutations : tenantMutations;

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PortalUser | null>(null);
  const [deactivating, setDeactivating] = useState<PortalUser | null>(null);
  const [resetting, setResetting] = useState<PortalUser | null>(null);

  const createForm = useForm<PersonFormInput, unknown, PersonForm>({
    resolver: zodResolver(personFormSchema),
    defaultValues: {
      email: "",
      displayName: "",
      userType: tenantId ? "Tenant" : "Platform",
      tenantId: tenantId ?? "",
      password: "",
      canMake: true,
      canCheck: false,
      isTenantAdmin: false,
      isPlatformAdmin: false,
      phoneNumber: "",
      preferredNotificationChannel: "Email",
    },
  });
  // Edit what the gateway holds now, not the row loaded with the list.
  const freshPerson = usePortalUser(scope, editing?.id ?? null);
  const current = freshPerson.data ?? editing;
  const editForm = useForm<PersonEditFormInput, unknown, PersonEditForm>({
    resolver: zodResolver(personEditFormSchema),
    values: {
      displayName: current?.displayName ?? "",
      canMake: current?.canMake ?? true,
      canCheck: current?.canCheck ?? false,
      isTenantAdmin: current?.isTenantAdmin ?? false,
      isPlatformAdmin: current?.isPlatformAdmin ?? false,
      phoneNumber: current?.phoneNumber ?? "",
      preferredNotificationChannel: (current?.preferredNotificationChannel as "Email" | "SMS") ?? "Email",
    },
  });
  const passwordForm = useForm<AdminSetPassword>({ resolver: zodResolver(adminSetPasswordSchema), defaultValues: { newPassword: "" } });

  const columns = useMemo<ColumnDef<PortalUser, unknown>[]>(() => {
    const base: ColumnDef<PortalUser, unknown>[] = [
      {
        id: "displayName",
        header: "Name",
        accessorFn: (u) => `${u.displayName ?? ""} ${u.email ?? ""}`,
        cell: ({ row }) => (
          <span className="block max-w-56 truncate">
            {row.original.displayName ?? "Unnamed"}
            <span className="block text-xs text-ink-soft">{row.original.email}</span>
          </span>
        ),
      },
      {
        id: "permissions",
        header: "Can do",
        accessorFn: (u) => `${u.canMake ? "submit" : ""} ${u.canCheck ? "approve" : ""}`,
        cell: ({ row }) =>
          [row.original.canMake && "Submit", row.original.canCheck && "Approve"].filter(Boolean).join(" and ") || "Read only",
      },
      {
        id: "isTenantAdmin",
        header: "Tenant admin",
        accessorFn: (u) => (u.isTenantAdmin ? "yes" : "no"),
        cell: ({ row }) => (row.original.isTenantAdmin ? "Yes" : "No"),
      },
      {
        id: "isActive",
        header: "State",
        accessorFn: (u) => (u.isActive ? "active" : "inactive"),
        cell: ({ row }) => <State status={row.original.isActive ? "Active" : "Deactivated"} />,
      },
      { id: "phoneNumber", header: "Phone", accessorFn: (u) => u.phoneNumber ?? "", cell: ({ getValue }) => display(getValue()) },
      {
        id: "preferredNotificationChannel",
        header: "Notify by",
        accessorFn: (u) => u.preferredNotificationChannel ?? "",
        cell: ({ getValue }) => display(getValue()),
      },
      {
        id: "lastLoginAt",
        header: "Last signed in",
        accessorFn: (u) => u.lastLoginAt ?? "",
        cell: ({ row }) => (row.original.lastLoginAt ? formatDate(row.original.lastLoginAt) : "Never"),
      },
      { id: "createdAt", header: "Added", accessorFn: (u) => u.createdAt ?? "", cell: ({ row }) => formatDate(row.original.createdAt) },
    ];

    if (isPlatform) {
      base.splice(
        1,
        0,
        {
          id: "userType",
          header: "Belongs to",
          accessorFn: (u) => u.userType ?? "",
          cell: ({ getValue }) => (getValue() === "Platform" ? "Afrikob" : display(getValue())),
        },
        {
          id: "tenantId",
          header: "Tenant",
          accessorFn: (u) => u.tenantId ?? "",
          cell: ({ getValue }) => display(getValue() || "Platform"),
        },
      );
    }

    base.push({
      id: "actions",
      header: "",
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="User actions">
                <MoreHorizontal />
              </Button>
            </DropdownTrigger>
            <DropdownContent>
              <DropdownItem onSelect={() => setEditing(row.original)}>
                <Pencil /> Edit
              </DropdownItem>
              <DropdownItem onSelect={() => setResetting(row.original)}>
                <KeyRound /> Set password
              </DropdownItem>
              {row.original.isActive ? (
                <DropdownItem destructive onSelect={() => setDeactivating(row.original)}>
                  <UserX /> Deactivate
                </DropdownItem>
              ) : (
                <DropdownItem onSelect={() => activate.mutate(row.original.id, { onSuccess: () => toast.success("User reactivated") })}>
                  <UserCheck /> Reactivate
                </DropdownItem>
              )}
            </DropdownContent>
          </DropdownMenu>
        </div>
      ),
    });
    return base;
  }, [activate, isPlatform]);

  const channelField = (form: { register: (name: "preferredNotificationChannel") => object }, id: string) => (
    <Field label="Notify by" htmlFor={id}>
      <Select id={id} {...form.register("preferredNotificationChannel")}>
        {NOTIFICATION_CHANNELS.map((channel) => (
          <option key={channel} value={channel}>
            {channel}
          </option>
        ))}
      </Select>
    </Field>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        {showHeading && <h2 className="text-lg font-semibold">People</h2>}
        <Button className="ml-auto" onClick={() => setCreateOpen(true)}>
          <Plus /> Add person
        </Button>
      </div>

      <Ledger
        tableId={`people-${scope}`}
        columns={columns}
        data={users.data ?? []}
        loading={users.isLoading}
        error={users.error}
        onRetry={() => users.refetch()}
        getRowId={(u, i) => u.id || String(i)}
        emptyTitle="No one can sign in yet"
        emptyDescription="Add a person so they can sign in with an email and password."
        searchPlaceholder="Search by name, email or role"
      />

      <Sheet
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) createForm.reset();
          setCreateOpen(open);
        }}
        title="Add a person"
        description="They sign in with an email and password."
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={create.isPending}
              onClick={createForm.handleSubmit((values) => {
                // The scope decides the payload: Zod drops the fields it omits.
                const body = isPlatform
                  ? createPortalUserSchema.parse(values)
                  : createTenantScopedUserSchema.parse(values);
                (create.mutate as (input: unknown, options: { onSuccess: () => void }) => void)(body, {
                  onSuccess: () => {
                    toast.success("Person added");
                    setCreateOpen(false);
                    createForm.reset();
                  },
                });
              })}
            >
              Add person
            </Button>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <Field label="Name" htmlFor="p-name" error={createForm.formState.errors.displayName?.message}>
            <Input id="p-name" autoComplete="off" maxLength={100} aria-invalid={Boolean(createForm.formState.errors.displayName) || undefined} {...createForm.register("displayName")} />
          </Field>
          <Field label="Email" htmlFor="p-email" error={createForm.formState.errors.email?.message}>
            <Input
              id="p-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={254}
              aria-invalid={Boolean(createForm.formState.errors.email) || undefined}
              {...createForm.register("email")}
            />
          </Field>
          {/* On a tenant's own page the tenant is fixed, and travels in defaultValues:
              a disabled field would be dropped from the submitted values. */}
          {isPlatform && !tenantId && (
            <>
              <Field label="Belongs to" htmlFor="p-type">
                <Select id="p-type" {...createForm.register("userType")}>
                  {USER_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {USER_TYPE_LABELS[type]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Tenant"
                htmlFor="p-tenant"
                error={createForm.formState.errors.tenantId?.message}
                hint="Required when they belong to a tenant"
              >
                <Select
                  id="p-tenant"
                  disabled={createForm.watch("userType") !== "Tenant"}
                  aria-invalid={Boolean(createForm.formState.errors.tenantId) || undefined}
                  {...createForm.register("tenantId")}
                >
                  <option value="">{tenants.isLoading ? "Loading tenants…" : "Choose a tenant"}</option>
                  {(tenants.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.displayName ?? t.code ?? t.id}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          )}
          <Field label="Phone" htmlFor="p-phone" error={createForm.formState.errors.phoneNumber?.message} hint="Optional, unless notified by SMS">
            <Controller
              control={createForm.control}
              name="phoneNumber"
              render={({ field, fieldState }) => (
                <PhoneInput id="p-phone" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} invalid={Boolean(fieldState.error)} />
              )}
            />
          </Field>
          {channelField(createForm, "p-channel")}
          <Field
            label="Temporary password"
            htmlFor="p-password"
            error={createForm.formState.errors.password?.message}
            className="sm:col-span-2"
            hint="At least 8 characters with a letter and a number. Share it securely; they can change it from the sign-in page."
          >
            <Input id="p-password" type="text" autoComplete="new-password" spellCheck={false} maxLength={128} {...createForm.register("password")} />
          </Field>
          <div className="space-y-2 sm:col-span-2">
            <FlagField control={createForm.control} name="canMake" label="Can submit actions" />
            <FlagField control={createForm.control} name="canCheck" label="Can approve what others submit" />
            <FlagField control={createForm.control} name="isTenantAdmin" label="Can administer the tenant" />
            {isPlatform && <FlagField control={createForm.control} name="isPlatformAdmin" label="Afrikob platform administrator" />}
          </div>
        </form>
      </Sheet>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="Edit person"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              loading={update.isPending}
              onClick={editForm.handleSubmit((values) => {
                if (!editing) return;
                const body = isPlatform ? updatePortalUserSchema.parse(values) : updateTenantScopedUserSchema.parse(values);
                (update.mutate as (input: unknown, options: { onSuccess: () => void }) => void)(
                      { id: editing.id, body },
                      {
                        onSuccess: () => {
                          toast.success("Changes saved");
                          setEditing(null);
                        },
                      },
                    );
              })}
            >
              Save changes
            </Button>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <Field label="Name" htmlFor="pe-name" error={editForm.formState.errors.displayName?.message}>
            <Input id="pe-name" autoComplete="off" maxLength={100} {...editForm.register("displayName")} />
          </Field>
          <Field label="Phone" htmlFor="pe-phone" error={editForm.formState.errors.phoneNumber?.message}>
            <Controller
              control={editForm.control}
              name="phoneNumber"
              render={({ field, fieldState }) => (
                <PhoneInput id="pe-phone" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} invalid={Boolean(fieldState.error)} />
              )}
            />
          </Field>
          {channelField(editForm, "pe-channel")}
          <div className="space-y-2 sm:col-span-2">
            <FlagField control={editForm.control} name="canMake" label="Can submit actions" />
            <FlagField control={editForm.control} name="canCheck" label="Can approve what others submit" />
            <FlagField control={editForm.control} name="isTenantAdmin" label="Can administer the tenant" />
            {isPlatform && <FlagField control={editForm.control} name="isPlatformAdmin" label="Afrikob platform administrator" />}
          </div>
        </form>
      </Dialog>

      <Dialog
        open={resetting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setResetting(null);
            passwordForm.reset();
          }
        }}
        title="Set a password"
        description={resetting?.email ?? undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setResetting(null)}>
              Cancel
            </Button>
            <Button
              loading={setPassword.isPending}
              onClick={passwordForm.handleSubmit((body) =>
                resetting
                  ? setPassword.mutate(
                      { id: resetting.id, body },
                      {
                        onSuccess: () => {
                          toast.success("Password set");
                          setResetting(null);
                          passwordForm.reset();
                        },
                      },
                    )
                  : undefined,
              )}
            >
              Set password
            </Button>
          </>
        }
      >
        <Field
          label="New password"
          htmlFor="p-newpassword"
          error={passwordForm.formState.errors.newPassword?.message}
          hint="At least 8 characters with a letter and a number. Share it securely and ask them to change it."
        >
          <Input id="p-newpassword" type="text" autoComplete="new-password" spellCheck={false} maxLength={128} {...passwordForm.register("newPassword")} />
        </Field>
      </Dialog>

      <ConfirmDialog
        open={deactivating !== null}
        onOpenChange={(open) => !open && setDeactivating(null)}
        title="Deactivate this person?"
        description={<>{deactivating?.displayName ?? deactivating?.email} will not be able to sign in. You can reactivate them later.</>}
        confirmLabel="Deactivate"
        tone="danger"
        loading={deactivate.isPending}
        onConfirm={() =>
          deactivating &&
          deactivate.mutate(deactivating.id, {
            onSuccess: () => toast.success("Person deactivated"),
            onSettled: () => setDeactivating(null),
          })
        }
      />
    </div>
  );
}
