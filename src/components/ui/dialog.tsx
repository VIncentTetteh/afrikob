"use client";

import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md";
}

/** Centered dialog, kept for decisions that must interrupt (confirmations, revealed keys). */
export function Dialog({ open, onOpenChange, title, description, children, footer, size = "sm" }: DialogProps) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-ink/35 backdrop-blur-[2px]" />
        <D.Content
          className={cn(
            "fixed z-50 flex max-h-[92dvh] w-full flex-col bg-paper text-ink shadow-[var(--shadow-sheet)] focus:outline-none",
            "inset-x-0 bottom-0 rounded-t-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl",
            size === "md" ? "sm:max-w-xl" : "sm:max-w-md",
          )}
        >
          <div className="flex items-start justify-between gap-4 px-5 pb-1 pt-5">
            <div className="min-w-0">
              <D.Title className="text-lg font-semibold tracking-tight">{title}</D.Title>
              {description ? (
                <D.Description className="mt-0.5 text-sm text-ink-soft">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">Dialog</D.Description>
              )}
            </div>
            <D.Close className="rounded-md p-1.5 text-ink-soft hover:bg-field" aria-label="Close">
              <X className="size-5" />
            </D.Close>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
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
