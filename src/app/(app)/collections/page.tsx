"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { CollectionSheet } from "@/components/payments/collection-dialog";
import { LedgerView } from "@/components/transactions/ledger-view";
import { Button } from "@/components/ui/button";

export default function CollectionsPage() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <LedgerView
        title="Collections"
        description="Money coming in from customers"
        kind="collection"
        noun="Collections"
        heroLabel="Collected on this page"
        allowRefunds
        emptyDescription="Charges you raise will appear here."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus /> Collect
          </Button>
        }
      />
      <CollectionSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
