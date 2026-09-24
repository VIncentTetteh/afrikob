"use client";

import { PageHeader } from "@/components/domain/page-header";
import { PeoplePanel } from "@/components/people/people-panel";

export default function AdminUsersPage() {
  return (
    <>
      <PageHeader title="People" description="Who can sign in, and what they are allowed to do" />
      <PeoplePanel scope="platform" showHeading={false} />
    </>
  );
}
