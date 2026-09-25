"use client";

import * as T from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Tabs = T.Root;
export const TabsContent = T.Content;

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <T.List className={cn("inline-flex gap-1 rounded-xl bg-field p-1", className)}>{children}</T.List>
    </div>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  return (
    <T.Trigger
      value={value}
      className="whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium text-ink-soft transition data-[state=active]:bg-paper data-[state=active]:text-ink data-[state=active]:shadow-sm"
    >
      {children}
    </T.Trigger>
  );
}
