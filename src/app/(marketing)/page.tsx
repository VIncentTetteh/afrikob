import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  FileSpreadsheet,
  Link2,
  ReceiptText,
  RotateCcw,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";
import { LedgerPreview } from "@/components/marketing/ledger-preview";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Afrikob Pay",
  description:
    "Collect from mobile money, disburse to banks and wallets in bulk, and account for every cedi — with maker-checker controls and an audited refund trail.",
};

const CAPABILITIES = [
  {
    icon: Banknote,
    title: "Collections",
    body: "Charge an MTN or Telecel wallet and follow the payment from the customer's approval prompt to settlement, with the fee and net amount on every record.",
  },
  {
    icon: ScrollText,
    title: "Disbursements",
    body: "Send to any Ghanaian bank account or mobile wallet. The beneficiary's registered name is fetched from the institution before the money leaves.",
  },
  {
    icon: FileSpreadsheet,
    title: "Bulk disbursements",
    body: "Upload a CSV of up to a thousand rows. Every row is validated, every name checked, mismatches flagged — then the batch goes out under one reference.",
  },
  {
    icon: Link2,
    title: "Payment links",
    body: "Create a hosted checkout link for a customer who is not in front of you, and track it like any other collection.",
  },
  {
    icon: RotateCcw,
    title: "Refunds",
    body: "Merchants request, the platform approves or rejects with a reason, and the provider's outcome is recorded against the original payment.",
  },
  {
    icon: ReceiptText,
    title: "Reports",
    body: "Filter collections or disbursements by tenant, date, state and currency. Read them on screen or download the same rows for reconciliation.",
  },
];

const DISBURSEMENT_STEPS = [
  { step: "Choose", body: "Pick the bank or mobile network and enter the account number." },
  { step: "Check the name", body: "We ask the institution who owns that account and fill the name in for you." },
  { step: "Confirm", body: "Review the amount and beneficiary. Anything unverified is called out before you commit." },
  { step: "Follow it", body: "The payment appears in the ledger and moves from in flight to settled, or fails with the provider's reason." },
];

const CONTROLS = [
  {
    icon: ShieldCheck,
    title: "Maker-checker",
    body: "Name the actions that need a second pair of eyes — funding a wallet, approving a refund — and how many approvals each needs. Those actions wait rather than run.",
  },
  {
    icon: Users,
    title: "People and permissions",
    body: "Staff and merchant teams sign in with email, password and an emailed code. Each person can submit, approve, both or neither, and can be deactivated the moment they change roles.",
  },
  {
    icon: BadgeCheck,
    title: "Keys stay with your systems",
    body: "API keys are for your own software calling the gateway, never for signing in here. Each key is shown once when issued, then it is yours to store safely.",
  },
];

