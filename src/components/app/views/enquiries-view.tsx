"use client";

// MSIH CRM V1.0 — Module B: Enquiry Management
// List + filters + create dialog + detail drawer
// Developer: Manoj Dore

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmtINR, fmtDate, fmtDateTime, timeAgo } from "@/lib/api-client";
import { useUI } from "@/lib/store";
import { useSession } from "next-auth/react";
import { KpiCard, PageHeader, StatusBadge, EmptyState, Loading, SectionCard } from "../shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Inbox, Plus, Search, Phone, MapPin, IndianRupee,
  Calendar, ArrowRight, AlertTriangle, Loader2,
  Flame, TrendingUp, Building2,
  Trash2, CheckSquare, X, ChevronDown,
  SlidersHorizontal, Filter, LayoutGrid, List, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SavedViewsBar, SaveViewForm, useSavedViews } from "../saved-views-bar";
import { EnquiryDetail } from "./enquiry-detail";

const STATUSES = ["all", "NEW", "QUALIFIED", "HOT", "WARM", "COLD", "CONVERTED", "LOST"];
const SOURCES = ["WEBSITE", "REFERENCE", "EXHIBITION", "COLD_CALL", "EMAIL_CAMPAIGN", "SOCIAL_MEDIA", "TELEMARKETING", "OTHER"];

// Common Indian industrial states for the State filter dropdown
const INDIAN_STATES = [
  "Maharashtra", "Gujarat", "Karnataka", "Tamil Nadu", "Delhi",
  "Telangana", "West Bengal", "Rajasthan", "Uttar Pradesh", "Madhya Pradesh",
  "Chhattisgarh", "Jharkhand", "Odisha", "Kerala", "Andhra Pradesh",
  "Punjab", "Haryana", "Bihar", "Assam", "Uttarakhand",
  "Himachal Pradesh", "Goa", "Jammu & Kashmir",
];

// Shape of the Enquiries filter state — persisted to SavedView.filters JSON
type EnquiryFilters = {
  status: string;
  search: string;
  source: string;
  productId: string;
  assignedTo: string;
  state: string;
  dateFrom: string;
  dateTo: string;
  minBudget: string;
  maxBudget: string;
  minLeadScore: string;
  maxLeadScore: string;
};

const EMPTY_FILTERS: EnquiryFilters = {
  status: "all",
  search: "",
  source: "",
  productId: "",
  assignedTo: "",
  state: "",
  dateFrom: "",
  dateTo: "",
  minBudget: "",
  maxBudget: "",
  minLeadScore: "",
  maxLeadScore: "",
};

