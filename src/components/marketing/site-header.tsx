import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { buttonVariants } from "@/components/ui/button";

const LINKS = [
  { href: "#what", label: "What it does" },
  { href: "#how", label: "How a disbursement works" },
  { href: "#controls", label: "Controls" },
  { href: "#developers", label: "Developers" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-5 sm:px-8">
        <Link href="/" aria-label="Afrikob home" className="rounded-md">
          <Logo />
        </Link>
        <nav aria-label="Sections" className="hidden items-center gap-6 md:flex">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} className="text-sm text-ink-soft transition-colors hover:text-ink">
              {link.label}
            </a>
          ))}
        </nav>
        <Link href="/signin" className={buttonVariants({ className: "ml-auto" })}>
          Sign in
        </Link>
      </div>
    </header>
  );
}
