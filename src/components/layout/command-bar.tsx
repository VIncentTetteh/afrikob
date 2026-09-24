"use client";

import { ChevronDown, LogOut, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "./logo";
import { ConfirmDialog } from "@/components/domain/feedback";
import { Button } from "@/components/ui/button";
import { DropdownContent, DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Skeleton } from "@/components/ui/panel";
import { useBalance } from "@/lib/api/hooks";
import { useLogout, type ClientSession } from "@/lib/api/session";
import { formatMoney } from "@/lib/format";
import { handlesMoney, type Environment } from "@/lib/session/types";
import { cn } from "@/lib/utils";
import { useUi } from "@/stores/ui";

function Balances() {
  const collection = useBalance("collection");
  const disbursement = useBalance("disbursement");
  const entries = [
    { label: "Collections", query: collection, tone: "text-in" },
    { label: "Payouts", query: disbursement, tone: "text-out" },
  ];
  return (
    <dl className="hidden items-center gap-5 xl:flex">
      {entries.map(({ label, query, tone }) => (
        <div key={label} className="flex items-baseline gap-2">
          <dt className="text-sm text-ink-soft">{label}</dt>
          {query.isLoading ? (
            <Skeleton className="h-4 w-20" />
          ) : (
            <dd className={cn("figure text-sm", tone)}>
              {formatMoney(query.data?.availableBalance ?? query.data?.totalBalance, query.data?.currency)}
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}

function EnvironmentSwitch({ session }: { session: ClientSession }) {
  const [target, setTarget] = useState<Environment | null>(null);
  const logout = useLogout();
  const router = useRouter();

  if (session.environments.length < 2) {
    return <span className="rounded-md bg-field px-2 py-1 text-xs font-medium capitalize text-ink-soft">{session.env}</span>;
  }
  return (
    <>
      <div role="group" aria-label="Environment" className="flex rounded-md bg-field p-0.5">
        {session.environments.map((env) => (
          <button
            key={env}
            aria-pressed={session.env === env}
            onClick={() => env !== session.env && setTarget(env)}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-medium capitalize transition",
              session.env === env ? "bg-paper text-ink shadow-sm" : "text-ink-soft hover:text-ink",
            )}
          >
            {env}
          </button>
        ))}
      </div>
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title={`Switch to ${target ?? ""}?`}
        description="Credentials are specific to an environment, so you'll sign in again."
        confirmLabel="Switch"
        loading={logout.isPending}
        onConfirm={() => logout.mutate(undefined, { onSettled: () => router.replace(`/signin?env=${target ?? "test"}`) })}
      />
    </>
  );
}

/** Top bar: identity, environment, balances and sign-out. */
export function CommandBar({ session }: { session: ClientSession }) {
  const theme = useUi((s) => s.theme);
  const toggleTheme = useUi((s) => s.toggleTheme);
  const logout = useLogout();
  const roleLabel =
    session.role === "platform"
      ? "Afrikob staff"
      : session.role === "tenant-admin"
        ? "Tenant admin"
        : session.tenantId
          ? `Tenant ${session.tenantId}`
          : "Merchant";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-paper px-4 sm:h-16 sm:px-6">
      <Logo className="lg:hidden" />
      {handlesMoney(session.mode) && <Balances />}
      <div className="ml-auto flex items-center gap-2">
        <EnvironmentSwitch session={session} />
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>
          {theme === "light" ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </Button>
        <DropdownMenu>
          <DropdownTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-field" aria-label="Account">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-wash text-sm font-semibold text-accent">
                {session.label.slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden min-w-0 sm:block">
                <span className="block max-w-40 truncate text-sm font-medium">{session.label}</span>
                <span className="block text-xs text-ink-soft">{roleLabel}</span>
              </span>
              <ChevronDown className="size-4 text-ink-faint" aria-hidden />
            </button>
          </DropdownTrigger>
          <DropdownContent>
            <DropdownLabel>{roleLabel}</DropdownLabel>
            <div className="px-3 pb-2 text-xs text-ink-soft">
              <p className="truncate">{session.label}</p>
              <p>
                {session.canMake && session.canCheck
                  ? "Can submit and approve"
                  : session.canCheck
                    ? "Can approve"
                    : "Can submit"}
              </p>
              <p>Session ends {new Date(session.exp * 1000).toLocaleTimeString()}</p>
            </div>
            <DropdownSeparator />
            <DropdownItem destructive onSelect={() => logout.mutate()}>
              <LogOut /> Sign out
            </DropdownItem>
          </DropdownContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
