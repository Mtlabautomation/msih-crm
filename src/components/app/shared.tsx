"use client";

// MSIH CRM V1.0 — Shared UI building blocks
// Developer: Manoj Dore

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton as ShadcnSkeleton } from "@/components/ui/skeleton";
import { statusColor, roleColor } from "@/lib/api-client";
import type { LucideIcon } from "lucide-react";
import { ArrowUp } from "lucide-react";
import type { ReactNode } from "react";

/* ---------- KPI Card ---------- */
export function KpiCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = "blue",
  trend,
  spark,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  hint?: string;
  accent?: "blue" | "emerald" | "amber" | "red" | "violet" | "cyan" | "slate";
  trend?: { value: number; up: boolean };
  spark?: number[]; // optional mini-trend data (e.g. last 7 days)
}) {
  const accents: Record<string, { ring: string; bar: string; glow: string }> = {
    blue: { ring: "from-sky-500/15 to-sky-500/0 text-sky-600 dark:text-sky-400 ring-sky-500/25", bar: "bg-sky-500", glow: "group-hover:shadow-sky-500/10" },
    emerald: { ring: "from-emerald-500/15 to-emerald-500/0 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25", bar: "bg-emerald-500", glow: "group-hover:shadow-emerald-500/10" },
    amber: { ring: "from-amber-500/15 to-amber-500/0 text-amber-600 dark:text-amber-400 ring-amber-500/25", bar: "bg-amber-500", glow: "group-hover:shadow-amber-500/10" },
    red: { ring: "from-red-500/15 to-red-500/0 text-red-600 dark:text-red-400 ring-red-500/25", bar: "bg-red-500", glow: "group-hover:shadow-red-500/10" },
    violet: { ring: "from-violet-500/15 to-violet-500/0 text-violet-600 dark:text-violet-400 ring-violet-500/25", bar: "bg-violet-500", glow: "group-hover:shadow-violet-500/10" },
    cyan: { ring: "from-cyan-500/15 to-cyan-500/0 text-cyan-600 dark:text-cyan-400 ring-cyan-500/25", bar: "bg-cyan-500", glow: "group-hover:shadow-cyan-500/10" },
    slate: { ring: "from-slate-500/15 to-slate-500/0 text-slate-600 dark:text-slate-400 ring-slate-500/25", bar: "bg-slate-500", glow: "group-hover:shadow-slate-500/10" },
  };
  const a = accents[accent];
  // build mini sparkline bars
  const sparkData = spark && spark.length > 1 ? spark : null;
  const sparkMax = sparkData ? Math.max(...sparkData, 1) : 0;
  return (
    <Card className={cn("group relative overflow-hidden p-5 gap-0 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5", a.glow)}>
      {/* Decorative gradient orb in top-right */}
      <div className={cn("pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br opacity-40 blur-2xl transition-opacity duration-300 group-hover:opacity-70", a.ring)} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground truncate">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          {trend && (
            <p className={cn("mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold", trend.up ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400")}>
              <span aria-hidden>{trend.up ? "▲" : "▼"}</span> {Math.abs(trend.value)}% <span className="font-normal text-muted-foreground">vs last period</span>
            </p>
          )}
        </div>
        <div className={cn("shrink-0 rounded-xl bg-gradient-to-b p-2.5 ring-1 transition-transform duration-300 group-hover:scale-105", a.ring)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {/* Sparkline bars */}
      {sparkData && (
        <div className="relative mt-3 flex h-8 items-end gap-0.5" aria-hidden>
          {sparkData.map((v, i) => (
            <div
              key={i}
              className={cn("flex-1 rounded-sm opacity-70 transition-all duration-300 group-hover:opacity-100", a.bar)}
              style={{ height: `${Math.max(8, (v / sparkMax) * 100)}%` }}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

/* ---------- Status Badge ---------- */
export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", statusColor(status))}>
      {status?.replace(/_/g, " ")}
    </span>
  );
}

/* ---------- Role Badge ---------- */
export function RoleBadge({ role }: { role: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", roleColor(role))}>
      {role?.replace(/_/g, " ")}
    </span>
  );
}

/* ---------- Page Header ---------- */
export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  accent = "primary",
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  /** Visual accent for the icon tile. Use "primary" for sky (default), or a specific hue. */
  accent?: "primary" | "emerald" | "amber" | "violet" | "rose" | "cyan";
}) {
  const accentMap: Record<string, { tile: string; line: string }> = {
    primary: {
      tile: "from-sky-500/20 via-sky-500/10 to-sky-500/0 text-sky-600 dark:text-sky-400 ring-sky-500/25",
      line: "from-sky-500/40 via-sky-500/10 to-transparent",
    },
    emerald: {
      tile: "from-emerald-500/20 via-emerald-500/10 to-emerald-500/0 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25",
      line: "from-emerald-500/40 via-emerald-500/10 to-transparent",
    },
    amber: {
      tile: "from-amber-500/20 via-amber-500/10 to-amber-500/0 text-amber-600 dark:text-amber-400 ring-amber-500/25",
      line: "from-amber-500/40 via-amber-500/10 to-transparent",
    },
    violet: {
      tile: "from-violet-500/20 via-violet-500/10 to-violet-500/0 text-violet-600 dark:text-violet-400 ring-violet-500/25",
      line: "from-violet-500/40 via-violet-500/10 to-transparent",
    },
    rose: {
      tile: "from-rose-500/20 via-rose-500/10 to-rose-500/0 text-rose-600 dark:text-rose-400 ring-rose-500/25",
      line: "from-rose-500/40 via-rose-500/10 to-transparent",
    },
    cyan: {
      tile: "from-cyan-500/20 via-cyan-500/10 to-cyan-500/0 text-cyan-600 dark:text-cyan-400 ring-cyan-500/25",
      line: "from-cyan-500/40 via-cyan-500/10 to-transparent",
    },
  };
  const a = accentMap[accent];
  return (
    <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Subtle gradient divider line under header */}
      <div
        className={cn(
          "pointer-events-none absolute -bottom-2 left-0 right-0 h-px bg-gradient-to-r",
          a.line
        )}
        aria-hidden
      />
      <div className="flex items-start gap-3">
        {Icon && (
          <div
            className={cn(
              "relative shrink-0 overflow-hidden rounded-xl bg-gradient-to-br p-2.5 ring-1 shadow-sm transition-transform duration-300 hover:scale-105",
              a.tile
            )}
          >
            {/* Inner highlight */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent" aria-hidden />
            <Icon className="relative h-5 w-5" />
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- Empty State ---------- */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="relative flex flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border border-dashed border-muted-foreground/30 py-16 text-center">
      {/* Subtle radial backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-muted/40 via-transparent to-muted/20" aria-hidden />
      {/* Dotted grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(circle, hsl(var(--muted-foreground) / 0.15) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      />
      {/* Primary glow orb */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-[120%] rounded-full bg-primary/5 blur-2xl" aria-hidden />
      {/* Secondary smaller orb */}
      <div className="pointer-events-none absolute right-1/4 bottom-1/4 h-16 w-16 rounded-full bg-violet-500/5 blur-xl" aria-hidden />
      <div className="relative rounded-2xl bg-gradient-to-b from-muted to-muted/50 p-4 text-muted-foreground ring-1 ring-muted-foreground/10 shadow-sm">
        <Icon className="h-7 w-7" />
      </div>
      <div className="relative">
        <p className="font-semibold text-foreground">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>}
      </div>
      {action && <div className="relative">{action}</div>}
    </div>
  );
}

/* ---------- Loading ---------- */
export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-20">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

export function CardSkeleton() {
  return <ShadcnSkeleton className="h-28 w-full rounded-xl" />;
}

/* ---------- Skeleton primitives ---------- */
// Re-exported shadcn Skeleton with our muted/60 base. Callers can override via className.
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <ShadcnSkeleton className={cn("bg-muted/60", className)} {...props} />;
}

/* KPI card skeleton — icon tile + 2 lines */
export function KpiSkeleton() {
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-3 w-16 opacity-70" />
        </div>
        <Skeleton className="h-11 w-11 rounded-xl opacity-80" />
      </div>
    </Card>
  );
}

/* Enquiry/card skeleton — icon tile + company line + 2 metadata lines */
export function EnquiryCardSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2 opacity-80" />
          <div className="flex flex-wrap gap-2 pt-1">
            <Skeleton className="h-4 w-16 rounded-full opacity-70" />
            <Skeleton className="h-4 w-12 rounded-full opacity-60" />
          </div>
          <Skeleton className="h-3 w-2/3 opacity-70" />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2">
        <Skeleton className="h-3 w-20 opacity-70" />
        <Skeleton className="h-3 w-24 opacity-60" />
      </div>
    </Card>
  );
}

/* Row skeleton for table-style views */
export function TableRowSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
      <Skeleton className="h-4 w-4 rounded" />
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4 opacity-80"
          style={{ flex: 1, maxWidth: 120 + (i * 20) }}
        />
      ))}
    </div>
  );
}

