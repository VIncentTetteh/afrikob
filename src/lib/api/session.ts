"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { readCsrfToken } from "./csrf";
import { ApiError } from "./errors";
import { qk } from "./keys";
import type { Environment, PublicSession } from "@/lib/session/types";
import { CSRF_HEADER } from "@/lib/session/types";

export type ClientSession = PublicSession & { environments: Environment[] };

export type LoginInput =
  | { env: Environment; email: string; password: string }
  | { env: Environment; apiKey: string };

/** A password accepted, with a one-time code emailed: no session yet. */
export interface PendingLoginResponse {
  requiresVerification: true;
  maskedEmail: string | null;
  expiresIn: number;
}

export type LoginResult = PublicSession | PendingLoginResponse;

export function isPendingLogin(result: LoginResult): result is PendingLoginResponse {
  return "requiresVerification" in result && result.requiresVerification;
}

/** Steps of the password-reset flow, relayed by /api/auth/password. */
export type PasswordStep =
  | { step: "forgot"; env: Environment; email: string }
  | { step: "verify"; env: Environment; email: string; code: string }
  | { step: "reset"; env: Environment; email: string; code: string; newPassword: string; confirmPassword: string };

const SESSION_STALE_MS = 5 * 60 * 1000;

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const csrf = readCsrfToken();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(csrf ? { [CSRF_HEADER]: csrf } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError({
      status: res.status,
      message: typeof payload.message === "string" ? payload.message : `Request failed (${res.status})`,
    });
  }
  return payload as T;
}

export function useSession() {
  return useQuery({
    queryKey: qk.session,
    queryFn: async () => {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (!res.ok) throw new ApiError({ status: res.status, message: "Not signed in." });
      return (await res.json()) as ClientSession;
    },
    staleTime: SESSION_STALE_MS,
    retry: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => postJson<LoginResult>("/api/auth/login", input),
    onSuccess: () => qc.clear(),
  });
}

/** Exchanges the emailed code for a live session. */
export function useVerifyLoginCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => postJson<PublicSession>("/api/auth/verify-login", { code }),
    onSuccess: () => qc.clear(),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: async () => {
      await postJson("/api/auth/logout").catch(() => undefined);
    },
    onSettled: () => {
      qc.clear();
      router.replace("/signin");
      router.refresh();
    },
  });
}

/** Drives forgot-password → verify-code → reset-password. */
export function usePasswordReset() {
  return useMutation({
    mutationFn: (input: PasswordStep) => postJson<{ data?: unknown; message?: string }>("/api/auth/password", input),
  });
}
