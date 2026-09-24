import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "./signin-form";
import { availableEnvironments } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm environments={availableEnvironments()} />
    </Suspense>
  );
}
