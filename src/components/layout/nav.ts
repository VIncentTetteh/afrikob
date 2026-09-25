import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Code2,
  FileSpreadsheet,
  Gauge,
  Inbox,
  RotateCcw,
  SearchCheck,
  ShieldCheck,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";
import { TENANT_REFUNDS_AVAILABLE } from "@/lib/api/features";
import type { Role } from "@/lib/session/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the phone tab bar (space for five at most). */
  primary?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/** A tenant's own screens, shared by every tenant user and their administrators. */
const moneySections: NavSection[] = [
  { title: "Money", items: [
    { href: "/dashboard", label: "Overview", icon: Gauge, primary: true },
    { href: "/collections", label: "Collections", icon: ArrowDownLeft, primary: true },
    { href: "/disbursements", label: "Disbursements", icon: ArrowUpRight, primary: true },
    { href: "/disbursements/bulk", label: "Bulk disbursements", icon: FileSpreadsheet },
  ] },
  { title: "Tools", items: [
    ...(TENANT_REFUNDS_AVAILABLE ? [{ href: "/refunds", label: "Refunds", icon: RotateCcw, primary: true }] : []),
    { href: "/status-check", label: "Status check", icon: SearchCheck, primary: !TENANT_REFUNDS_AVAILABLE },
    { href: "/developers", label: "Developers", icon: Code2 },
  ] },
];

/** What a tenant's administrator adds on top: their organisation, people and approvals. */
const organisationSection: NavSection = { title: "Organisation", items: [
  { href: "/tenant-admin", label: "Organisation", icon: Store },
  { href: "/tenant-admin/approvals", label: "Approvals", icon: Inbox },
  { href: "/tenant-admin/people", label: "People", icon: Users },
] };

const adminNav: NavSection[] = [
  { title: "Platform", items: [
    { href: "/admin", label: "Overview", icon: Gauge, primary: true },
    { href: "/admin/tenants", label: "Tenants", icon: Building2, primary: true },
    { href: "/admin/reports", label: "Reports", icon: FileSpreadsheet, primary: true },
  ] },
  { title: "Controls", items: [
    { href: "/admin/approvals", label: "Approvals", icon: Inbox, primary: true },
    { href: "/admin/refunds", label: "Refunds", icon: RotateCcw },
    { href: "/admin/users", label: "People", icon: Users },
    { href: "/admin/approval-policies", label: "Approval rules", icon: ShieldCheck },
    { href: "/developers", label: "Developers", icon: Code2 },
  ] },
];

export function navFor(role: Role): NavSection[] {
  if (role === "platform") return adminNav;
  if (role === "tenant-admin") return [...moneySections, organisationSection];
  return moneySections;
}

export function primaryNavFor(role: Role): NavItem[] {
  return navFor(role).flatMap((s) => s.items.filter((i) => i.primary));
}

/** Longest-prefix match so /disbursements/bulk doesn't also light up /disbursements. */
export function activeHref(pathname: string, sections: NavSection[]): string | null {
  const hrefs = sections.flatMap((s) => s.items.map((i) => i.href));
  const matches = hrefs.filter((h) => pathname === h || (h !== "/admin" && h !== "/dashboard" && pathname.startsWith(`${h}/`)));
  return matches.sort((a, b) => b.length - a.length)[0] ?? null;
}