const FAQS = [
  {
    q: "Who signs in with what?",
    a: "Everyone signs in with the email and password their administrator set up, confirmed by a code sent to their inbox. Afrikob staff see the platform; a merchant's team sees only their own money and people. API keys are for integrating the gateway into your own systems.",
  },
  {
    q: "How do merchants get onto the platform?",
    a: "An Afrikob administrator creates the tenant, sets its daily and per-payment limits, adds the merchant's first administrator, and issues an API key for their integration. That administrator then adds the rest of their team.",
  },
  {
    q: "What happens when a disbursement fails?",
    a: "The record keeps the provider's message and reason, so you can tell an expired account from a closed one. Bulk batches can be reconciled against the provider and re-checked per item.",
  },
  {
    q: "Can we see fees and what actually reaches the merchant?",
    a: "Yes. Every payment carries its fee, platform fee and net amount, and the reports total those per tenant for the period you choose.",
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="mx-auto grid w-full max-w-6xl gap-12 px-5 pb-16 pt-14 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:items-center lg:gap-16 lg:pb-24 lg:pt-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-field px-3 py-1 text-xs text-ink-soft">
            <span className="size-1.5 rounded-full bg-settled" aria-hidden />
            Live on the Afrikob gateway, powered by 360Pay
          </p>
          <h1 className="mt-5 font-display text-[2.75rem] leading-[1.02] tracking-tight sm:text-[3.5rem]">
            Move money across Ghana, and account for every cedi.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
            Afrikob Pay collects from mobile money wallets, disburses to banks and wallets one at a time or a thousand at
            once, and keeps a record you can hand to an auditor.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/signin" className={buttonVariants({ size: "lg" })}>
              Sign in <ArrowRight />
            </Link>
            <a href="#what" className={buttonVariants({ variant: "outline", size: "lg" })}>
              See what it does
            </a>
          </div>
          <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-line pt-6">
            {[
              { label: "Networks", value: "MTN · Telecel" },
              { label: "Banks", value: "All GhIPSS" },
              { label: "Per batch", value: "1,000 disbursements" },
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="text-xs text-ink-soft">{stat.label}</dt>
                <dd className="figure mt-1 text-base sm:text-lg">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-2xl bg-pitch p-4 sm:p-6">
          <LedgerPreview />
          <p className="mt-4 px-1 text-xs text-pitch-soft">
            The merchant view: what you can spend, and what moved today.
          </p>
        </div>
      </section>

      <section id="what" className="border-t border-line bg-ground py-16 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
          <h2 className="font-display text-[2rem] leading-tight tracking-tight">What it does</h2>
          <p className="mt-2 max-w-2xl text-ink-soft">
            Six jobs, each with its own screen, its own audit trail and the same ledger underneath.
          </p>
          <div className="mt-10 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((item) => (
              <article key={item.title}>
                <item.icon className="size-5 text-accent" aria-hidden />
                <h3 className="mt-3 text-lg font-semibold">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:gap-16">
            <div>
              <h2 className="font-display text-[2rem] leading-tight tracking-tight">How a disbursement works</h2>
              <p className="mt-2 text-ink-soft">
                The order matters: nothing leaves an account before the beneficiary is confirmed and the amount is read
                back to you.
              </p>
            </div>
            <ol className="space-y-6">
              {DISBURSEMENT_STEPS.map((item, index) => (
                <li key={item.step} className="flex gap-5 border-t border-line pt-5">
                  <span className="figure w-6 shrink-0 text-ink-faint" aria-hidden>
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-medium">{item.step}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">{item.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-ground py-16 sm:py-20">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 sm:px-8 lg:grid-cols-2">
          <article className="rounded-2xl border border-line bg-paper p-7">
            <h2 className="font-display text-2xl tracking-tight">For merchants</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Sign in with your email and password and see your own money: what you collected, what you can disburse, what
              is still in flight. Raise a charge, send a disbursement, upload payroll, or check where a single payment
              stands using your own reference. Your developers connect with an API key.
            </p>
          </article>
          <article className="rounded-2xl border border-line bg-paper p-7">
            <h2 className="font-display text-2xl tracking-tight">For the Afrikob team</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Onboard merchants and their teams, issue integration keys, fund their wallets, set per-payment-type fees, review refund
              requests, and reconcile the whole platform by tenant and date. Every funding entry and approval carries the
              name of the person who made it.
            </p>
          </article>
        </div>
      </section>

      <section id="controls" className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
          <h2 className="font-display text-[2rem] leading-tight tracking-tight">Controls worth having before the money moves</h2>
          <div className="mt-10 grid gap-x-10 gap-y-9 sm:grid-cols-3">
            {CONTROLS.map((item) => (
              <article key={item.title}>
                <item.icon className="size-5 text-accent" aria-hidden />
                <h3 className="mt-3 text-lg font-semibold">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="developers" className="border-t border-line bg-ground py-16 sm:py-20">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 sm:px-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
          <div>
            <h2 className="font-display text-[2rem] leading-tight tracking-tight">Built on the same API you use</h2>
            <p className="mt-3 text-ink-soft">
              The console calls nothing the gateway does not offer you. Exchange your key for a token, then collect,
              disburse, verify names, run bulk batches and check status from your own systems.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-ink-soft">
              {[
                "Idempotency keys on refunds, batch references on bulk disbursements",
                "Name verification before a disbursement, one account or a thousand",
                "Status checks by your own transaction reference",
              ].map((line) => (
                <li key={line} className="flex gap-2.5">
                  <BadgeCheck className="mt-0.5 size-4 shrink-0 text-settled" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div className="overflow-hidden rounded-2xl border border-line bg-pitch">
            <div className="flex items-center gap-2 border-b border-white/12 px-4 py-2.5 text-xs text-pitch-soft">
              <span className="size-2 rounded-full bg-[var(--failed)]" aria-hidden />
              <span className="size-2 rounded-full bg-[var(--pending)]" aria-hidden />
              <span className="size-2 rounded-full bg-[var(--settled)]" aria-hidden />
              <span className="ml-2">Send a disbursement</span>
            </div>
            <pre className="overflow-x-auto px-5 py-4 text-[0.8125rem] leading-relaxed text-pitch-ink/85">
              <code>{`curl -X POST https://api.afrikob.com/api/v1/payments/disbursement \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "clientTransactionId": "PAY-10423",
    "institutionCode": "GCB",
    "accountNumber": "851274680",
    "accountName": "Kofi Boateng",
    "amount": 4800.00,
    "currency": "GHS",
    "reference": "September salary"
  }'`}</code>
            </pre>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-3xl px-5 sm:px-8">
          <h2 className="font-display text-[2rem] leading-tight tracking-tight">Questions people ask</h2>
          <dl className="mt-8 divide-y divide-line border-t border-line">
            {FAQS.map((item) => (
              <div key={item.q} className="py-5">
                <dt className="font-medium">{item.q}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-ink-soft">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="border-t border-line bg-ground py-16">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-5 px-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <h2 className="font-display text-2xl tracking-tight">Ready when you are</h2>
            <p className="mt-1.5 text-ink-soft">
              Merchants and Afrikob staff sign in with email and password.
            </p>
          </div>
          <Link href="/signin" className={buttonVariants({ size: "lg" })}>
            Sign in <ArrowRight />
          </Link>
        </div>
      </section>
    </>
  );
}
