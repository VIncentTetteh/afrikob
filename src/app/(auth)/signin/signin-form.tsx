"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, KeyRound, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api/errors";
import { isPendingLogin, useLogin, type LoginInput } from "@/lib/api/session";
import { apiKeyLoginSchema, portalLoginSchema, type ApiKeyLogin, type PortalLogin } from "@/lib/api/schemas/requests";
import { homeFor, safeNextPath, type AuthMode, type Environment, type Role } from "@/lib/session/types";
import { VerifyStep } from "./verify-step";
import { cn } from "@/lib/utils";

const REASONS: Record<string, string> = {
  expired: "Your session ended. Sign in to pick up where you left off.",
  "password-reset": "Password updated. Sign in with your new one.",
};

type Method = "portal" | "apikey";

/** Staff sign-in pauses here until the emailed code is verified. */
interface AwaitingCode {
  maskedEmail: string | null;
}

const METHODS: { value: Method; label: string; hint: string }[] = [
  { value: "portal", label: "Afrikob staff", hint: "Email and password" },
  { value: "apikey", label: "Merchant", hint: "API key" },
];

export function SignInForm({ environments }: { environments: Environment[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const login = useLogin();
  const [method, setMethod] = useState<Method>("portal");
  const [reveal, setReveal] = useState(false);
  const [awaitingCode, setAwaitingCode] = useState<AwaitingCode | null>(null);

  const requested = params.get("env") as Environment | null;
  const [env, setEnv] = useState<Environment>(
    requested && environments.includes(requested) ? requested : (environments[0] ?? "test"),
  );
  const notice = REASONS[params.get("reason") ?? ""];

  const portalForm = useForm<PortalLogin>({ resolver: zodResolver(portalLoginSchema), defaultValues: { email: "", password: "" } });
  const keyForm = useForm<ApiKeyLogin>({ resolver: zodResolver(apiKeyLoginSchema), defaultValues: { apiKey: "" } });

  // "Sign in to pick up where you left off" is a promise: middleware parks the
  // page they were denied in ?next=, and this returns them to it.
  const goOn = (role: Role, mode: AuthMode) => {
    const back = safeNextPath(params.get("next"));
    router.replace(back ?? homeFor(role, mode));
    router.refresh();
  };

  const submit = (values: LoginInput) =>
    login.mutate(values, {
      onSuccess: (result) => {
        // A password alone never signs anyone in: the gateway emails a code first.
        if (isPendingLogin(result)) setAwaitingCode({ maskedEmail: result.maskedEmail });
        else goOn(result.role, method);
      },
    });

  const startOver = () => {
    setAwaitingCode(null);
    login.reset();
    portalForm.reset();
  };

  const choose = (next: Method) => {
    setMethod(next);
    login.reset();
  };

  const error = login.isError ? errorMessage(login.error) : null;

  if (awaitingCode) {
    return <VerifyStep maskedEmail={awaitingCode.maskedEmail} onVerified={(role: Role) => goOn(role, "portal")} onStartOver={startOver} />;
  }

  return (
    <>
      <h1 className="font-display text-[2rem] leading-tight tracking-tight">Sign in</h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        {method === "portal"
          ? "For the Afrikob team running the platform."
          : "For merchants using their gateway API key."}
      </p>

      {notice && (
        <p role="status" className="mt-5 rounded-lg border border-line bg-field px-3.5 py-2.5 text-sm">
          {notice}
        </p>
      )}

      <div role="tablist" aria-label="Who is signing in" className="mt-7 grid grid-cols-2 gap-2">
        {METHODS.map((option) => {
          const selected = method === option.value;
          return (
            <button
              key={option.value}
              role="tab"
              aria-selected={selected}
              onClick={() => choose(option.value)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left transition",
                selected ? "border-accent bg-accent-wash" : "border-line bg-paper hover:border-line-strong",
              )}
            >
              <span className={cn("block text-sm font-medium", selected && "text-accent")}>{option.label}</span>
              <span className="block text-xs text-ink-soft">{option.hint}</span>
            </button>
          );
        })}
      </div>

      {environments.length > 1 && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-line bg-paper px-3.5 py-2.5">
          <span className="text-sm text-ink-soft">Environment</span>
          <div role="radiogroup" aria-label="Environment" className="flex rounded-lg bg-field p-0.5">
            {environments.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={env === option}
                onClick={() => setEnv(option)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm capitalize transition",
                  env === option ? "bg-paper text-ink shadow-sm" : "text-ink-soft hover:text-ink",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-failed/30 bg-failed-wash px-3.5 py-2.5 text-sm text-failed">
          {error}
        </p>
      )}

      {method === "portal" ? (
        <form className="mt-5 space-y-4" noValidate onSubmit={portalForm.handleSubmit((values) => submit({ env, ...values }))}>
          <Field label="Email" htmlFor="email" error={portalForm.formState.errors.email?.message}>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="you@afrikob.com"
                className="h-11 pl-9"
                {...portalForm.register("email")}
              />
            </div>
          </Field>
          <Field label="Password" htmlFor="password" error={portalForm.formState.errors.password?.message}>
            <div className="relative">
              <Input
                id="password"
                type={reveal ? "text" : "password"}
                autoComplete="current-password"
                className="h-11 pr-11"
                {...portalForm.register("password")}
              />
              <button
                type="button"
                onClick={() => setReveal((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-soft hover:bg-field"
                aria-label={reveal ? "Hide password" : "Show password"}
              >
                {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
            Sign in {!login.isPending && <ArrowRight />}
          </Button>
          <Link
            href={`/forgot-password?env=${env}`}
            className="block text-center text-sm text-ink-soft underline-offset-4 hover:text-accent hover:underline"
          >
            Forgot your password?
          </Link>
        </form>
      ) : (
        <form className="mt-5 space-y-4" noValidate onSubmit={keyForm.handleSubmit((values) => submit({ env, ...values }))}>
          <Field
            label="API key"
            htmlFor="apiKey"
            error={keyForm.formState.errors.apiKey?.message}
            hint="Exchanged for a short session on our server. It is never stored in your browser."
          >
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
              <Input
                id="apiKey"
                type={reveal ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                placeholder="afk_live_..."
                className="h-11 pl-9 pr-11"
                {...keyForm.register("apiKey")}
              />
              <button
                type="button"
                onClick={() => setReveal((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-soft hover:bg-field"
                aria-label={reveal ? "Hide API key" : "Show API key"}
              >
                {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
            Sign in {!login.isPending && <ArrowRight />}
          </Button>
          <p className="text-center text-sm text-ink-soft">
            No key yet? Your Afrikob administrator issues one from the tenant record.
          </p>
        </form>
      )}
    </>
  );
}
