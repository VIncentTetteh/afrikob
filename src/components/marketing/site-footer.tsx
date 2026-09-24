import Link from "next/link";
import { Logo } from "@/components/layout/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex items-center gap-3">
          <Logo />
          <span>Payment gateway for Ghana, powered by 360Pay.</span>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/signin" className="hover:text-ink">
            Sign in
          </Link>
          <a href="#developers" className="hover:text-ink">
            API
          </a>
          <span>© {new Date().getFullYear()} Afrikob</span>
        </div>
      </div>
    </footer>
  );
}
