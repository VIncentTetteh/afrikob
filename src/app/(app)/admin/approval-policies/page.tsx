"use client";

import { PoliciesPanel } from "@/components/admin/policies-panel";
import { PageHeader } from "@/components/domain/page-header";

export default function ApprovalPoliciesPage() {
  return (
    <>
      <PageHeader title="Approvals" description="Actions that need a second pair of eyes before they run" />
      <PoliciesPanel showHeader={false} />
    </>
  );
}
