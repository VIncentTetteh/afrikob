"use client";

import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: "md" | "lg";
}

/**
 * Right-hand side sheet: details open beside the ledger so an operator keeps
 * their place. On phones it becomes a full-height sheet from the bottom.
 */
export function Sheet({ open, onOpenChange, title, description, children, footer, width = "md" }: SheetProps) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-ink/35 backdrop-blur-[2px]" />
        <D.Content
          className={cn(
            "fixed z-50 flex flex-col bg-paper text-ink shadow-[var(--shadow-sheet)] focus:outline-none",
            "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl",
            "sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-full sm:rounded-none sm:border-l sm:border-line",
            width === "lg" ? "sm:max-w-3xl" : "sm:max-w-xl",
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <D.Title className="text-lg font-semibold tracking-tight">{title}</D.Title>
              {description ? (
                <D.Description className="mt-0.5 text-sm text-ink-soft">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">Details</D.Description>
              )}
            </div>
            <D.Close className="rounded-md p-1.5 text-ink-soft hover:bg-field" aria-label="Close">
              <X className="size-5" />
            </D.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
              {footer}
            </div>
          )}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
