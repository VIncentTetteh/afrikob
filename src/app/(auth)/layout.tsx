import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandPanel } from "@/components/marketing/brand-panel";
import { Logo } from "@/components/layout/logo";

/** Auth split: the form on the left, proof that the system works on the right. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <section className="flex flex-col px-5 py-8 sm:px-10">
        <Link href="/" aria-label="Afrikob home" className="w-fit rounded-md">
          <Logo />
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[26rem]">{children}</div>
        </div>
        <div className="space-y-3 text-center text-xs text-ink-faint">
          <p className="mx-auto flex max-w-sm items-center justify-center gap-2 lg:hidden">
            <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
            Credentials are exchanged for a short session on our server, never stored in your browser.
          </p>
          <p>Afrikob Payment Gateway · powered by 360Pay</p>
        </div>
      </section>
      <BrandPanel />
    </div>
  );
}
