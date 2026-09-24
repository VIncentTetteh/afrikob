"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster, toast } from "sonner";
import { signInHref } from "@/lib/api/session";
import { onUnauthorized } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { useUi } from "@/stores/ui";

const MAX_RETRIES = 2;

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status < 500 && error.status !== 429) return false;
  return failureCount < MAX_RETRIES;
}

function ThemeSync() {
  const theme = useUi((s) => s.theme);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  return null;
}

function UnauthorizedRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(
    () =>
      onUnauthorized(() => {
        router.replace(signInHref("expired", pathname));
        router.refresh();
      }),
    [router, pathname],
  );
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: shouldRetry, refetchOnWindowFocus: false },
          mutations: { retry: false },
        },
        queryCache: new QueryCache({
          onError: (error) => {
            if (error instanceof ApiError && error.isUnauthorized) return;
            toast.error(errorMessage(error), { id: errorMessage(error) });
          },
        }),
        mutationCache: new MutationCache({
          onError: (error) => {
            if (error instanceof ApiError && error.isUnauthorized) return;
            toast.error(errorMessage(error));
          },
        }),
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ThemeSync />
      <UnauthorizedRedirect />
      {children}
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}
