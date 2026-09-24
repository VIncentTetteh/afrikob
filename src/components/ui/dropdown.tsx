"use client";

import * as M from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const DropdownMenu = M.Root;
export const DropdownTrigger = M.Trigger;

export function DropdownContent({ children, align = "end" }: { children: ReactNode; align?: "start" | "end" }) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={6}
        className="z-50 min-w-44 rounded-xl border border-border bg-card p-1 text-sm shadow-lg"
      >
        {children}
      </M.Content>
    </M.Portal>
  );
}

export function DropdownItem({
  children,
  onSelect,
  destructive,
  disabled,
}: {
  children: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <M.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-muted [&_svg]:size-4",
        destructive && "text-danger",
      )}
    >
      {children}
    </M.Item>
  );
}

export function DropdownCheckbox({
  checked,
  onCheckedChange,
  children,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <M.CheckboxItem
      checked={checked}
      onCheckedChange={onCheckedChange}
      onSelect={(e) => e.preventDefault()}
      className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 outline-none data-[highlighted]:bg-muted"
    >
      <span className={cn("size-4 rounded border border-border", checked && "border-primary bg-primary")} aria-hidden />
      {children}
    </M.CheckboxItem>
  );
}

export const DropdownLabel = ({ children }: { children: ReactNode }) => (
  <M.Label className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</M.Label>
);
export const DropdownSeparator = () => <M.Separator className="my-1 h-px bg-border" />;
