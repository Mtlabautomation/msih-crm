"use client";

// MSIH CRM V1.0 — Sidebar navigation
// Developer: Manoj Dore

import { useSession } from "next-auth/react";
import { useUI } from "@/lib/store";
import { navForRole } from "./nav-config";
import { cn } from "@/lib/utils";
import { Microscope, X, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";

export function Sidebar() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role || "EXECUTIVE";
  const { view, setView, sidebarOpen, setSidebarOpen } = useUI();

  const items = navForRole(role);
  const groups = Array.from(new Set(items.map((i) => i.group)));

  // badge counts
  const { data: dash } = useQuery({
    queryKey: ["dashboard", role],
    queryFn: () => api<any>("/api/dashboard"),
    refetchInterval: 60000,
  });
  const { data: fu } = useQuery({
    queryKey: ["followups-overview"],
    queryFn: () => api<any>("/api/followups?bucket=today"),
    refetchInterval: 60000,
  });
  const { data: tasksData } = useQuery({
    queryKey: ["tasks-overview"],
    queryFn: () => api<any>("/api/tasks?status=pending"),
    refetchInterval: 60000,
  });
  const hotCount = dash?.kpis?.todayEnquiries ?? 0;
  const overdueCount = dash?.kpis?.overdueFollowUps ?? 0;
  const todayFuCount = fu?.followUps?.length ?? 0;
  const openTasks = tasksData?.total ?? 0;

  const badgeFor = (key: string): { text: string; cls: string } | null => {
    if (key === "enquiries" && hotCount > 0) return { text: String(hotCount), cls: "bg-sky-500/15 text-sky-600 dark:text-sky-400" };
    if (key === "followups" && (overdueCount > 0 || todayFuCount > 0))
      return { text: String(overdueCount > 0 ? overdueCount : todayFuCount), cls: overdueCount > 0 ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400" };
    if (key === "tasks" && openTasks > 0) return { text: String(openTasks), cls: "bg-violet-500/15 text-violet-600 dark:text-violet-400" };
    return null;
  };

  return (
    <>
      {/* mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside
        aria-label="Primary navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between gap-2 border-b border-sidebar-border px-5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-primary/15 p-1.5 text-primary ring-1 ring-primary/25">
              <Microscope className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-sidebar-foreground">MSIH CRM</p>
              <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">MetTechnik · V1.0</p>
            </div>
          </div>
          <button className="rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav
          data-tour="sidebar-nav"
          className="flex-1 overflow-y-auto px-3 py-4 [scrollbar-width:thin]"
          aria-label="Main"
        >
          {groups.map((group) => (
            <div key={group} className="mb-4">
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">{group}</p>
              <div className="space-y-0.5">
                {items
                  .filter((i) => i.group === group)
                  .map((item) => {
                    const active = view === item.key;
                    const b = badgeFor(item.key);
                    return (
                      <button
                        key={item.key}
                        onClick={() => setView(item.key)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                          active
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        {/* Active indicator bar (left edge) */}
                        {active && (
                          <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary-foreground/80" aria-hidden />
                        )}
                        <item.icon className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-110", active ? "text-primary-foreground" : "text-sidebar-foreground/60 group-hover:text-sidebar-accent-foreground")} />
                        <span className="flex-1 text-left truncate">{item.label}</span>
                        {b && (
                          <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", active ? "bg-primary-foreground/20 text-primary-foreground" : b.cls)}>
                            {b.text}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent/60 px-3 py-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-sidebar-foreground">{session?.user?.name}</p>
              <p className="truncate text-[10px] text-sidebar-foreground/60">{role.replace(/_/g, " ")}</p>
            </div>
          </div>
          <p className="mt-2 text-center text-[10px] text-sidebar-foreground/40">MIT · Open Source · Manoj Dore</p>
        </div>
      </aside>
    </>
  );
}
