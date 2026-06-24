"use client";

// MSIH CRM V1.0 — Top header bar
// Developer: Manoj Dore

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUI } from "@/lib/store";
import { VIEW_LABELS } from "./nav-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Menu, Search, Sun, Moon, Bell, LogOut, UserRound, Settings, Command,
  ChevronDown, Keyboard, Sparkles,
  Plus, Pencil, Trash2, LogIn, LogOut as LogOutIcon, CheckCircle2, XCircle,
  ArrowLeftRight, Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api, timeAgo } from "@/lib/api-client";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";

/* ---------- Notification type + action styling ---------- */

interface NotificationItem {
  id: string;
  action: string;
  entity: string;
  description: string;
  userName: string;
  createdAt: string;
}

const ACTION_STYLE: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  CREATE:   { icon: Plus,           color: "text-emerald-600 dark:text-emerald-400",   bg: "bg-emerald-500/10 ring-emerald-500/20" },
  UPDATE:   { icon: Pencil,         color: "text-sky-600 dark:text-sky-400",           bg: "bg-sky-500/10 ring-sky-500/20" },
  DELETE:   { icon: Trash2,         color: "text-rose-600 dark:text-rose-400",         bg: "bg-rose-500/10 ring-rose-500/20" },
  LOGIN:    { icon: LogIn,          color: "text-sky-600 dark:text-sky-400",           bg: "bg-sky-500/10 ring-sky-500/20" },
  LOGOUT:   { icon: LogOutIcon,     color: "text-slate-600 dark:text-slate-400",       bg: "bg-slate-500/10 ring-slate-500/20" },
  APPROVE:  { icon: CheckCircle2,   color: "text-emerald-600 dark:text-emerald-400",   bg: "bg-emerald-500/10 ring-emerald-500/20" },
  REJECT:   { icon: XCircle,        color: "text-rose-600 dark:text-rose-400",         bg: "bg-rose-500/10 ring-rose-500/20" },
  TRANSFER: { icon: ArrowLeftRight, color: "text-violet-600 dark:text-violet-400",     bg: "bg-violet-500/10 ring-violet-500/20" },
};

const DEFAULT_ACTION_STYLE = {
  icon: Bell,
  color: "text-slate-600 dark:text-slate-400",
  bg: "bg-slate-500/10 ring-slate-500/20",
};

