"use client";

import { Filter, FileDown, RefreshCw } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { transactionColumns, transactionCsvRow, TRANSACTION_CSV_HEADERS } from "./columns";
import { TransactionSheet } from "./detail-sheet";
import {
  activeFilterCount,
  applyFilters,
  countByTone,
  directionOf,
  EMPTY_FILTERS,
  filterByKind,
  settledTotal,
  type TxFilters,
} from "./filters";
import { RefundRequestDialog } from "./refund-dialog";
import { BalanceStrip } from "@/components/domain/balance-strip";
import { PageHeader } from "@/components/domain/page-header";
import { Ledger } from "@/components/ledger/ledger";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { useTransactions } from "@/lib/api/hooks";
import type { Transaction, TransactionKind } from "@/lib/api/schemas/models";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatNumber } from "@/lib/format";

const DEFAULT_PAGE_SIZE = 25;

interface Props {
  title: string;
  description: string;
  kind?: TransactionKind;
  noun: string;
  heroLabel: string;
  allowRefunds?: boolean;
  actions?: ReactNode;
  emptyDescription?: string;
}

/** Paged, filterable ledger shared by Collections, Payouts and admin Transactions. */
export function LedgerView({ title, description, kind, noun, heroLabel, allowRefunds, actions, emptyDescription }: Props) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const [filters, setFilters] = useState<TxFilters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [viewing, setViewing] = useState<Transaction | null>(null);
  const [refunding, setRefunding] = useState<Transaction | null>(null);
  const query = useTransactions(page, size);

  const pageItems = useMemo(() => filterByKind(query.data ?? [], kind), [query.data, kind]);
  const rows = useMemo(() => applyFilters(pageItems, filters), [pageItems, filters]);
  const counts = useMemo(() => countByTone(pageItems), [pageItems]);
  const currency = pageItems[0]?.currency ?? "GHS";

  const columns = useMemo(
    () => transactionColumns({ onView: setViewing, onRefund: allowRefunds ? setRefunding : undefined }),
    [allowRefunds],
  );

  const exportCsv = () => {
    if (rows.length === 0) {
      toast.info("Nothing to export on this page.");
      return;
    }
    downloadCsv(`${noun.toLowerCase()}-${new Date().toISOString().slice(0, 10)}`, toCsv(TRANSACTION_CSV_HEADERS, rows.map(transactionCsvRow)));
  };
  const filterCount = activeFilterCount(filters);

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            {actions}
            <Button variant="outline" onClick={() => setFilterOpen(true)}>
              <Filter /> Filter{filterCount > 0 && ` (${filterCount})`}
            </Button>
            <Button variant="outline" onClick={() => query.refetch()} loading={query.isRefetching}>
              {!query.isRefetching && <RefreshCw />} Refresh
            </Button>
            <Button variant="outline" onClick={exportCsv}>
              <FileDown /> Export
            </Button>
          </>
        }
      />

      <BalanceStrip
        heroLabel={heroLabel}
        heroAmount={settledTotal(pageItems)}
        heroCurrency={currency}
        heroNote={`Settled across ${formatNumber(pageItems.length)} ${noun.toLowerCase()} on this page`}
        loading={query.isLoading}
        figures={[
          { label: "Settled", value: formatNumber(counts.success), tone: "settled" },
          { label: "In flight", value: formatNumber(counts.pending), tone: "pending" },
          { label: "Failed", value: formatNumber(counts.failed), tone: "failed" },
          { label: "Records", value: formatNumber(pageItems.length) },
        ]}
      />

      <Ledger
        tableId={`ledger-${kind ?? "all"}`}
        columns={columns}
        data={rows}
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        onRowClick={setViewing}
        getRowId={(t) => t.id}
        getDirection={directionOf}
        emptyTitle={`No ${noun.toLowerCase()} on this page`}
        emptyDescription={filterCount ? "Clear the filters to see everything." : emptyDescription}
        searchPlaceholder="Search this page"
        serverPagination={{
          page,
          size,
          hasMore: (query.data?.length ?? 0) === size,
          onPageChange: setPage,
          onSizeChange: (s) => {
            setSize(s);
            setPage(1);
          },
        }}
      />

      <FilterDialog open={filterOpen} onOpenChange={setFilterOpen} value={filters} onApply={setFilters} />
      <TransactionSheet
        transaction={viewing}
        onOpenChange={(o) => !o && setViewing(null)}
        onRefund={
          allowRefunds
            ? (t) => {
                setViewing(null);
                setRefunding(t);
              }
            : undefined
        }
      />
      {allowRefunds && <RefundRequestDialog transaction={refunding} onOpenChange={(o) => !o && setRefunding(null)} />}
    </>
  );
}

function FilterDialog({
  open,
  onOpenChange,
  value,
  onApply,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  value: TxFilters;
  onApply: (f: TxFilters) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setDraft(value);
        onOpenChange(o);
      }}
      title="Filter this page"
      description="Applies to the records already loaded."
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => {
              onApply(EMPTY_FILTERS);
              onOpenChange(false);
            }}
          >
            Clear
          </Button>
          <Button
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            Apply
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="State" htmlFor="f-status">
          <Select id="f-status" value={draft.tone} onChange={(e) => setDraft({ ...draft, tone: e.target.value as TxFilters["tone"] })}>
            <option value="all">Any state</option>
            <option value="success">Settled</option>
            <option value="pending">In flight</option>
            <option value="failed">Failed</option>
          </Select>
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="From" htmlFor="f-from">
            <Input id="f-from" type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
          </Field>
          <Field label="To" htmlFor="f-to">
            <Input id="f-to" type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}