/* Chart placeholder — rounded box with subtle pulse + fake axes lines */
export function ChartSkeleton({ height = 260, className }: { height?: number; className?: string }) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="mb-3 flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20 opacity-70" />
        </div>
        <Skeleton className="h-7 w-7 rounded-md opacity-60" />
      </div>
      <div className="relative rounded-lg bg-muted/20" style={{ height }}>
        {/* Fake axes */}
        <div className="absolute left-0 top-0 h-full w-px bg-muted-foreground/20" />
        <div className="absolute bottom-0 left-0 h-px w-full bg-muted-foreground/20" />
        {/* Fake grid lines */}
        {[0.25, 0.5, 0.75].map((p) => (
          <div
            key={p}
            className="absolute left-0 w-full border-t border-dashed border-muted-foreground/10"
            style={{ top: `${p * 100}%` }}
          />
        ))}
        {/* Fake area bars — staggered heights + opacities for a natural look */}
        <div className="absolute inset-0 flex items-end justify-around gap-1.5 px-2 pb-1 pt-6">
          {[40, 65, 50, 80, 60, 90, 70, 55, 75, 45, 85, 60].map((h, i) => (
            <Skeleton
              key={i}
              className="flex-1 rounded-t-sm"
              style={{ height: `${h}%`, opacity: 0.35 + (h / 200) }}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

/* Kanban column skeleton — column header + N placeholder cards */
export function KanbanColumnSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3 border-t-4 border-t-slate-300">
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-5 w-6 rounded-full opacity-70" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-3">
            <div className="flex items-start justify-between gap-2">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-12 rounded opacity-70" />
            </div>
            <Skeleton className="mt-2 h-3 w-3/4 opacity-80" />
            <div className="mt-2 flex gap-2">
              <Skeleton className="h-3 w-16 opacity-70" />
              <Skeleton className="h-3 w-12 opacity-60" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* List skeleton — renders N card/row skeletons */
export function ListSkeleton({
  count = 5,
  variant = "card",
}: {
  count?: number;
  variant?: "card" | "row";
}) {
  if (variant === "row") {
    return (
      <Card className="overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b border-border/60 bg-muted/30 px-4 py-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1 opacity-70" style={{ maxWidth: 120 + i * 20 }} />
          ))}
        </div>
        {Array.from({ length: count }).map((_, i) => (
          <TableRowSkeleton key={i} cols={4} />
        ))}
      </Card>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <EnquiryCardSkeleton key={i} />
      ))}
    </div>
  );
}

