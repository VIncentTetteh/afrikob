import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-3 px-5 text-center">
      <Logo />
      <h1 className="mt-4 font-display text-2xl tracking-tight">That page does not exist</h1>
      <p className="text-sm text-ink-soft">The link may be old, or the record may have been removed.</p>
      <Link href="/" className={buttonVariants({ className: "mt-2" })}>
        Go to the home page
      </Link>
    </main>
  );
}
