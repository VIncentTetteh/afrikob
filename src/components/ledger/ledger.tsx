"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { LedgerPagination, type ServerPagination } from "./pagination";
import { EmptyState, ErrorState } from "@/components/domain/feedback";
import { Button } from "@/components/ui/button";
import { DropdownCheckbox, DropdownContent, DropdownLabel, DropdownMenu, DropdownTrigger } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { Panel, Skeleton } from "@/components/ui/panel";
import { DirectionRail, type Direction } from "@/components/ui/state";
import { cn } from "@/lib/utils";
import { useUi } from "@/stores/ui";

export type { ServerPagination };

/** Columns with this id sit in the record footer on small screens. */
export const ACTIONS_COLUMN_ID = "actions";
const SKELETON_ROWS = 6;
const CLIENT_PAGE_SIZE = 15;
/** A phone record shows only the leading fields; the rest live in the record sheet. */
const MOBILE_FIELD_COUNT = 4;

interface LedgerProps<T> {
  tableId: string;
  columns: ColumnDef<T, unknown>[];
  data: T[];
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  getRowId?: (row: T, index: number) => string;
  /** Direction rail per row; omit for tables that are not money movements. */
  getDirection?: (row: T) => Direction;
  serverPagination?: ServerPagination;
  toolbar?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  searchPlaceholder?: string;
}

function headerLabel<T>(col: ColumnDef<T, unknown>, fallback: string): string {
  return typeof col.header === "string" ? col.header : fallback;
}

/**
 * The ledger: a dense, sortable, searchable table that becomes a stacked
 * record list under `md`. Keeps column visibility per table in local storage.
 */
export function Ledger<T>(props: LedgerProps<T>) {
  const { tableId, columns, data, loading, error, onRetry, onRowClick, getDirection, serverPagination } = props;
  const hidden = useUi((s) => s.hiddenColumns[tableId]);
  const setHidden = useUi((s) => s.setHiddenColumns);
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const columnVisibility = useMemo<VisibilityState>(
    () => Object.fromEntries((hidden ?? []).map((id) => [id, false])),
    [hidden],
  );

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter, sorting, columnVisibility },
    getRowId: props.getRowId,
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onColumnVisibilityChange: (updater) => {
      const next = typeof updater === "function" ? updater(columnVisibility) : updater;
      setHidden(tableId, Object.entries(next).filter(([, v]) => !v).map(([k]) => k));
    },
    globalFilterFn: "includesString",
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(serverPagination ? {} : { getPaginationRowModel: getPaginationRowModel() }),
    initialState: { pagination: { pageSize: CLIENT_PAGE_SIZE, pageIndex: 0 } },
  });

  const rows = table.getRowModel().rows;
  const visibleColumns = table.getVisibleLeafColumns();
  const hideable = table.getAllLeafColumns().filter((c) => c.getCanHide());

  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line p-3 sm:px-4">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <Input
            type="search"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={props.searchPlaceholder ?? "Search this page"}
            aria-label="Search records"
            className="pl-9"
          />
        </div>
        {props.toolbar}
        <DropdownMenu>
          <DropdownTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Choose columns">
              <SlidersHorizontal />
            </Button>
          </DropdownTrigger>
          <DropdownContent>
            <DropdownLabel>Columns</DropdownLabel>
            {hideable.map((c) => (
              <DropdownCheckbox key={c.id} checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(v)}>
                {headerLabel(c.columnDef, c.id)}
              </DropdownCheckbox>
            ))}
          </DropdownContent>
        </DropdownMenu>
      </div>

      {error && !loading ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : !loading && rows.length === 0 ? (
        <EmptyState title={props.emptyTitle ?? "Nothing here yet"} description={props.emptyDescription} action={props.emptyAction} />
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-line">
                    {getDirection && <th scope="col" className="w-3 p-0" aria-label="Direction" />}
                    {hg.headers.map((h) => {
                      const sorted = h.column.getIsSorted();
                      return (
                        <th
                          key={h.id}
                          scope="col"
                          aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined}
                          className="whitespace-nowrap px-3 py-2.5 text-[0.8125rem] font-medium text-ink-soft"
                        >
                          {h.isPlaceholder ? null : h.column.getCanSort() ? (
                            <button className="inline-flex items-center gap-1" onClick={h.column.getToggleSortingHandler()}>
                              {flexRender(h.column.columnDef.header, h.getContext())}
                              {sorted === "asc" ? <ArrowUp className="size-3" /> : sorted === "desc" ? <ArrowDown className="size-3" /> : null}
                            </button>
                          ) : (
                            flexRender(h.column.columnDef.header, h.getContext())
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
                      <tr key={i} className="border-b border-line last:border-0">
                        {getDirection && <td className="p-0" />}
                        {visibleColumns.map((c) => (
                          <td key={c.id} className="px-3 py-3.5">
                            <Skeleton className="h-4 w-full max-w-28" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : rows.map((row) => (
                      <tr
                        key={row.id}
                        onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                        className={cn(
                          "border-b border-line last:border-0 transition-colors",
                          onRowClick && "cursor-pointer hover:bg-field",
                        )}
                      >
                        {getDirection && (
                          <td className="py-2 pl-3 pr-0 align-middle">
                            <DirectionRail direction={getDirection(row.original)} className="h-7" />
                          </td>
                        )}
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="whitespace-nowrap px-3 py-3.5 align-middle">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {/* Stacked records under md; actions sit outside the tappable body. */}
          <ul className="divide-y divide-line md:hidden">
            {loading
              ? Array.from({ length: 3 }, (_, i) => (
                  <li key={i} className="p-4">
                    <Skeleton className="h-20 w-full" />
                  </li>
                ))
              : rows.map((row) => {
                  const cells = row.getVisibleCells();
                  const actionCell = cells.find((c) => c.column.id === ACTIONS_COLUMN_ID);
                  const fieldCells = cells
                    .filter((c) => c.column.id !== ACTIONS_COLUMN_ID)
                    .slice(0, MOBILE_FIELD_COUNT);
                  return (
                    <li key={row.id} className="flex gap-3 px-3 py-3">
                      {getDirection && <DirectionRail direction={getDirection(row.original)} className="mt-1 h-auto self-stretch" />}
                      <div className="min-w-0 flex-1">
                        <div
                          role={onRowClick ? "button" : undefined}
                          tabIndex={onRowClick ? 0 : undefined}
                          onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                          onKeyDown={(e) => onRowClick && e.key === "Enter" && onRowClick(row.original)}
                          className={cn("space-y-1.5", onRowClick && "cursor-pointer")}
                        >
                          {fieldCells.map((cell) => (
                            <div key={cell.id} className="flex items-baseline justify-between gap-4 text-sm">
                              <span className="text-ink-soft">{headerLabel(cell.column.columnDef, cell.column.id)}</span>
                              <span className="min-w-0 truncate text-right">
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </span>
                            </div>
                          ))}
                        </div>
                        {actionCell && (
                          <div className="mt-2 flex justify-end">
                            {flexRender(actionCell.column.columnDef.cell, actionCell.getContext())}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
          </ul>

          <LedgerPagination table={table} server={serverPagination} />
        </>
      )}
    </Panel>
  );
}
