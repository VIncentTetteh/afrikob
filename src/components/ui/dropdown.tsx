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
        className="z-[60] min-w-44 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-paper p-1 text-sm shadow-lg"
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
        "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-field [&_svg]:size-4",
        destructive && "text-failed",
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
      className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 outline-none data-[highlighted]:bg-field"
    >
      <span className={cn("size-4 rounded border border-line", checked && "border-accent bg-accent")} aria-hidden />
      {children}
    </M.CheckboxItem>
  );
}

export const DropdownLabel = ({ children }: { children: ReactNode }) => (
  <M.Label className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">{children}</M.Label>
);
export const DropdownSeparator = () => <M.Separator className="my-1 h-px bg-line" />;
