"use client";

// MSIH CRM V1.0 — Admin: Audit Logs
// Visual Timeline + Action/Entity filters + KPIs + Pagination
// Developer: Manoj Dore

import { useQuery } from "@tanstack/react-query";
import { api, fmtDateTime, timeAgo, fmtNum } from "@/lib/api-client";
import {
  PageHeader,
  Loading,
  EmptyState,
  KpiCard,
  Timeline,
  type TimelineItemData,
  type TimelineTone,
} from "../shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ScrollText,
  Activity,
  Plus,
  Pencil,
  Trash2,
  LogIn,
  LogOut,
  CheckCircle2,
  XCircle,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ListFilter,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

/* ---------- Action → icon/tone mapping ---------- */
const ACTION_ICON: Record<string, LucideIcon> = {
  CREATE: Plus,
  UPDATE: Pencil,
  DELETE: Trash2,
  LOGIN: LogIn,
  LOGOUT: LogOut,
  APPROVE: CheckCircle2,
  REJECT: XCircle,
  TRANSFER: ArrowLeftRight,
};

const ACTION_TONE: Record<string, TimelineTone> = {
  CREATE: "emerald",
  UPDATE: "sky",
  DELETE: "rose",
  LOGIN: "violet",
  LOGOUT: "slate",
  APPROVE: "emerald",
  REJECT: "rose",
  TRANSFER: "amber",
};

const ACTION_DOT: Record<string, string> = {
  CREATE: "bg-emerald-500",
  UPDATE: "bg-sky-500",
  DELETE: "bg-rose-500",
  LOGIN: "bg-violet-500",
  LOGOUT: "bg-slate-500",
  APPROVE: "bg-emerald-500",
  REJECT: "bg-rose-500",
  TRANSFER: "bg-amber-500",
};

const ACTION_OPTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGOUT",
  "APPROVE",
  "REJECT",
  "TRANSFER",
];

const PAGE_SIZE = 25;

export function AdminAuditView() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  // Build query string with all filter params
  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("limit", String(PAGE_SIZE));
    if (actionFilter !== "all") p.set("action", actionFilter);
    if (entityFilter !== "all") p.set("entity", entityFilter);
    return p.toString();
  }, [page, actionFilter, entityFilter]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["audit-logs", queryParams],
    queryFn: () => api<any>(`/api/audit-logs?${queryParams}`),
    placeholderData: (prev: any) => prev,
  });

  const logs: any[] = data?.logs || [];
  const total: number = data?.total || 0;
  const totalPages: number = data?.totalPages || 1;

  // Client-side search on top of server filters (description/userName match)
  const visibleLogs = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter(
      (l: any) =>
        (l.description || "").toLowerCase().includes(q) ||
        (l.userName || "").toLowerCase().includes(q)
    );
  }, [logs, search]);

  // Extract distinct entities dynamically from loaded logs (for the Entity dropdown)
  const entities = useMemo(() => {
    const s = new Set<string>();
    logs.forEach((l: any) => l.entity && s.add(l.entity));
    return Array.from(s).sort();
  }, [logs]);

  // KPIs — based on the current page only (label as "in current view")
  const kpis = useMemo(() => {
    const create = logs.filter((l: any) => l.action === "CREATE").length;
    const update = logs.filter((l: any) => l.action === "UPDATE").length;
    const del = logs.filter((l: any) => l.action === "DELETE").length;
    return { total: logs.length, create, update, del };
  }, [logs]);

  // Clear all filters
  const clearFilters = () => {
    setSearch("");
    setActionFilter("all");
    setEntityFilter("all");
    setPage(1);
    toast.info("Filters cleared");
  };

  const hasActiveFilters =
    search.trim() !== "" || actionFilter !== "all" || entityFilter !== "all";

  // Build Timeline items
  const timelineItems: TimelineItemData[] = visibleLogs.map((l: any) => ({
    id: l.id,
    icon: ACTION_ICON[l.action] || Activity,
    tone: ACTION_TONE[l.action] || "slate",
    title: (
      <span className="flex items-center gap-1.5">
        <span>{(l.action || "EVENT").toUpperCase()}</span>
        <Badge
          variant="outline"
          className="px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {l.entity || "—"}
        </Badge>
      </span>
    ),
    content: l.description,
    meta: `${l.userName || "—"} · ${l.entity || "—"}${
      l.entityId ? ` #${String(l.entityId).slice(-6)}` : ""
    } · ${l.ipAddress || "—"}`,
    timestamp: timeAgo(l.timestamp),
    fullTimestamp: fmtDateTime(l.timestamp),
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Logs"
        description="Immutable record of every system activity — create, update, delete, login, and more."
        icon={ScrollText}
        accent="violet"
      />

      {/* KPI cards — counts based on current page view */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Total Events"
          value={fmtNum(kpis.total)}
          icon={Activity}
          accent="violet"
          hint="In current view"
        />
        <KpiCard
          label="Create Events"
          value={fmtNum(kpis.create)}
          icon={Plus}
          accent="emerald"
          hint="In current view"
        />
        <KpiCard
          label="Update Events"
          value={fmtNum(kpis.update)}
          icon={Pencil}
          accent="blue"
          hint="In current view"
        />
        <KpiCard
          label="Delete Events"
          value={fmtNum(kpis.del)}
          icon={Trash2}
          accent="red"
          hint="In current view"
        />
      </div>

      {/* Filter bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
          <div className="relative flex-1">
            <Input
              placeholder="Search by user or description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md pr-9"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ListFilter className="hidden h-4 w-4 text-muted-foreground sm:block" />

            <Select
              value={actionFilter}
              onValueChange={(v) => {
                setActionFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {ACTION_OPTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={entityFilter}
              onValueChange={(v) => {
                setEntityFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-[170px]">
                <SelectValue placeholder="Entity" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">All entities</SelectItem>
                {entities.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground transition hover:text-foreground"
              >
                <X className="mr-1 h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Legend for action colors */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
        <span className="font-semibold uppercase tracking-wide">Legend:</span>
        {ACTION_OPTIONS.map((a) => (
          <span key={a} className="inline-flex items-center gap-1.5">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                ACTION_DOT[a] || "bg-slate-400"
              )}
              aria-hidden
            />
            {a}
          </span>
        ))}
      </div>

      {/* Timeline */}
      {isLoading ? (
        <Loading label="Loading audit trail…" />
      ) : visibleLogs.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No matching events"
          description="Try adjusting your filters or clearing the search."
        />
      ) : (
        <Card className="relative overflow-hidden p-0">
          {/* Subtle top-edge highlight */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent"
            aria-hidden
          />
          <div className="scroll-thin max-h-[70vh] overflow-y-auto p-4">
            <Timeline items={timelineItems} />
            {isFetching && (
              <p className="mt-3 text-center text-[10px] text-muted-foreground/70">
                Refreshing…
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            Page <span className="font-semibold text-foreground">{page}</span> of{" "}
            <span className="font-semibold text-foreground">{totalPages}</span> ·{" "}
            <span className="font-semibold text-foreground">{fmtNum(total)}</span>{" "}
            total events
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Immutable notice — gradient banner */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-center text-xs text-amber-700 dark:text-amber-300">
        <ShieldCheck className="mr-1.5 inline-block h-3.5 w-3.5 align-[-2px]" />
        Audit logs are immutable — not even Admin can edit or delete them.
      </div>
    </div>
  );
}
