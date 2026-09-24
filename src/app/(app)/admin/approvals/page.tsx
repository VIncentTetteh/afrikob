"use client";

import { ApprovalsInbox } from "@/components/approvals/approvals-inbox";

export default function AdminApprovalsPage() {
  return <ApprovalsInbox scope="platform" description="Actions across the platform waiting on a second pair of eyes" />;
}
