"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { readCsrfToken } from "./csrf";
import { ApiError } from "./errors";
import { qk } from "./keys";
import type { Environment, PublicSession } from "@/lib/session/types";
import { CSRF_HEADER } from "@/lib/session/types";

export type ClientSession = PublicSession & { environments: Environment[] };

export type LoginInput = { env: Environment; email: string; password: string };

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
const SESSION_RETRIES = 2;

/**
 * Only a 401 means signed out. A dropped connection, a cold-start 502 or a
 * fetch aborted by the laptop sleeping are all transient: retry them, because
 * treating them as a sign-out throws away a session that is still good.
 */
function retrySession(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status === 401) return false;
  return failureCount < SESSION_RETRIES;
}

/** The sign-in URL, keeping the page someone was on so they return to it. */
export function signInHref(reason: "expired", here: string): string {
  const params = new URLSearchParams({ reason });
  if (here && here !== "/" && !here.startsWith("/signin")) params.set("next", here);
  return `/signin?${params.toString()}`;
}

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
    retry: retrySession,
  });
}

/**
 * Whether this person may submit money movements (maker). The gateway enforces
 * it anyway; hiding the buttons spares them a form that can only be refused.
 */
export function useCanMake(): boolean {
  return useSession().data?.canMake ?? false;
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
