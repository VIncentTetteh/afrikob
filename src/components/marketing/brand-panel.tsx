import { ShieldCheck } from "lucide-react";
import { LedgerPreview } from "./ledger-preview";

const PROOF = [
  { term: "Collections", detail: "Charge a mobile money wallet and watch it settle, cedi by cedi." },
  { term: "Disbursements", detail: "Pay one beneficiary or a thousand, every name checked before the money leaves." },
  { term: "Controls", detail: "Maker-checker approvals, per-tenant fees and a refund trail you can audit." },
];

/**
 * Sign-in companion: the product doing its job, rather than decoration.
 * Ink surface so the form beside it stays the brightest thing on screen.
 */
export function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-pitch px-10 py-12 text-pitch-ink lg:flex lg:flex-col lg:justify-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div className="relative mx-auto w-full max-w-lg space-y-10">
        <p className="font-display text-[2.6rem] leading-[1.05] tracking-tight">
          Every cedi in, out and accounted for.
        </p>

        <LedgerPreview />

        <dl className="space-y-4 text-sm">
          {PROOF.map((row) => (
            <div key={row.term} className="flex gap-5 border-t border-white/12 pt-4">
              <dt className="w-24 shrink-0 font-medium">{row.term}</dt>
              <dd className="text-pitch-soft">{row.detail}</dd>
            </div>
          ))}
        </dl>

        <p className="flex items-center gap-2 text-xs text-pitch-soft">
          <ShieldCheck className="size-4 shrink-0" aria-hidden />
          Your credentials are exchanged for a short session on our server. Nothing is kept in your browser.
        </p>
      </div>
    </aside>
  );
}
