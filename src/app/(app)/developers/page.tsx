import { KeyRound, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/domain/page-header";
import { CopyButton } from "@/components/domain/feedback";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { publicApiUrl } from "@/lib/env";
import { API_PREFIX, INTEGRATION_ENDPOINTS, integrationSamples } from "@/lib/api/integration";
import { readSession } from "@/lib/server/session";

export const metadata: Metadata = { title: "Developers" };
export const dynamic = "force-dynamic";

/**
 * How a tenant connects their own systems. The API key belongs there: it is
 * exchanged for a bearer token by their server, and never signs anyone in here.
 */
export default async function DevelopersPage() {
  const session = await readSession();
  // Staff see it too, to walk a tenant's developers through the integration.
  if (!session) redirect("/");
  const baseUrl = publicApiUrl(session.env);
  const samples = integrationSamples(baseUrl);

  return (
    <>
      <PageHeader title="Developers" description={`Connect your own systems to the gateway (${session.env} environment)`} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          <Panel>
            <PanelHeader title="Base URL" description="Every path below is relative to this." />
            <PanelBody className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 break-all rounded-lg border border-line bg-field px-3 py-2 text-sm">
                {baseUrl}
                {API_PREFIX}
              </code>
              <CopyButton value={`${baseUrl}${API_PREFIX}`} label="Copy URL" />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Quick start" description="Keep the key and token in your server's environment, never in a browser or app." />
            <PanelBody className="space-y-5">
              {samples.map((sample) => (
                <section key={sample.title} className="min-w-0">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-medium">{sample.title}</h3>
                    <CopyButton value={sample.code} label="Copy" />
                  </div>
                  <pre className="overflow-x-auto rounded-lg bg-pitch p-3.5 text-xs leading-relaxed text-pitch-ink">
                    <code>{sample.code}</code>
                  </pre>
                </section>
              ))}
              <p className="text-sm text-ink-soft">
                Take the JWT from the token response and send it as <code className="text-ink">Authorization: Bearer</code> on
                every other call. <code className="text-ink">clientTransactionId</code> is your own reference: keep it unique
                per payment so a retry is recognised rather than paid twice.
              </p>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Endpoints" description={`Under ${API_PREFIX}`} />
            {/* Phones read each endpoint as a stacked row rather than scrolling a table sideways. */}
            <ul className="divide-y divide-line sm:hidden">
              {INTEGRATION_ENDPOINTS.map((e) => (
                <li key={`${e.method} ${e.path}`} className="px-4 py-3">
                  <p className="break-all font-mono text-xs">
                    <span className="mr-2 font-semibold">{e.method}</span>
                    {e.path}
                  </p>
                  <p className="mt-1 text-sm text-ink-soft">{e.purpose}</p>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[36rem] text-sm">
                <thead className="bg-field text-left text-xs uppercase tracking-wide text-ink-soft">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium sm:px-5">Method</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Path</th>
                    <th scope="col" className="px-4 py-2.5 font-medium sm:pr-5">What it does</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {INTEGRATION_ENDPOINTS.map((e) => (
                    <tr key={`${e.method} ${e.path}`}>
                      <td className="px-4 py-2.5 font-mono text-xs font-semibold sm:px-5">{e.method}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{e.path}</td>
                      <td className="px-4 py-2.5 text-ink-soft sm:pr-5">{e.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <aside className="space-y-5">
          <Panel>
            <PanelHeader title="Your API key" />
            <PanelBody className="space-y-3 text-sm">
              <p className="flex gap-2">
                <KeyRound className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                Afrikob issues your keys and shows each one once. Ask your Afrikob account manager for a new key, or to retire
                one you no longer use.
              </p>
              <p className="text-ink-soft">
                The key is only for your systems. You and your team sign in here with email and password.
              </p>
            </PanelBody>
          </Panel>
          <Panel>
            <PanelHeader title="Before you go live" />
            <PanelBody>
              <p className="flex gap-2 text-sm">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-pending" aria-hidden />
                <span>
                  A token only works from the IP address that requested it. Call the gateway from servers with a fixed
                  outbound IP, and request a fresh token whenever a call answers 401.
                </span>
              </p>
            </PanelBody>
          </Panel>
        </aside>
      </div>
    </>
  );
}
