"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Eye, MoreHorizontal, RotateCcw } from "lucide-react";
import { Ref } from "@/components/domain/feedback";
import { Button } from "@/components/ui/button";
import { DropdownContent, DropdownItem, DropdownMenu, DropdownTrigger } from "@/components/ui/dropdown";
import { State } from "@/components/ui/state";
import type { Transaction } from "@/lib/api/schemas/models";
import { display, formatDate, formatMoney } from "@/lib/format";

interface ColumnOptions {
  onView: (tx: Transaction) => void;
  onRefund?: (tx: Transaction) => void;
}

/** Ledger columns: when, who, how much, what state. */
export function transactionColumns({ onView, onRefund }: ColumnOptions): ColumnDef<Transaction, unknown>[] {
  return [
    {
      id: "createdAt",
      header: "Date",
      accessorFn: (t) => t.createdAt ?? "",
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      id: "counterparty",
      header: "Counterparty",
      accessorFn: (t) => `${t.accountName ?? ""} ${t.accountNumberMasked ?? ""}`,
      cell: ({ row }) => (
        <span className="block max-w-56 truncate">
          {row.original.accountName ?? "Not provided"}
          {row.original.accountNumberMasked && (
            <span className="text-ink-soft"> · {row.original.accountNumberMasked}</span>
          )}
        </span>
      ),
    },
    {
      id: "amount",
      header: "Amount",
      accessorFn: (t) => t.amount ?? 0,
      cell: ({ row }) => <span className="figure">{formatMoney(row.original.amount, row.original.currency)}</span>,
    },
    { id: "status", header: "State", accessorFn: (t) => t.status ?? "", cell: ({ row }) => <State status={row.original.status} /> },
    { id: "type", header: "Type", accessorFn: (t) => t.type ?? "", cell: ({ getValue }) => <span className="capitalize">{display(getValue())}</span> },
    {
      id: "fee",
      header: "Fee",
      accessorFn: (t) => t.fee ?? 0,
      cell: ({ row }) => <span className="figure text-ink-soft">{formatMoney(row.original.fee, row.original.currency)}</span>,
    },
    {
      id: "netAmount",
      header: "Net",
      accessorFn: (t) => t.netAmount ?? 0,
      cell: ({ row }) => <span className="figure">{formatMoney(row.original.netAmount, row.original.currency)}</span>,
    },
    { id: "institutionCode", header: "Institution", accessorFn: (t) => t.institutionCode ?? "", cell: ({ getValue }) => display(getValue()) },
    {
      id: "reference",
      header: "Reference",
      accessorFn: (t) => t.reference ?? "",
      cell: ({ getValue }) => <span className="block max-w-40 truncate">{display(getValue())}</span>,
    },
    {
      id: "clientTransactionId",
      header: "Your reference",
      accessorFn: (t) => t.clientTransactionId ?? "",
      cell: ({ getValue }) => <Ref>{display(getValue())}</Ref>,
    },
    { id: "id", header: "Transaction ID", accessorFn: (t) => t.id, cell: ({ getValue }) => <Ref>{display(getValue())}</Ref> },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Record actions">
                <MoreHorizontal />
              </Button>
            </DropdownTrigger>
            <DropdownContent>
              <DropdownItem onSelect={() => onView(row.original)}>
                <Eye /> Open record
              </DropdownItem>
              {onRefund && (
                <DropdownItem onSelect={() => onRefund(row.original)}>
                  <RotateCcw /> Request refund
                </DropdownItem>
              )}
            </DropdownContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];
}

export const TRANSACTION_CSV_HEADERS = [
  "Date", "Updated", "Type", "State", "Amount", "Currency", "Fee", "Net", "Platform fee", "Refunded",
  "Transaction ID", "Your reference", "Provider ID", "Account name", "Account", "Institution", "Reference", "Provider message",
];

export function transactionCsvRow(t: Transaction): unknown[] {
  return [
    t.createdAt, t.updatedAt, t.type, t.status, t.amount, t.currency, t.fee, t.netAmount, t.platformFee, t.refundedAmount,
    t.id, t.clientTransactionId, t.providerTransactionId, t.accountName, t.accountNumberMasked, t.institutionCode, t.reference, t.providerMessage,
  ];
}
