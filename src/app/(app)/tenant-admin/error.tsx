"use client";

import { RouteError } from "@/components/domain/route-error";

export default function TenantAdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} homeHref="/tenant-admin" />;
}
