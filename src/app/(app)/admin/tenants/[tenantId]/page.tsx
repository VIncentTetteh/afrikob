"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { FeesPanel } from "@/components/admin/fees-panel";
import { IssueCredentialPanel } from "@/components/admin/issue-credential";
import { PoliciesPanel } from "@/components/admin/policies-panel";
import { PeoplePanel } from "@/components/people/people-panel";
import { ReportView } from "@/components/admin/report-view";
import { WalletPanel } from "@/components/admin/wallet-panel";
import { ApprovalsInbox } from "@/components/approvals/approvals-inbox";
import { KeyValueList, recordToItems } from "@/components/domain/key-value-list";
import { PageHeader } from "@/components/domain/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader, Skeleton } from "@/components/ui/panel";
import { State } from "@/components/ui/state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenants } from "@/lib/api/hooks";
import { useSession } from "@/lib/api/session";

export default function TenantDetailPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId: raw } = use(params);
  const tenantId = decodeURIComponent(raw);
  // The gateway has no GET /admin/tenants/{id}; resolve from the cached list.
  const tenants = useTenants();
  const { data: session } = useSession();
  const tenant = tenants.data?.find((t) => t.id === tenantId || t.code === tenantId);

  return (
    <>
      <Link href="/admin/tenants" className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-2 w-fit" })}>
        <ArrowLeft /> All tenants
      </Link>
      <PageHeader title={tenant?.displayName ?? "Tenant"} description={tenant?.code ?? tenantId} />
      <Tabs defaultValue="wallet" className="space-y-5">
        <TabsList>
          <TabsTrigger value="wallet">Wallet</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="requests">Approval requests</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="fees">Fees</TabsTrigger>
          <TabsTrigger value="approvals">Approval rules</TabsTrigger>
          <TabsTrigger value="keys">Integration keys</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>
        <TabsContent value="wallet">{session && <WalletPanel tenantId={tenantId} session={session} />}</TabsContent>
        <TabsContent value="transactions" className="space-y-5">
          <ReportView tenantId={tenantId} />
        </TabsContent>
        <TabsContent value="requests" className="space-y-5">
          <ApprovalsInbox scope="platform" tenantId={tenantId} description="What this tenant's people submitted for a second pair of eyes" />
        </TabsContent>
        <TabsContent value="fees">
          <FeesPanel tenantId={tenantId} />
        </TabsContent>
        <TabsContent value="keys">
          <IssueCredentialPanel tenantId={tenantId} />
        </TabsContent>
        <TabsContent value="people">
          <PeoplePanel scope="platform" tenantId={tenantId} />
        </TabsContent>
        <TabsContent value="approvals">
          <PoliciesPanel tenantId={tenantId} />
        </TabsContent>
        <TabsContent value="profile">
          <Panel>
            <PanelHeader
              title="Profile"
              description="As the gateway records it"
              actions={tenant && <State status={tenant.status ?? "Active"} />}
            />
            <PanelBody>
              {tenants.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : tenant ? (
                <KeyValueList items={recordToItems(tenant)} />
              ) : (
                <p className="text-sm text-ink-soft">This tenant is not in the tenant list.</p>
              )}
            </PanelBody>
          </Panel>
        </TabsContent>
      </Tabs>
    </>
  );
}
