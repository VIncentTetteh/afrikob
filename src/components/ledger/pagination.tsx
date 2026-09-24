"use client";

import type { Table } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";

export interface ServerPagination {
  page: number;
  size: number;
  /** True while the last page came back full, so another page may exist. */
  hasMore: boolean;
  onPageChange: (page: number) => void;
  onSizeChange: (size: number) => void;
}

const PAGE_SIZES = [15, 25, 50, 100];

export function LedgerPagination<T>({ table, server }: { table: Table<T>; server?: ServerPagination }) {
  const rows = table.getFilteredRowModel().rows.length;
  const page = server ? server.page : table.getState().pagination.pageIndex + 1;
  const size = server ? server.size : table.getState().pagination.pageSize;
  const pageCount = server ? 0 : table.getPageCount();
  const canPrev = page > 1;
  const canNext = server ? server.hasMore : page < pageCount;

  const go = (p: number) => (server ? server.onPageChange(p) : table.setPageIndex(p - 1));
  const resize = (s: number) => (server ? server.onSizeChange(s) : table.setPageSize(s));

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-line px-3 py-2.5 text-sm text-ink-soft sm:flex-row sm:px-4">
      <div className="flex items-center gap-2">
        <label htmlFor="page-size" className="sr-only">
          Records per page
        </label>
        <Select id="page-size" value={size} onChange={(e) => resize(Number(e.target.value))} className="h-8 w-[4.5rem] text-sm">
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <span>{server ? `${rows} on this page` : `${rows} records`}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon-sm" onClick={() => go(page - 1)} disabled={!canPrev} aria-label="Previous page">
          <ChevronLeft />
        </Button>
        <span>{server ? `Page ${page}` : `Page ${page} of ${Math.max(1, pageCount)}`}</span>
        <Button variant="outline" size="icon-sm" onClick={() => go(page + 1)} disabled={!canNext} aria-label="Next page">
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