function truncate(s: string, max = 60): string {
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function NotificationsBell() {
  const { setView } = useUI();
  const [open, setOpen] = useState(false);

  const { data, isLoading, error } = useQuery<NotificationItem[]>({
    queryKey: ["notifications"],
    queryFn: () => api<NotificationItem[]>("/api/notifications?limit=25"),
    refetchInterval: 60_000, // refetch every 60s for a live feel
    staleTime: 30_000,
  });

  // Surface a toast on fetch errors (but suppress on first load to avoid noise)
  useEffect(() => {
    if (error && data !== undefined) {
      toast.error("Couldn't load recent activity", { description: (error as Error).message });
    }
  }, [error, data]);

  const items = data ?? [];

  // "Unread" badge = events created within the last hour (client-side computation)
  const recentCount = useMemo(() => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    return items.filter((n) => new Date(n.createdAt).getTime() >= oneHourAgo).length;
  }, [items]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-tour="notifications-bell"
          aria-label={recentCount > 0 ? `${recentCount} new notifications` : "Notifications"}
        >
          <Bell className="h-5 w-5" />
          {recentCount > 0 && (
            <span
              aria-label={`${recentCount} new notifications`}
              className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white ring-2 ring-background"
            >
              {recentCount > 9 ? "9+" : recentCount}
            </span>
          )}
          {recentCount === 0 && items.length > 0 && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] max-w-[calc(100vw-2rem)] p-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Recent Activity</span>
            {recentCount > 0 && (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-medium">
                {recentCount} new
              </Badge>
            )}
          </div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
        </div>

        {/* List */}
        <div className="max-h-[420px] overflow-y-auto scroll-thin">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-muted" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                    <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted/70" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Inbox className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium text-foreground">No recent activity</p>
              <p className="text-xs text-muted-foreground">
                Actions you take across the CRM will appear here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {items.map((n) => {
                const style = ACTION_STYLE[n.action] || DEFAULT_ACTION_STYLE;
                const Icon = style.icon;
                return (
                  <li
                    key={n.id}
                    className="group flex items-start gap-2.5 px-3.5 py-2.5 transition-colors hover:bg-accent/40"
                  >
                    <span
                      className={cn(
                        "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
                        style.bg,
                        style.color
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs leading-snug text-foreground">
                        {truncate(n.description, 60)}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <Badge
                          variant="outline"
                          className="px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                          {n.entity || "—"}
                        </Badge>
                        <span aria-hidden>·</span>
                        <span title={new Date(n.createdAt).toLocaleString()}>
                          {timeAgo(n.createdAt)}
                        </span>
                        {n.userName && (
                          <>
                            <span aria-hidden>·</span>
                            <span className="truncate">{n.userName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-2 py-1.5">
          <button
            onClick={() => {
              setOpen(false);
              setView("admin-audit");
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
          >
            View all in Audit Logs
            <ChevronDown className="h-3 w-3 -rotate-90" />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface HeaderProps {
  onOpenShortcuts?: () => void;
}

export function Header({ onOpenShortcuts }: HeaderProps = {}) {
  const { data: session } = useSession();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { setSidebarOpen, view, setCommandOpen, setView } = useUI();
  const startTour = useUI((s) => s.startTour);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // hydration guard for next-themes toggle
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const user = session?.user as any;
  const role = user?.role || "EXECUTIVE";
  const initials = (user?.name || "?")
    .split(" ")
    .map((s: string) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
      {/* mobile menu */}
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open navigation menu">
        <Menu className="h-5 w-5" />
      </Button>

      {/* current view label */}
      <div className="hidden items-center gap-2 sm:flex">
        <h2 className="text-sm font-semibold text-foreground">{VIEW_LABELS[view] || "Dashboard"}</h2>
        <Badge variant="outline" className="hidden text-[10px] font-medium uppercase tracking-wide text-muted-foreground md:inline-flex">
          {role.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* search */}
      <div className="relative ml-auto w-full max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search enquiries, customers, products…"
          className="h-9 pl-9 pr-12"
          onFocus={() => setCommandOpen(true)}
          readOnly
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 select-none items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:flex">
          <Command className="h-3 w-3" />K
        </kbd>
      </div>

      {/* theme toggle */}
      <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">
        {mounted && theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </Button>

      {/* keyboard shortcuts hint */}
      {onOpenShortcuts && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenShortcuts}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard className="h-5 w-5" />
        </Button>
      )}

      {/* notifications */}
      <NotificationsBell />

      {/* user menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-lg p-1 pr-2 transition hover:bg-accent">
            <Avatar className="h-8 w-8 border">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials}</AvatarFallback>
            </Avatar>
            <div className="hidden text-left leading-tight sm:block">
              <p className="text-xs font-semibold text-foreground">{user?.name}</p>
              <p className="text-[10px] text-muted-foreground">{user?.email}</p>
            </div>
            <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <p className="text-sm font-semibold">{user?.name}</p>
            <p className="text-xs font-normal text-muted-foreground">{role.replace(/_/g, " ")}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setView("profile")}>
            <UserRound className="mr-2 h-4 w-4" /> My Profile
          </DropdownMenuItem>
          {(role === "ADMIN" || role === "SUPER_ADMIN") && (
            <DropdownMenuItem onClick={() => setView("admin-settings")}>
              <Settings className="mr-2 h-4 w-4" /> Settings
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => startTour()}
            className="text-primary focus:text-primary"
          >
            <Sparkles className="mr-2 h-4 w-4" /> Take Tour
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-600 focus:text-red-600"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
