"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api/errors";
import { isPendingLogin, useLogin } from "@/lib/api/session";
import { portalLoginSchema, type PortalLogin } from "@/lib/api/schemas/requests";
import { homeFor, safeNextPath, type Environment, type Role } from "@/lib/session/types";
import { VerifyStep } from "./verify-step";
import { cn } from "@/lib/utils";

const REASONS: Record<string, string> = {
  expired: "Your session ended. Sign in to pick up where you left off.",
  "password-reset": "Password updated. Sign in with your new one.",
};

/** Sign-in pauses here until the emailed code is verified. */
interface AwaitingCode {
  maskedEmail: string | null;
}

/**
 * One way in for everyone: Afrikob staff, tenant administrators and tenant users
 * all sign in with email, password and an emailed code. API keys are for a
 * tenant's own systems calling the gateway, and never open this portal.
 */
export function SignInForm({ environments }: { environments: Environment[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const login = useLogin();
  const [reveal, setReveal] = useState(false);
  const [awaitingCode, setAwaitingCode] = useState<AwaitingCode | null>(null);

  const requested = params.get("env") as Environment | null;
  const [env, setEnv] = useState<Environment>(
    requested && environments.includes(requested) ? requested : (environments[0] ?? "test"),
  );
  const notice = REASONS[params.get("reason") ?? ""];

  const form = useForm<PortalLogin>({ resolver: zodResolver(portalLoginSchema), defaultValues: { email: "", password: "" } });

  // "Sign in to pick up where you left off" is a promise: middleware parks the
  // page they were denied in ?next=, and this returns them to it.
  const goOn = (role: Role) => {
    const back = safeNextPath(params.get("next"));
    router.replace(back ?? homeFor(role));
    router.refresh();
  };

  const submit = (values: PortalLogin) =>
    login.mutate(
      { env, ...values },
      {
        onSuccess: (result) => {
          // A password alone never signs anyone in: the gateway emails a code first.
          if (isPendingLogin(result)) setAwaitingCode({ maskedEmail: result.maskedEmail });
          else goOn(result.role);
        },
      },
    );

  const startOver = () => {
    setAwaitingCode(null);
    login.reset();
    form.reset();
  };

  const error = login.isError ? errorMessage(login.error) : null;

  if (awaitingCode) {
    return <VerifyStep maskedEmail={awaitingCode.maskedEmail} onVerified={goOn} onStartOver={startOver} />;
  }

  return (
    <>
      <h1 className="font-display text-[2rem] leading-tight tracking-tight">Sign in</h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        With the email and password your Afrikob or company administrator set up for you.
      </p>

      {notice && (
        <p role="status" className="mt-5 rounded-lg border border-line bg-field px-3.5 py-2.5 text-sm">
          {notice}
        </p>
      )}

      {environments.length > 1 && (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-line bg-paper px-3.5 py-2.5">
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

      <form className="mt-5 space-y-4" noValidate onSubmit={form.handleSubmit(submit)}>
        <Field label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
            <Input
              id="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={254}
              placeholder="you@company.com"
              className="h-11 pl-9"
              {...form.register("email")}
            />
          </div>
        </Field>
        <Field label="Password" htmlFor="password" error={form.formState.errors.password?.message}>
          <div className="relative">
            <Input
              id="password"
              type={reveal ? "text" : "password"}
              autoComplete="current-password"
              className="h-11 pr-11"
              {...form.register("password")}
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
      <p className="mt-6 border-t border-line pt-4 text-center text-xs leading-relaxed text-ink-soft">
        Integrating the gateway into your own systems? Your API key is used there, not here. After signing in, see
        Developers for how to connect.
      </p>
    </>
  );
}
