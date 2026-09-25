"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, MailCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { useVerifyLoginCode } from "@/lib/api/session";
import type { Role } from "@/lib/session/types";
import { verifyCodeSchema, type VerifyCode } from "@/lib/api/schemas/requests";

/** The gateway rejects a stale pending sign-in with this status. */
const PENDING_EXPIRED_STATUS = 419;

interface Props {
  maskedEmail: string | null;
  onVerified: (role: Role) => void;
  onStartOver: () => void;
}

/** Step two of sign-in: nothing is signed in until this code checks out. */
export function VerifyStep({ maskedEmail, onVerified, onStartOver }: Props) {
  const verify = useVerifyLoginCode();
  const form = useForm<VerifyCode>({ resolver: zodResolver(verifyCodeSchema), defaultValues: { code: "" } });

  const submit = form.handleSubmit(({ code }) =>
    verify.mutate(code, {
      onSuccess: (session) => onVerified(session.role),
      onError: (error) => {
        if (error instanceof ApiError && error.status === PENDING_EXPIRED_STATUS) onStartOver();
      },
    }),
  );

  return (
    <>
      <span className="inline-flex size-10 items-center justify-center rounded-full bg-accent-wash text-accent">
        <MailCheck className="size-5" aria-hidden />
      </span>
      <h1 className="mt-4 font-display text-[2rem] leading-tight tracking-tight">Check your email</h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        We sent a one-time code to <span className="text-ink">{maskedEmail ?? "your email address"}</span>. Enter it to
        finish signing in.
      </p>

      {verify.isError && (
        <p role="alert" className="mt-5 rounded-lg border border-failed/30 bg-failed-wash px-3.5 py-2.5 text-sm text-failed">
          {errorMessage(verify.error)}
        </p>
      )}

      <form className="mt-6 space-y-4" noValidate onSubmit={submit}>
        <Field
          label="One-time code"
          htmlFor="login-code"
          error={form.formState.errors.code?.message}
          hint="The code expires in a few minutes."
        >
          <Input
            id="login-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="123456"
            className="h-11 text-center text-lg tracking-[0.4em]"
            {...form.register("code")}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={verify.isPending}>
          Verify and sign in {!verify.isPending && <ArrowRight />}
        </Button>
        <Button variant="ghost" className="w-full" onClick={onStartOver}>
          Use a different account
        </Button>
      </form>
    </>
  );
}
