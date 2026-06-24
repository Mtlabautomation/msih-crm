"use client";

// MSIH CRM V1.0 — Navigation configuration
// Developer: Manoj Dore

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Inbox, PhoneCall, Package, Users, BarChart3, BrainCircuit,
  TrendingUp, FileText, ArrowUpDown, ShieldCheck, Boxes, ScrollText, Trash2,
  Settings, ArrowLeftRight, LayoutGrid, UserRound, FileSignature, ListChecks,
  Building2, CalendarDays, Mail, BellRing,
} from "lucide-react";
import type { ViewKey } from "@/lib/store";

export interface NavItem {
  key: ViewKey;
  label: string;
  icon: LucideIcon;
  roles: string[]; // allowed roles
  group: string;
  badge?: "hot" | "overdue";
}

export const NAV_ITEMS: NavItem[] = [
  // Workspace
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "EXECUTIVE"], group: "Workspace" },
  { key: "command-center", label: "Command Center", icon: LayoutGrid, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"], group: "Workspace" },

  // Sales
  { key: "enquiries", label: "Enquiries", icon: Inbox, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "EXECUTIVE"], group: "Sales", badge: "hot" },
  { key: "followups", label: "Follow-Ups", icon: PhoneCall, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "EXECUTIVE"], group: "Sales", badge: "overdue" },
  { key: "calendar", label: "Calendar", icon: CalendarDays, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "EXECUTIVE"], group: "Sales" },
  { key: "quotations", label: "Quotations", icon: FileSignature, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "EXECUTIVE"], group: "Sales" },
  { key: "customers", label: "Customers", icon: Building2, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "EXECUTIVE"], group: "Sales" },
  { key: "tasks", label: "Tasks", icon: ListChecks, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "EXECUTIVE"], group: "Sales", badge: "hot" },
  { key: "reminders", label: "Reminder Queue", icon: BellRing, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "EXECUTIVE"], group: "Sales" },
  { key: "products", label: "Product Catalogue", icon: Package, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "EXECUTIVE"], group: "Sales" },

  // Intelligence
  { key: "performance", label: "Employee Performance", icon: Users, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"], group: "Intelligence" },
  { key: "ai-assistant", label: "AI Sales Assistant", icon: BrainCircuit, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "EXECUTIVE"], group: "Intelligence" },
  { key: "forecasting", label: "Forecasting", icon: TrendingUp, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"], group: "Intelligence" },

  // Reports
  { key: "reports", label: "Reports", icon: FileText, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "EXECUTIVE"], group: "Reports" },
  { key: "import-export", label: "Import / Export", icon: ArrowUpDown, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"], group: "Reports" },

  // Admin
  { key: "admin-users", label: "User Management", icon: ShieldCheck, roles: ["SUPER_ADMIN", "ADMIN"], group: "Administration" },
  { key: "admin-products", label: "Product Management", icon: Boxes, roles: ["SUPER_ADMIN", "ADMIN"], group: "Administration" },
  { key: "email-templates", label: "Email Templates", icon: Mail, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "EXECUTIVE"], group: "Administration" },
  { key: "admin-transfers", label: "Lead Transfers", icon: ArrowLeftRight, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"], group: "Administration" },
  { key: "admin-deletions", label: "Deletion Requests", icon: Trash2, roles: ["SUPER_ADMIN", "ADMIN"], group: "Administration" },
  { key: "admin-audit", label: "Audit Logs", icon: ScrollText, roles: ["SUPER_ADMIN", "ADMIN"], group: "Administration" },
  { key: "admin-settings", label: "Settings", icon: Settings, roles: ["SUPER_ADMIN", "ADMIN"], group: "Administration" },

  // Account
  { key: "profile", label: "My Profile", icon: UserRound, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "EXECUTIVE"], group: "Account" },
];

export function navForRole(role: string): NavItem[] {
  return NAV_ITEMS.filter((n) => n.roles.includes(role));
}

export const VIEW_LABELS: Record<string, string> = Object.fromEntries(
  NAV_ITEMS.map((n) => [n.key, n.label])
);