/* Filter bar skeleton */
function FilterBarSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-md opacity-80" />
          ))}
        </div>
        <Skeleton className="h-9 w-64 rounded-md opacity-80" />
      </div>
    </Card>
  );
}

/* Full-page skeleton — KPI row + filter bar + list */
export function PageSkeleton({
  variant = "list",
}: {
  variant?: "dashboard" | "list" | "kanban" | "calendar" | "grid";
}) {
  if (variant === "dashboard") {
    return (
      <div className="space-y-6">
        {/* Greeting skeleton */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-96 opacity-80" />
          </div>
          <Skeleton className="h-9 w-36 rounded-md opacity-80" />
        </div>
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>
        {/* Charts row 1 */}
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartSkeleton height={260} className="lg:col-span-2" />
          <ChartSkeleton height={260} />
        </div>
        {/* Charts row 2 */}
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartSkeleton height={260} />
          <ChartSkeleton height={260} className="lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (variant === "kanban") {
    return (
      <div className="space-y-5">
        {/* Page header */}
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-72 opacity-80" />
          </div>
          <Skeleton className="h-9 w-28 rounded-md opacity-80" />
        </div>
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>
        {/* Kanban columns */}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KanbanColumnSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "calendar") {
    return (
      <div className="space-y-5">
        {/* Page header */}
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-56 opacity-80" />
          </div>
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-10 rounded-md opacity-80" />
            ))}
          </div>
        </div>
        {/* Month header + stats */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-24 rounded-full opacity-80" />
            ))}
          </div>
        </div>
        {/* Calendar grid */}
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card className="p-3">
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="mx-auto h-3 w-8 opacity-70" />
              ))}
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg opacity-50" />
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-2 h-3 w-40 opacity-70" />
            <div className="mt-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg opacity-70" />
              ))}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (variant === "grid") {
    return (
      <div className="space-y-5">
        {/* Page header */}
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-72 opacity-80" />
          </div>
          <Skeleton className="h-9 w-28 rounded-md opacity-80" />
        </div>
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>
        {/* Filter bar */}
        <FilterBarSkeleton />
        {/* Grid of cards */}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Card key={i} className="p-0 overflow-hidden">
              <Skeleton className="h-32 w-full opacity-70" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full opacity-80" />
                <Skeleton className="h-3 w-2/3 opacity-70" />
                <div className="flex gap-1.5 pt-1">
                  <Skeleton className="h-4 w-16 rounded-full opacity-60" />
                  <Skeleton className="h-4 w-12 rounded-full opacity-50" />
                </div>
                <div className="flex items-center justify-between pt-3">
                  <Skeleton className="h-5 w-20 opacity-70" />
                  <Skeleton className="h-7 w-16 rounded-md opacity-80" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Default: list view
  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-72 opacity-80" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md opacity-80" />
      </div>
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>
      {/* Filter bar */}
      <FilterBarSkeleton />
      {/* List of cards */}
      <ListSkeleton count={6} variant="card" />
    </div>
  );
}

