"use client";

import { FileSpreadsheet, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PayoutSheet } from "@/components/payments/disbursement-dialog";
import { LedgerView } from "@/components/transactions/ledger-view";
import { Button, buttonVariants } from "@/components/ui/button";

export default function DisbursementsPage() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <LedgerView
        title="Payouts"
        description="Money going out to banks and wallets"
        kind="disbursement"
        noun="Payouts"
        heroLabel="Paid out on this page"
        emptyDescription="Payouts you send will appear here."
        actions={
          <>
            <Link href="/disbursements/bulk" className={buttonVariants({ variant: "outline" })}>
              <FileSpreadsheet /> Bulk
            </Link>
            <Button onClick={() => setOpen(true)}>
              <Plus /> Send money
            </Button>
          </>
        }
      />
      <PayoutSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
