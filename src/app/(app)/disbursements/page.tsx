"use client";

import { FileSpreadsheet, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DisbursementSheet } from "@/components/payments/disbursement-dialog";
import { LedgerView } from "@/components/transactions/ledger-view";
import { Button, buttonVariants } from "@/components/ui/button";
import { useCanMake } from "@/lib/api/session";

export default function DisbursementsPage() {
  const [open, setOpen] = useState(false);
  const canMake = useCanMake();
  return (
    <>
      <LedgerView
        title="Disbursements"
        description="Money going out to banks and wallets"
        kind="disbursement"
        noun="Disbursements"
        heroLabel="Disbursed on this page"
        emptyDescription="Disbursements you send will appear here."
        actions={
          <>
            <Link href="/disbursements/bulk" className={buttonVariants({ variant: "outline" })}>
              <FileSpreadsheet /> Bulk
            </Link>
            {canMake && (
              <Button onClick={() => setOpen(true)}>
                <Plus /> Send money
              </Button>
            )}
          </>
        }
      />
      <DisbursementSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
