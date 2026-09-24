import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
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
import type { AuthMode, Role } from "@/lib/session/types";

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

/** The money screens, shared by merchants and tenant admins. */
const moneySections: NavSection[] = [
  { title: "Money", items: [
    { href: "/dashboard", label: "Overview", icon: Gauge, primary: true },
    { href: "/collections", label: "Collections", icon: ArrowDownLeft, primary: true },
    { href: "/disbursements", label: "Payouts", icon: ArrowUpRight, primary: true },
    { href: "/disbursements/bulk", label: "Bulk payouts", icon: FileSpreadsheet },
  ] },
  { title: "Tools", items: [
    { href: "/refunds", label: "Refunds", icon: RotateCcw, primary: true },
    { href: "/status-check", label: "Status check", icon: SearchCheck },
  ] },
];

/**
 * A tenant's own administrator. They sign in with a password, and the gateway
 * refuses money endpoints for a password session, so these people run the
 * business: their tenant, their people, their approvals.
 */
const tenantAdminNav: NavSection[] = [
  { title: "Your business", items: [
    { href: "/tenant-admin", label: "Tenant", icon: Store, primary: true },
    { href: "/tenant-admin/approvals", label: "Approvals", icon: Inbox, primary: true },
    { href: "/tenant-admin/people", label: "People", icon: Users, primary: true },
  ] },
];

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
  ] },
];

export function navFor(role: Role, mode: AuthMode = "apikey"): NavSection[] {
  if (role === "platform") return adminNav;
  if (role === "tenant-admin") return tenantAdminNav;
  // An ordinary tenant only has screens when it holds an API key.
  return mode === "apikey" ? moneySections : [];
}

export function primaryNavFor(role: Role, mode: AuthMode = "apikey"): NavItem[] {
  return navFor(role, mode).flatMap((s) => s.items.filter((i) => i.primary));
}

/** Longest-prefix match so /disbursements/bulk doesn't also light up /disbursements. */
export function activeHref(pathname: string, sections: NavSection[]): string | null {
  const hrefs = sections.flatMap((s) => s.items.map((i) => i.href));
  const matches = hrefs.filter((h) => pathname === h || (h !== "/admin" && h !== "/dashboard" && pathname.startsWith(`${h}/`)));
  return matches.sort((a, b) => b.length - a.length)[0] ?? null;
}