// Compact INR formatter for filter chips (₹50K, ₹5L, ₹1Cr)
function fmtCompactINR(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(n % 10000000 === 0 ? 0 : 1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `₹${n}`;
}

// Short date formatter for filter chips (Jun 1, Jun 30)
function fmtShortDate(s: string): string {
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function EnquiriesView() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role || "EXECUTIVE";
  const { enquiryId, openEnquiry, enquiryFormOpen, openEnquiryForm, closeEnquiryForm } = useUI();
  const qc = useQueryClient();

  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Advanced filter state (multi-filter chips)
  const [source, setSource] = useState("");
  const [productId, setProductId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minBudget, setMinBudget] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [minLeadScore, setMinLeadScore] = useState("");
  const [maxLeadScore, setMaxLeadScore] = useState("");

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteReason, setBulkDeleteReason] = useState("");

  // Bulk reassign state — only managers/admins can reassign (gated in UI)
  const canReassign =
    role === "MANAGER" || role === "ADMIN" || role === "SUPER_ADMIN";
  const [bulkReassignOpen, setBulkReassignOpen] = useState(false);
  const [reassignTargetId, setReassignTargetId] = useState("");

  const [viewMode, setViewMode] = useState<"card" | "table">(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("msih-enquiries-view");
      if (stored === "card" || stored === "table") return stored;
    }
    return "card";
  });
  const toggleViewMode = (mode: "card" | "table") => {
    setViewMode(mode);
    try { window.localStorage.setItem("msih-enquiries-view", mode); } catch {}
  };

  // Aggregated filter state object (for roundtrip + chips)
  const currentFilters: EnquiryFilters = useMemo(
    () => ({
      status, search, source, productId, assignedTo, state: stateFilter,
      dateFrom, dateTo, minBudget, maxBudget, minLeadScore, maxLeadScore,
    }),
    [status, search, source, productId, assignedTo, stateFilter, dateFrom, dateTo, minBudget, maxBudget, minLeadScore, maxLeadScore]
  );

  const { data, isLoading } = useQuery({
    queryKey: ["enquiries", status, search, source, productId, assignedTo, stateFilter, dateFrom, dateTo, minBudget, maxBudget, minLeadScore, maxLeadScore, page],
    queryFn: () => {
      const p = new URLSearchParams({ status, search, page: String(page), limit: "15" });
      if (source) p.set("source", source);
      if (productId) p.set("productId", productId);
      if (assignedTo) p.set("assignedTo", assignedTo);
      if (stateFilter) p.set("state", stateFilter);
      if (dateFrom) p.set("dateFrom", dateFrom);
      if (dateTo) p.set("dateTo", dateTo);
      if (minBudget) p.set("minBudget", minBudget);
      if (maxBudget) p.set("maxBudget", maxBudget);
      if (minLeadScore) p.set("minLeadScore", minLeadScore);
      if (maxLeadScore) p.set("maxLeadScore", maxLeadScore);
      return api<any>(`/api/enquiries?${p}`);
    },
  });

  const { data: productsData } = useQuery({
    queryKey: ["products-list"],
    queryFn: () => api<any>("/api/products"),
  });
  const { data: usersData } = useQuery({
    queryKey: ["users-list"],
    queryFn: () => api<any>("/api/users"),
  });

  // Active users available for reassignment (executives + managers)
  const reassignableUsers = useMemo(
    () =>
      (usersData?.users || []).filter(
        (u: any) => u.active && (u.role === "EXECUTIVE" || u.role === "MANAGER")
      ),
    [usersData]
  );
  const reassignTargetUser = reassignableUsers.find(
    (u: any) => u.id === reassignTargetId
  );

  // Decompose a full EnquiryFilters object back into individual setters.
  // Also resets the page + bulk selection so saved views start from a clean slate.
  const setFilters = (f: EnquiryFilters) => {
    setStatus(f.status);
    setSearch(f.search);
    setSource(f.source);
    setProductId(f.productId);
    setAssignedTo(f.assignedTo);
    setStateFilter(f.state);
    setDateFrom(f.dateFrom);
    setDateTo(f.dateTo);
    setMinBudget(f.minBudget);
    setMaxBudget(f.maxBudget);
    setMinLeadScore(f.minLeadScore);
    setMaxLeadScore(f.maxLeadScore);
    setPage(1);
    setSelectedIds(new Set());
  };

  // Saved views — uses the shared `useSavedViews` hook (Tasks + Quotations already use it).
  const sv = useSavedViews<EnquiryFilters>({
    entity: "ENQUIRY",
    filters: currentFilters,
    setFilters,
    defaultFilters: EMPTY_FILTERS,
  });

  const selected = enquiryId;
  const enquiries = data?.enquiries || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  // Bulk selection helpers
  const allOnPageSelected = enquiries.length > 0 && enquiries.every((e: any) => selectedIds.has(e.id));
  const toggleAll = () => {
    const next = new Set(selectedIds);
    if (allOnPageSelected) {
      enquiries.forEach((e: any) => next.delete(e.id));
    } else {
      enquiries.forEach((e: any) => next.add(e.id));
    }
    setSelectedIds(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Per-filter chip clear helpers (each resets a single filter dimension, preserving others)
  const clearOne = (key: keyof EnquiryFilters) => {
    setPage(1);
    switch (key) {
      case "status": setStatus("all"); break;
      case "search": setSearch(""); break;
      case "source": setSource(""); break;
      case "productId": setProductId(""); break;
      case "assignedTo": setAssignedTo(""); break;
      case "state": setStateFilter(""); break;
      case "dateFrom": setDateFrom(""); break;
      case "dateTo": setDateTo(""); break;
      case "minBudget": setMinBudget(""); break;
      case "maxBudget": setMaxBudget(""); break;
      case "minLeadScore": setMinLeadScore(""); break;
      case "maxLeadScore": setMaxLeadScore(""); break;
    }
  };

  // Bulk status update
  const bulkStatusMut = useMutation({
    mutationFn: async ({ ids, newStatus }: { ids: string[]; newStatus: string }) => {
      const results = await Promise.allSettled(
        ids.map((id) =>
          api<any>(`/api/enquiries/${id}`, { method: "PATCH", body: JSON.stringify({ status: newStatus }) })
        )
      );
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const fail = results.filter((r) => r.status === "rejected").length;
      return { ok, fail };
    },
    onSuccess: ({ ok, fail }) => {
      toast.success(`Updated ${ok} enquiries${fail ? `, ${fail} failed` : ""}`);
      setSelectedIds(new Set());
      setBulkMode(false);
      qc.invalidateQueries({ queryKey: ["enquiries"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(e.message || "Bulk update failed"),
  });

  // Bulk reassign (managers/admins only) — calls /api/enquiries/bulk-reassign
  const bulkReassignMut = useMutation({
    mutationFn: ({ ids, assignedTo }: { ids: string[]; assignedTo: string }) =>
      api<any>("/api/enquiries/bulk-reassign", {
        method: "POST",
        body: JSON.stringify({ enquiryIds: ids, assignedTo }),
      }),
    onSuccess: (data) => {
      const targetName = data?.targetUser?.name || "new executive";
      const updated = data?.updated ?? 0;
      const skipped = data?.skipped ?? 0;
      const errCount = data?.errors?.length ?? 0;
      if (updated === 0 && skipped > 0) {
        toast.info(
          `No changes — all ${skipped} selected enquiries are already assigned to ${targetName}`
        );
      } else {
        toast.success(
          `Reassigned ${updated} enquiries to ${targetName}${
            skipped ? ` · ${skipped} already assigned` : ""
          }${errCount ? ` · ${errCount} not found` : ""}`
        );
      }
      setSelectedIds(new Set());
      setBulkMode(false);
      setBulkReassignOpen(false);
      setReassignTargetId("");
      qc.invalidateQueries({ queryKey: ["enquiries"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(e.message || "Bulk reassign failed"),
  });

  // Bulk delete request
  const bulkDeleteMut = useMutation({
    mutationFn: async ({ ids, reason }: { ids: string[]; reason: string }) => {
      const results = await Promise.allSettled(
        ids.map((id) =>
          api<any>(`/api/enquiries/${id}`, { method: "DELETE", body: JSON.stringify({ reason }) })
        )
      );
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const fail = results.filter((r) => r.status === "rejected").length;
      return { ok, fail };
    },
    onSuccess: ({ ok, fail }) => {
      toast.success(`Requested deletion for ${ok} enquiries${fail ? `, ${fail} failed` : ""}`);
      setSelectedIds(new Set());
      setBulkMode(false);
      setBulkDeleteOpen(false);
      setBulkDeleteReason("");
      qc.invalidateQueries({ queryKey: ["enquiries"] });
    },
    onError: (e: any) => toast.error(e.message || "Bulk delete failed"),
  });

  // Build the list of active filter chips for the chips row
  const products = productsData?.products || [];
  const users = usersData?.users || [];

  const chips = useMemo(() => {
    const out: { key: keyof EnquiryFilters; label: string }[] = [];
    if (currentFilters.status !== "all") out.push({ key: "status", label: `Status: ${currentFilters.status}` });
    if (currentFilters.search) out.push({ key: "search", label: `Search: "${currentFilters.search}"` });
    if (currentFilters.source) out.push({ key: "source", label: `Source: ${currentFilters.source.replace(/_/g, " ")}` });
    if (currentFilters.productId) {
      const p = products.find((x: any) => x.id === currentFilters.productId);
      out.push({ key: "productId", label: `Product: ${p?.name || "—"}` });
    }
    if (currentFilters.assignedTo) {
      const u = users.find((x: any) => x.id === currentFilters.assignedTo);
      out.push({ key: "assignedTo", label: `Executive: ${u?.name || "—"}` });
    }
    if (currentFilters.state) out.push({ key: "state", label: `State: ${currentFilters.state}` });
    if (currentFilters.dateFrom || currentFilters.dateTo) {
      if (currentFilters.dateFrom && currentFilters.dateTo) {
        out.push({ key: "dateFrom", label: `Date: ${fmtShortDate(currentFilters.dateFrom)} – ${fmtShortDate(currentFilters.dateTo)}` });
      } else if (currentFilters.dateFrom) {
        out.push({ key: "dateFrom", label: `Date: ≥ ${fmtShortDate(currentFilters.dateFrom)}` });
      } else {
        out.push({ key: "dateTo", label: `Date: ≤ ${fmtShortDate(currentFilters.dateTo)}` });
      }
    }
    if (currentFilters.minBudget || currentFilters.maxBudget) {
      if (currentFilters.minBudget && currentFilters.maxBudget) {
        out.push({ key: "minBudget", label: `Budget: ${fmtCompactINR(Number(currentFilters.minBudget))} – ${fmtCompactINR(Number(currentFilters.maxBudget))}` });
      } else if (currentFilters.minBudget) {
        out.push({ key: "minBudget", label: `Budget: ≥ ${fmtCompactINR(Number(currentFilters.minBudget))}` });
      } else {
        out.push({ key: "maxBudget", label: `Budget: ≤ ${fmtCompactINR(Number(currentFilters.maxBudget))}` });
      }
    }
    if (currentFilters.minLeadScore || currentFilters.maxLeadScore) {
      if (currentFilters.minLeadScore && currentFilters.maxLeadScore) {
        out.push({ key: "minLeadScore", label: `Lead Score: ${currentFilters.minLeadScore} – ${currentFilters.maxLeadScore}` });
      } else if (currentFilters.minLeadScore) {
        out.push({ key: "minLeadScore", label: `Lead Score: ≥ ${currentFilters.minLeadScore}` });
      } else {
        out.push({ key: "maxLeadScore", label: `Lead Score: ≤ ${currentFilters.maxLeadScore}` });
      }
    }
    return out;
  }, [currentFilters, products, users]);

  const advancedFilterCount = chips.filter((c) => c.key !== "status" && c.key !== "search").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Enquiry Management"
        description="Capture and track customer enquiries — from lead to order."
        icon={Inbox}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setBulkMode((b) => !b)} aria-pressed={bulkMode}>
              <CheckSquare className="mr-1.5 h-4 w-4" /> {bulkMode ? "Exit Bulk" : "Bulk Select"}
            </Button>
            <Button onClick={openEnquiryForm}>
              <Plus className="mr-2 h-4 w-4" /> New Enquiry
            </Button>
          </div>
        }
      />

      {/* mini stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Total Enquiries" value={total} icon={Inbox} accent="blue" />
        <KpiCard label="Hot Leads" value={enquiries.filter((e: any) => e.status === "HOT").length} icon={Flame} accent="red" />
        <KpiCard label="Open Pipeline" value={enquiries.filter((e: any) => !["CONVERTED", "LOST"].includes(e.status)).length} icon={TrendingUp} accent="amber" />
        <KpiCard label="Converted" value={enquiries.filter((e: any) => e.status === "CONVERTED").length} icon={Calendar} accent="emerald" />
      </div>

      {/* Saved Views bar */}
      <SavedViewsBar
        views={sv.views}
        activeViewId={sv.activeViewId}
        onApply={sv.applyView}
        onDelete={sv.deleteView}
        onSetDefault={sv.setDefaultView}
        onSaveCurrent={() => setSaveViewOpen(true)}
        onClear={sv.clearFilters}
        hasActiveFilters={sv.hasActiveFilters}
      />

      {/* Bulk actions toolbar */}
      {bulkMode && (
        <Card className="border-primary/30 bg-primary/5 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="font-semibold">{selectedIds.size} selected</Badge>
              <Button variant="ghost" size="sm" onClick={toggleAll} disabled={enquiries.length === 0}>
                {allOnPageSelected ? "Deselect page" : "Select page"}
              </Button>
              {selectedIds.size > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                  <X className="mr-1 h-3.5 w-3.5" /> Clear
                </Button>
              )}
            </div>
            {selectedIds.size > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={bulkStatusMut.isPending}>
                      {bulkStatusMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="mr-1.5 h-3.5 w-3.5" />}
                      Set Status <ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuLabel>Change status for {selectedIds.size} enquiries</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {STATUSES.filter((s) => s !== "all").map((s) => (
                      <DropdownMenuItem key={s} onClick={() => bulkStatusMut.mutate({ ids: [...selectedIds], newStatus: s })}>
                        <span className="capitalize">{s}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                {canReassign && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={bulkReassignMut.isPending}
                    onClick={() => setBulkReassignOpen(true)}
                    title={canReassign ? "Reassign selected enquiries to a different executive" : "Only managers/admins can reassign"}
                  >
                    {bulkReassignMut.isPending ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Users className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Reassign
                  </Button>
                )}
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setBulkDeleteOpen(true)}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Request Delete
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <TabsList className="flex h-auto flex-wrap gap-1 bg-muted/60">
              {STATUSES.map((s) => (
                <TabsTrigger key={s} value={s} className="text-xs capitalize">
                  {s === "all" ? "All" : s}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <AdvancedFiltersButton
              count={advancedFilterCount}
              source={source}
              setSource={(v) => { setSource(v); setPage(1); }}
              productId={productId}
              setProductId={(v) => { setProductId(v); setPage(1); }}
              assignedTo={assignedTo}
              setAssignedTo={(v) => { setAssignedTo(v); setPage(1); }}
              stateFilter={stateFilter}
              setStateFilter={(v) => { setStateFilter(v); setPage(1); }}
              dateFrom={dateFrom}
              setDateFrom={(v) => { setDateFrom(v); setPage(1); }}
              dateTo={dateTo}
              setDateTo={(v) => { setDateTo(v); setPage(1); }}
              minBudget={minBudget}
              setMinBudget={(v) => { setMinBudget(v); setPage(1); }}
              maxBudget={maxBudget}
              setMaxBudget={(v) => { setMaxBudget(v); setPage(1); }}
              minLeadScore={minLeadScore}
              setMinLeadScore={(v) => { setMinLeadScore(v); setPage(1); }}
              maxLeadScore={maxLeadScore}
              setMaxLeadScore={(v) => { setMaxLeadScore(v); setPage(1); }}
              onClearAll={() => {
                setSource(""); setProductId(""); setAssignedTo(""); setStateFilter("");
                setDateFrom(""); setDateTo(""); setMinBudget(""); setMaxBudget("");
                setMinLeadScore(""); setMaxLeadScore(""); setPage(1);
              }}
              products={products}
              users={users}
              role={role}
            />
            <div className="relative w-full lg:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search company, contact, mobile…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <div className="flex items-center rounded-md border border-border bg-card p-0.5" role="group" aria-label="View mode">
              <button
                type="button"
                onClick={() => toggleViewMode("card")}
                aria-pressed={viewMode === "card"}
                aria-label="Card view"
                title="Card view"
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded transition",
                  viewMode === "card"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => toggleViewMode("table")}
                aria-pressed={viewMode === "table"}
                aria-label="Table view"
                title="Table view"
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded transition",
                  viewMode === "table"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Active filter chips row */}
      {chips.length > 0 && (
        <FilterChipsRow chips={chips} onClear={clearOne} onClearAll={sv.clearFilters} />
      )}

      {/* list */}
      {isLoading ? (
        <Loading label="Loading enquiries…" />
      ) : enquiries.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No enquiries found"
          description="Try adjusting your filters or create a new enquiry."
          action={<Button onClick={openEnquiryForm}><Plus className="mr-2 h-4 w-4" /> New Enquiry</Button>}
        />
      ) : viewMode === "table" ? (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {/* Desktop table */}
            <table className="hidden w-full text-sm md:table" role="table" aria-label="Enquiries table">
              <thead className="border-b border-border bg-muted/40 text-left">
                <tr>
                  {bulkMode && <th className="w-10 px-3 py-2.5" scope="col" />}
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground" scope="col">Company</th>
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground" scope="col">Product</th>
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground" scope="col">Status</th>
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground" scope="col">Score</th>
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground" scope="col">Budget</th>
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground" scope="col">Executive</th>
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground" scope="col">Date</th>
                  <th className="w-8 px-3 py-2.5" scope="col" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {enquiries.map((e: any) => {
                  const isSelected = selectedIds.has(e.id);
                  return (
                    <tr
                      key={e.id}
                      onClick={() => { if (!bulkMode) openEnquiry(e.id); }}
                      className={cn(
                        "group transition-colors",
                        bulkMode && isSelected ? "bg-primary/5" : "",
                        bulkMode ? "cursor-default" : "cursor-pointer hover:bg-muted/40"
                      )}
                    >
                      {bulkMode && (
                        <td className="px-3 py-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleOne(e.id)}
                            onClick={(ev) => ev.stopPropagation()}
                            aria-label={`Select ${e.company}`}
                          />
                        </td>
                      )}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="shrink-0 rounded-md bg-primary/10 p-1.5 text-primary ring-1 ring-primary/15">
                            <Building2 className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{e.company}</p>
                            <p className="truncate text-xs text-muted-foreground">{e.enquiryNumber} · {e.contactPerson}</p>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-[180px] truncate px-3 py-3 text-muted-foreground">{e.productInterested}</td>
                      <td className="px-3 py-3"><StatusBadge status={e.status} /></td>
                      <td className="px-3 py-3">
                        {e.leadScore >= 70 ? (
                          <Badge className="bg-red-500/15 text-red-600 dark:text-red-400"><Flame className="mr-1 h-3 w-3" />{e.leadScore}</Badge>
                        ) : (
                          <span className="text-muted-foreground">{e.leadScore}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{e.budget ? fmtINR(e.budget) : "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{e.assignedExecutive?.name?.split(" ")[0] || "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{fmtDate(e.date)}</td>
                      <td className="px-3 py-3">
                        {!bulkMode && <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Mobile stacked rows (when table mode is selected) */}
            <div className="divide-y divide-border/60 md:hidden">
              {enquiries.map((e: any) => {
                const isSelected = selectedIds.has(e.id);
                return (
                  <div
                    key={e.id}
                    onClick={() => { if (!bulkMode) openEnquiry(e.id); }}
                    className={cn(
                      "flex items-start gap-3 p-3 transition",
                      bulkMode && isSelected ? "bg-primary/5" : "",
                      bulkMode ? "cursor-default" : "cursor-pointer active:bg-muted/40"
                    )}
                  >
                    {bulkMode && (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleOne(e.id)}
                        onClick={(ev) => ev.stopPropagation()}
                        aria-label={`Select ${e.company}`}
                        className="mt-1"
                      />
                    )}
                    <div className="shrink-0 rounded-md bg-primary/10 p-1.5 text-primary ring-1 ring-primary/15">
                      <Building2 className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-medium text-foreground">{e.company}</p>
                        <StatusBadge status={e.status} />
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{e.contactPerson} · {e.productInterested}</p>
                      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{e.assignedExecutive?.name?.split(" ")[0] || "—"}</span>
                        <span>{fmtDate(e.date)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Page {page} of {totalPages} · {total} enquiries</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid gap-3">
            {enquiries.map((e: any) => {
              const isSelected = selectedIds.has(e.id);
              return (
                <div
                  key={e.id}
                  className={cn(
                    "group relative rounded-xl border bg-card p-4 transition-all duration-200",
                    bulkMode && isSelected ? "border-primary ring-1 ring-primary/30" : "border-border",
                    bulkMode ? "cursor-default" : "cursor-pointer hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5"
                  )}
                  onClick={() => { if (!bulkMode) openEnquiry(e.id); }}
                >
                  {/* Animated left accent stripe */}
                  <div className="pointer-events-none absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-primary/0 transition-all duration-200 group-hover:bg-primary/60" aria-hidden />
                  {bulkMode && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleOne(e.id)}
                        onClick={(ev) => ev.stopPropagation()}
                        aria-label={`Select ${e.company}`}
                      />
                    </div>
                  )}
                  <div className={cn("flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between", bulkMode && "pl-8")}>
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 rounded-lg bg-primary/10 p-2.5 text-primary ring-1 ring-primary/15 transition-transform duration-200 group-hover:scale-105">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-foreground">{e.company}</p>
                          <StatusBadge status={e.status} />
                          {e.leadScore >= 70 && <Badge className="bg-red-500/15 text-red-600 dark:text-red-400"><Flame className="mr-1 h-3 w-3" />{e.leadScore}</Badge>}
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {e.enquiryNumber} · {e.contactPerson} · <span className="font-medium">{e.productInterested}</span>
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{e.mobile}</span>
                          {e.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{e.city}</span>}
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(e.date)}</span>
                          {e.budget && <span className="flex items-center gap-1"><IndianRupee className="h-3 w-3" />{fmtINR(e.budget)}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="text-center">
                        <p className="font-semibold text-foreground">{e._count?.followUps || 0}</p>
                        <p>Follow-ups</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-foreground">{e._count?.quotations || 0}</p>
                        <p>Quotations</p>
                      </div>
                      <div className="hidden text-center sm:block">
                        <p className="font-semibold text-foreground">{e.assignedExecutive?.name?.split(" ")[0] || "—"}</p>
                        <p>Executive</p>
                      </div>
                      {!bulkMode && <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Page {page} of {totalPages} · {total} enquiries</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* create dialog — `open` is sourced from the global Zustand store so the `N`
          keyboard shortcut can open the form from any view (the app-shell calls
          `setView("enquiries")` + `openEnquiryForm()` together). */}
      <CreateEnquiryDialog
        open={enquiryFormOpen}
        onOpenChange={(o) => { if (!o) closeEnquiryForm(); }}
        products={productsData?.products || []}
        users={usersData?.users || []}
        role={role}
        currentUserId={(session?.user as any)?.id}
        onCreated={(id) => { closeEnquiryForm(); openEnquiry(id); }}
      />

      {/* detail */}
      <EnquiryDetail enquiryId={selected} onClose={() => openEnquiry(null)} />

      {/* Save View Dialog — shared `SaveViewForm` from saved-views-bar.tsx */}
      <SaveViewForm
        open={saveViewOpen}
        onOpenChange={setSaveViewOpen}
        onSave={sv.saveView}
        loading={sv.isSaving}
        activeFilterCount={chips.length}
      />

      {/* Bulk Delete Dialog */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="h-5 w-5" /> Request Bulk Deletion</DialogTitle>
            <DialogDescription>
              This will submit deletion requests for <strong>{selectedIds.size}</strong> enquiries. An admin must approve each request before deletion occurs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Reason for deletion *</Label>
            <Textarea
              value={bulkDeleteReason}
              onChange={(e) => setBulkDeleteReason(e.target.value)}
              placeholder="e.g. Duplicate entries, test data, outdated records…"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!bulkDeleteReason.trim() || bulkDeleteMut.isPending}
              onClick={() => bulkDeleteMut.mutate({ ids: [...selectedIds], reason: bulkDeleteReason.trim() })}
            >
              {bulkDeleteMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit {selectedIds.size} Deletion Requests
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Reassign Dialog (managers/admins only) */}
      <Dialog open={bulkReassignOpen} onOpenChange={(o) => { setBulkReassignOpen(o); if (!o) setReassignTargetId(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Reassign Selected Enquiries
            </DialogTitle>
            <DialogDescription>
              Move <strong>{selectedIds.size}</strong> selected {selectedIds.size === 1 ? "enquiry" : "enquiries"} to a different sales executive.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Assign to *</Label>
              <Select value={reassignTargetId} onValueChange={setReassignTargetId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select a sales executive" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {reassignableUsers.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        ({u.role === "MANAGER" ? "Manager" : u.role.toLowerCase()})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {reassignTargetUser && (
              <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                You are about to reassign{" "}
                <strong className="text-foreground">{selectedIds.size}</strong>{" "}
                {selectedIds.size === 1 ? "enquiry" : "enquiries"} to{" "}
                <strong className="text-foreground">{reassignTargetUser.name}</strong>.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkReassignOpen(false)}>Cancel</Button>
            <Button
              disabled={!reassignTargetId || bulkReassignMut.isPending}
              onClick={() =>
                bulkReassignMut.mutate({
                  ids: [...selectedIds],
                  assignedTo: reassignTargetId,
                })
              }
            >
              {bulkReassignMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reassign {selectedIds.size} {selectedIds.size === 1 ? "enquiry" : "enquiries"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============ Active Filter Chips Row ============ */
function FilterChipsRow({
  chips, onClear, onClearAll,
}: {
  chips: { key: keyof EnquiryFilters; label: string }[];
  onClear: (key: keyof EnquiryFilters) => void;
  onClearAll: () => void;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-muted/30 px-3 py-2.5">
      <span className="mr-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Filter className="h-3.5 w-3.5" /> Active
      </span>
      {chips.map((c) => (
        <span
          key={c.key}
          className="group inline-flex animate-in fade-in zoom-in-95 duration-200 items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition hover:bg-primary/15"
        >
          {c.label}
          <button
            type="button"
            onClick={() => onClear(c.key)}
            aria-label={`Clear filter ${c.label}`}
            className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-primary/70 transition hover:bg-primary/20 hover:text-red-500"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="ml-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-red-500"
      >
        <Trash2 className="h-3 w-3" /> Clear all
      </button>
    </div>
  );
}

/* ============ Advanced Filters Popover ============ */
function AdvancedFiltersButton({
  count, source, setSource, productId, setProductId, assignedTo, setAssignedTo,
  stateFilter, setStateFilter, dateFrom, setDateFrom, dateTo, setDateTo,
  minBudget, setMinBudget, maxBudget, setMaxBudget,
  minLeadScore, setMinLeadScore, maxLeadScore, setMaxLeadScore,
  onClearAll, products, users, role,
}: {
  count: number;
  source: string; setSource: (v: string) => void;
  productId: string; setProductId: (v: string) => void;
  assignedTo: string; setAssignedTo: (v: string) => void;
  stateFilter: string; setStateFilter: (v: string) => void;
  dateFrom: string; setDateFrom: (v: string) => void;
  dateTo: string; setDateTo: (v: string) => void;
  minBudget: string; setMinBudget: (v: string) => void;
  maxBudget: string; setMaxBudget: (v: string) => void;
  minLeadScore: string; setMinLeadScore: (v: string) => void;
  maxLeadScore: string; setMaxLeadScore: (v: string) => void;
  onClearAll: () => void;
  products: any[];
  users: any[];
  role: string;
}) {
  const [open, setOpen] = useState(false);
  const execs = users.filter((u) => u.role === "EXECUTIVE" && u.active);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("relative", count > 0 && "border-primary/40 bg-primary/5 text-primary")}
          aria-label="Advanced filters"
        >
          <SlidersHorizontal className="mr-1.5 h-4 w-4" />
          Filters
          {count > 0 && (
            <span className="ml-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-none text-primary-foreground">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[calc(100vw-2rem)] max-w-[34rem] p-4 sm:w-[34rem]"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Advanced Filters</p>
          </div>
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs font-medium text-muted-foreground transition hover:text-red-500"
          >
            Clear all
          </button>
        </div>

        <div className="grid max-h-[60vh] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
          {/* Source */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Source</Label>
            <Select value={source || "all"} onValueChange={(v) => setSource(v === "all" ? "" : v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Any source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any source</SelectItem>
                {SOURCES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Product */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Product</Label>
            <Select value={productId || "all"} onValueChange={(v) => setProductId(v === "all" ? "" : v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Any product" /></SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="all">Any product</SelectItem>
                {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Executive (hidden for EXECUTIVE role — they can only see their own) */}
          {role !== "EXECUTIVE" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Assigned Executive</Label>
              <Select value={assignedTo || "all"} onValueChange={(v) => setAssignedTo(v === "all" ? "" : v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Any executive" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="all">Any executive</SelectItem>
                  {execs.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  {users.filter((u) => u.role === "MANAGER").map((u) => <SelectItem key={u.id} value={u.id}>{u.name} (Manager)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* State */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">State</Label>
            <Select value={stateFilter || "all"} onValueChange={(v) => setStateFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Any state" /></SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="all">Any state</SelectItem>
                {INDIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Date range */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Date From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Date To</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9" />
          </div>

          {/* Budget range */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Min Budget (₹)</Label>
            <Input type="number" min={0} value={minBudget} onChange={(e) => setMinBudget(e.target.value)} placeholder="e.g. 50000" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Max Budget (₹)</Label>
            <Input type="number" min={0} value={maxBudget} onChange={(e) => setMaxBudget(e.target.value)} placeholder="e.g. 5000000" className="h-9" />
          </div>

          {/* Lead score range */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Min Lead Score (0–100)</Label>
            <Input type="number" min={0} max={100} value={minLeadScore} onChange={(e) => setMinLeadScore(e.target.value)} placeholder="e.g. 70" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Max Lead Score (0–100)</Label>
            <Input type="number" min={0} max={100} value={maxLeadScore} onChange={(e) => setMaxLeadScore(e.target.value)} placeholder="e.g. 100" className="h-9" />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {count > 0 ? `${count} filter${count === 1 ? "" : "s"} active` : "No advanced filters applied"}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClearAll} disabled={count === 0}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Reset
            </Button>
            <Button size="sm" onClick={() => setOpen(false)}>
              <CheckSquare className="mr-1.5 h-3.5 w-3.5" /> Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ============ Create Enquiry Dialog ============ */
function CreateEnquiryDialog({
  open, onOpenChange, products, users, role, currentUserId, onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  products: any[];
  users: any[];
  role: string;
  currentUserId?: string;
  onCreated: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({
    source: "WEBSITE", company: "", contactPerson: "", mobile: "", email: "",
    productInterested: "", productId: "", budget: "", city: "", state: "",
    specification: "", remarks: "", assignedTo: currentUserId || "", nextFollowUpDate: "",
  });
  const [dupWarn, setDupWarn] = useState(false);

  const execs = users.filter((u) => u.role === "EXECUTIVE" && u.active);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: (payload: any) => api<any>("/api/enquiries", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: (data) => {
      toast.success(`Enquiry ${data.enquiry.enquiryNumber} created`);
      if (data.duplicate) toast.warning("⚠️ Possible duplicate detected — this customer may already exist.");
      qc.invalidateQueries({ queryKey: ["enquiries"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onCreated(data.enquiry.id);
      setForm({ source: "WEBSITE", company: "", contactPerson: "", mobile: "", email: "", productInterested: "", productId: "", budget: "", city: "", state: "", specification: "", remarks: "", assignedTo: currentUserId || "", nextFollowUpDate: "" });
    },
    onError: (e: any) => toast.error(e.message || "Failed to create enquiry"),
  });

  const submit = () => {
    if (!form.company || !form.contactPerson || !form.mobile || !form.productInterested) {
      toast.error("Please fill all mandatory fields (Company, Contact, Mobile, Product).");
      return;
    }
    mutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary" /> New Enquiry</DialogTitle>
          <DialogDescription>Capture a new customer enquiry. Fields marked * are mandatory.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Source *</Label>
            <Select value={form.source} onValueChange={(v) => set("source", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SOURCES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Product Interested *</Label>
            <Select value={form.productId} onValueChange={(v) => { const p = products.find((x) => x.id === v); set("productId", v); set("productInterested", p?.name || ""); }}>
              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent className="max-h-60">
                {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Company Name *</Label>
            <Input value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="e.g. Tata Steel Ltd." />
          </div>
          <div className="space-y-1.5">
            <Label>Contact Person *</Label>
            <Input value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} placeholder="e.g. Rajesh Kumar" />
          </div>
          <div className="space-y-1.5">
            <Label>Mobile Number *</Label>
            <Input value={form.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="10-digit mobile" maxLength={15} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="contact@company.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Budget (₹)</Label>
            <Input type="number" value={form.budget} onChange={(e) => set("budget", e.target.value)} placeholder="e.g. 500000" />
          </div>
          <div className="space-y-1.5">
            <Label>City</Label>
            <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="e.g. Pune" />
          </div>
          <div className="space-y-1.5">
            <Label>State</Label>
            <Input value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="e.g. Maharashtra" />
          </div>
          <div className="space-y-1.5">
            <Label>Assigned Executive</Label>
            <Select value={form.assignedTo} onValueChange={(v) => set("assignedTo", v)}>
              <SelectTrigger><SelectValue placeholder="Assign to…" /></SelectTrigger>
              <SelectContent>
                {execs.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                {role !== "EXECUTIVE" && users.filter((u) => u.role === "MANAGER").map((u) => <SelectItem key={u.id} value={u.id}>{u.name} (Manager)</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Next Follow-Up Date</Label>
            <Input type="date" value={form.nextFollowUpDate} onChange={(e) => set("nextFollowUpDate", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Specification / Requirements</Label>
            <Textarea value={form.specification} onChange={(e) => set("specification", e.target.value)} placeholder="Technical specs, quantity, special requirements…" rows={2} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Remarks</Label>
            <Textarea value={form.remarks} onChange={(e) => set("remarks", e.target.value)} placeholder="Any additional notes…" rows={2} />
          </div>
        </div>

        {dupWarn && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" /> This customer may already exist. Please verify before saving.
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create Enquiry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
