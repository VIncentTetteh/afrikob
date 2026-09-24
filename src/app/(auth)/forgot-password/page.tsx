import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetFlow } from "./reset-flow";
import { availableEnvironments } from "@/lib/env";

export const metadata: Metadata = { title: "Reset password" };
export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ResetFlow environments={availableEnvironments()} />
    </Suspense>
  );
}
