"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api/errors";
import { usePasswordReset } from "@/lib/api/session";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyCodeSchema,
  type ForgotPassword,
  type ResetPassword,
  type VerifyCode,
} from "@/lib/api/schemas/requests";
import type { Environment } from "@/lib/session/types";

type Step = "email" | "code" | "password";

/** forgot-password → verify-code → reset-password, one step at a time. */
export function ResetFlow({ environments }: { environments: Environment[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const reset = usePasswordReset();
  const requested = params.get("env") as Environment | null;
  const env = requested && environments.includes(requested) ? requested : (environments[0] ?? "test");

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  const emailForm = useForm<ForgotPassword>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });
  const codeForm = useForm<VerifyCode>({ resolver: zodResolver(verifyCodeSchema), defaultValues: { code: "" } });
  const passwordForm = useForm<ResetPassword>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const sendCode = emailForm.handleSubmit((values) =>
    reset.mutate(
      { step: "forgot", env, email: values.email },
      {
        onSuccess: (result) => {
          const masked = (result.data as { maskedEmail?: string } | undefined)?.maskedEmail;
          setEmail(values.email);
          setSentTo(masked ?? values.email);
          setStep("code");
        },
      },
    ),
  );

  const checkCode = codeForm.handleSubmit((values) =>
    reset.mutate(
      { step: "verify", env, email, code: values.code },
      {
        onSuccess: (result) => {
          const valid = (result.data as { valid?: boolean } | undefined)?.valid;
          if (valid === false) {
            codeForm.setError("code", { message: "That code is not valid. Check your email or send a new one." });
            return;
          }
          setCode(values.code);
          setStep("password");
        },
      },
    ),
  );

  const setPassword = passwordForm.handleSubmit((values) =>
    reset.mutate(
      { step: "reset", env, email, code, newPassword: values.newPassword, confirmPassword: values.confirmPassword },
      { onSuccess: () => router.replace("/signin?reason=password-reset") },
    ),
  );

  const error = reset.isError ? errorMessage(reset.error) : null;

  return (
    <>
      <Link href="/signin" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
      <h1 className="mt-4 font-display text-[2rem] leading-tight tracking-tight">
        {step === "email" ? "Reset your password" : step === "code" ? "Enter your code" : "Choose a new password"}
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        {step === "email"
          ? "We'll email you a code to confirm it's you."
          : step === "code"
            ? `We sent a code to ${sentTo}.`
            : "Use at least 8 characters."}
      </p>

      {error && (
        <p role="alert" className="mt-5 rounded-lg border border-failed/30 bg-failed-wash px-3 py-2.5 text-sm text-failed">
          {error}
        </p>
      )}

      {step === "email" && (
        <form className="mt-6 space-y-4" noValidate onSubmit={sendCode}>
          <Field label="Email" htmlFor="reset-email" error={emailForm.formState.errors.email?.message}>
            <Input id="reset-email" type="email" autoComplete="username" autoFocus {...emailForm.register("email")} />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={reset.isPending}>
            Send code
          </Button>
        </form>
      )}

      {step === "code" && (
        <form className="mt-6 space-y-4" noValidate onSubmit={checkCode}>
          <Field label="Code" htmlFor="reset-code" error={codeForm.formState.errors.code?.message}>
            <Input id="reset-code" inputMode="numeric" autoComplete="one-time-code" autoFocus {...codeForm.register("code")} />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={reset.isPending}>
            Continue
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setStep("email")}>
            Use a different email
          </Button>
        </form>
      )}

      {step === "password" && (
        <form className="mt-6 space-y-4" noValidate onSubmit={setPassword}>
          <Field label="New password" htmlFor="new-password" error={passwordForm.formState.errors.newPassword?.message}>
            <Input id="new-password" type="password" autoComplete="new-password" autoFocus {...passwordForm.register("newPassword")} />
          </Field>
          <Field label="Confirm password" htmlFor="confirm-password" error={passwordForm.formState.errors.confirmPassword?.message}>
            <Input id="confirm-password" type="password" autoComplete="new-password" {...passwordForm.register("confirmPassword")} />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={reset.isPending}>
            Save password
          </Button>
        </form>
      )}
    </>
  );
}
