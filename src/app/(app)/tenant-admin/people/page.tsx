"use client";

import { PageHeader } from "@/components/domain/page-header";
import { PeoplePanel } from "@/components/people/people-panel";

export default function TenantPeoplePage() {
  return (
    <>
      <PageHeader title="People" description="Who in your business can sign in, and what they may do" />
      <PeoplePanel scope="tenant-admin" showHeading={false} />
    </>
  );
}
