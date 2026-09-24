"use client";

import { ApprovalsInbox } from "@/components/approvals/approvals-inbox";

export default function TenantApprovalsPage() {
  return <ApprovalsInbox scope="tenant-admin" description="Actions in your business waiting on a second pair of eyes" />;
}