/* ---------- Scroll-to-Top floating button ---------- */
// Appears when the main scroll container (id="main-content") scrolls past 400px.
// Fixed to bottom-right at z-40, bottom-20 to clear the sticky footer.
export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const main = document.getElementById("main-content");
    if (!main) return;
    const onScroll = () => setVisible(main.scrollTop > 400);
    main.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => main.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTop = () => {
    const main = document.getElementById("main-content");
    if (main) main.scrollTo({ top: 0, behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={scrollTop}
      aria-label="Scroll to top"
      className="fixed bottom-20 right-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary p-3 text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:scale-110 animate-in fade-in slide-in-from-bottom-4 duration-300 sm:right-6"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}

/* ---------- Chart Card ---------- */
export function ChartCard({
  title,
  description,
  icon: Icon,
  children,
  className,
  action,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <Card className={cn("p-4 gap-0", className)}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

/* ---------- Section Card ---------- */
export function SectionCard({
  title,
  description,
  icon: Icon,
  children,
  className,
  action,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <Card className={cn("relative overflow-hidden p-4 gap-0", className)}>
      {/* Subtle top-edge highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/5 to-transparent" aria-hidden />
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {Icon && (
            <div className="rounded-md bg-gradient-to-br from-muted-foreground/15 to-muted-foreground/5 p-1 text-muted-foreground ring-1 ring-muted-foreground/10">
              <Icon className="h-3.5 w-3.5" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

/* ---------- Timeline ---------- */
/**
 * Vertical timeline component for activity / event feeds.
 * Each item has a colored icon, title, content, meta line, and optional actions.
 */
export type TimelineTone = "sky" | "emerald" | "amber" | "violet" | "rose" | "slate" | "cyan";

export interface TimelineItemData {
  id: string;
  icon: LucideIcon;
  tone?: TimelineTone;
  title: ReactNode;
  content?: ReactNode;
  meta?: ReactNode;
  timestamp?: string;
  fullTimestamp?: string;
  actions?: ReactNode;
}

export function Timeline({ items }: { items: TimelineItemData[] }) {
  const toneMap: Record<TimelineTone, string> = {
    sky: "bg-sky-500/15 text-sky-600 dark:text-sky-400 ring-sky-500/25",
    emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25",
    amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-amber-500/25",
    violet: "bg-violet-500/15 text-violet-600 dark:text-violet-400 ring-violet-500/25",
    rose: "bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-rose-500/25",
    slate: "bg-slate-500/15 text-slate-600 dark:text-slate-400 ring-slate-500/25",
    cyan: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 ring-cyan-500/25",
  };

  if (!items.length) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">No activity yet</p>
    );
  }

  return (
    <ol className="relative space-y-3" role="list" aria-label="Activity timeline">
      {/* Vertical connector line */}
      <div
        className="pointer-events-none absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-border/60 via-border/40 to-transparent"
        aria-hidden
      />
      {items.map((item) => {
        const tone = item.tone || "slate";
        const ItemIcon = item.icon;
        return (
          <li
            key={item.id}
            className="group relative flex gap-3 pl-0"
            role="listitem"
          >
            <div
              className={cn(
                "relative z-10 shrink-0 rounded-full p-1.5 ring-1 backdrop-blur-sm transition-transform duration-200 group-hover:scale-110",
                toneMap[tone]
              )}
            >
              <ItemIcon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1 rounded-lg border border-border/60 bg-card/40 p-2.5 transition-colors group-hover:bg-muted/30">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">{item.title}</p>
                  {item.content && (
                    <p className="mt-0.5 text-xs text-muted-foreground whitespace-pre-wrap break-words">
                      {item.content}
                    </p>
                  )}
                  {item.meta && (
                    <p className="mt-1 text-[10px] text-muted-foreground/80">{item.meta}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {item.timestamp && (
                    <span
                      className="text-[10px] text-muted-foreground"
                      title={item.fullTimestamp || item.timestamp}
                    >
                      {item.timestamp}
                    </span>
                  )}
                  {item.actions}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
