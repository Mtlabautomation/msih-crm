"use client";

// MSIH CRM V1.0 — Customer 360 View
// Master list of customers + 360° detail drawer (profile, enquiries, activities timeline).
// Card/Table view toggle persisted to localStorage.
// Developer: Manoj Dore — MIT License

import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmtINR, fmtDate, fmtDateTime, timeAgo } from "@/lib/api-client";
import { useUI } from "@/lib/store";
import { useSession } from "next-auth/react";
import {
  KpiCard, PageHeader, StatusBadge, EmptyState, Loading, SectionCard, ListSkeleton,
} from "../shared";
import { PullToRefresh } from "../pull-to-refresh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableHeader, TableBody, TableRow, TableCell, TableHead,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Building2, Plus, Search, Phone, Mail, MapPin, Globe, FileText, Loader2,
  Inbox, Activity as ActivityIcon, IndianRupee, TrendingUp, Calendar, Hash,
  ArrowRight, LayoutGrid, List, Pencil, Trash2, X,
  Users, Mail as MailIcon, Phone as PhoneIcon, FileText as FileTextIcon,
  ClipboardList,
} from "lucide-react";

const INDUSTRIES = ["Manufacturing", "Automotive", "Aerospace", "Steel", "Cement", "Heavy Engineering", "Research Institute", "Education", "Defense", "Other"];

// Activity type metadata: icon + tint classes (matches Industrial Blue palette)
const ACTIVITY_TYPES: Record<string, { icon: any; tint: string; dot: string; label: string }> = {
  NOTE: { icon: FileText, tint: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 ring-slate-500/20", dot: "bg-slate-500", label: "Note" },
  CALL: { icon: Phone, tint: "bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-300 ring-sky-500/25", dot: "bg-sky-500", label: "Call" },
  EMAIL: { icon: Mail, tint: "bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300 ring-violet-500/25", dot: "bg-violet-500", label: "Email" },
  MEETING: { icon: Users, tint: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300 ring-emerald-500/25", dot: "bg-emerald-500", label: "Meeting" },
  DOCUMENT: { icon: FileText, tint: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300 ring-amber-500/25", dot: "bg-amber-500", label: "Document" },
};
const ACTIVITY_TYPE_ORDER = ["NOTE", "CALL", "EMAIL", "MEETING", "DOCUMENT"];

function initials(name: string) {
  return name?.split(" ").map((w) => w?.[0]).slice(0, 2).join("").toUpperCase() || "?";
}

function initialsFromEmail(email?: string | null) {
  if (!email) return "?";
  return email[0]?.toUpperCase() || "?";
}

export function CustomersView() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role || "EXECUTIVE";
  const currentUserId = (session?.user as any)?.id;
  const { openEnquiry } = useUI();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState<string | null>(null);

  // View mode (card | table) persisted to localStorage
  const [viewMode, setViewMode] = useState<"card" | "table">(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("msih-customers-view");
      if (stored === "card" || stored === "table") return stored;
    }
    return "card";
  });
  const toggleViewMode = (mode: "card" | "table") => {
    setViewMode(mode);
    try { window.localStorage.setItem("msih-customers-view", mode); } catch {}
  };

  const { data, isLoading } = useQuery({
    queryKey: ["customers", search],
    queryFn: () => {
      const p = new URLSearchParams({ search });
      return api<any>(`/api/customers?${p}`);
    },
  });

  const customers = data?.customers || [];

  // KPIs (top of page)
  const totalCust = customers.length;
  const totalEnquiries = customers.reduce((s: number, c: any) => s + (c._count?.enquiries || 0), 0);
  const industries = new Set(customers.map((c: any) => c.industry).filter(Boolean)).size;
  const states = new Set(customers.map((c: any) => c.state).filter(Boolean)).size;

  const selected = useQuery({
    queryKey: ["customer", selectedId],
    queryFn: () => api<any>(`/api/customers/${selectedId}`),
    enabled: !!selectedId,
  });

  const createMut = useMutation({
    mutationFn: (body: any) => api("/api/customers", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success("Customer created");
      qc.invalidateQueries({ queryKey: ["customers"] });
      setCreateOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Failed to create customer"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      api(`/api/customers/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success("Customer updated");
      qc.invalidateQueries({ queryKey: ["customer", selectedId] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      setEditOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Failed to update customer"),
  });

  const activityMut = useMutation({
    mutationFn: (body: any) => api("/api/activities", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success("Activity logged");
      qc.invalidateQueries({ queryKey: ["customer", selectedId] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to log activity"),
  });

  const deleteActivityMut = useMutation({
    mutationFn: (id: string) => api(`/api/activities/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Activity deleted");
      qc.invalidateQueries({ queryKey: ["customer", selectedId] });
      setActivityToDelete(null);
    },
    onError: (e: any) => {
      // 403 message is shown verbatim from server
      toast.error(e.message || "Failed to delete activity");
      setActivityToDelete(null);
    },
  });

  const sel = selected.data?.customer;

  // Customer 360 KPI strip values
  const kpi = useMemo(() => {
    if (!sel) return { totalEnquiries: 0, pipelineValue: 0, lastActivity: null as string | null };
    const totalEnquiries = sel.enquiries?.length || 0;
    const pipelineValue = (sel.enquiries || []).reduce(
      (s: number, e: any) => s + (e.orderValue || e.budget || 0),
      0
    );
    const activities = sel.activities || [];
    const lastActivity = activities.length
      ? activities.reduce((latest: string | null, a: any) => {
          if (!latest) return a.createdAt;
          return new Date(a.createdAt) > new Date(latest) ? a.createdAt : latest;
        }, null)
      : null;
    return { totalEnquiries, pipelineValue, lastActivity };
  }, [sel]);

  // Enquiries tab summary
  const enquiriesSummary = useMemo(() => {
    if (!sel) return { total: 0, converted: 0, pipeline: 0 };
    const list = sel.enquiries || [];
    return {
      total: list.length,
      converted: list.filter((e: any) => e.status === "CONVERTED").length,
      pipeline: list.reduce((s: number, e: any) => s + (e.orderValue || e.budget || 0), 0),
    };
  }, [sel]);

  // Edit allowed: ADMIN+ OR the creator
  const canEdit =
    !!sel &&
    (role === "ADMIN" || role === "SUPER_ADMIN" || sel.createdBy === currentUserId);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customers"
        description="Master customer directory with 360° view — enquiries, activities, and history."
        icon={Building2}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Customer
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="TOTAL CUSTOMERS" value={totalCust} icon={Building2} hint="In directory" accent="blue" />
        <KpiCard label="TOTAL ENQUIRIES" value={totalEnquiries} icon={Inbox} hint="Across all customers" accent="violet" />
        <KpiCard label="INDUSTRIES" value={industries} icon={TrendingUp} hint="Unique verticals" accent="emerald" />
        <KpiCard label="STATES COVERED" value={states} icon={MapPin} hint="Geographic reach" accent="amber" />
      </div>

      {/* Search + view toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by company, contact, mobile, city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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

      {/* List */}
      {isLoading ? (
        <ListSkeleton count={6} variant="card" />
      ) : customers.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No customers yet"
          description="Create your first customer record to start building the 360° database."
          action={<Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Customer</Button>}
        />
      ) : viewMode === "table" ? (
        <PullToRefresh
          onRefresh={async () => {
            await qc.refetchQueries({ queryKey: ["customers"] });
          }}
        >
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {/* Desktop / tablet table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="pl-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Company</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mobile</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Industry</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">City</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">State</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">Enquiries</TableHead>
                    <TableHead className="w-10 pr-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((c: any) => (
                    <TableRow
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className="group cursor-pointer hover:bg-muted/40"
                    >
                      <TableCell className="pl-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="shrink-0 rounded-md bg-gradient-to-br from-sky-500/15 to-violet-500/15 p-1.5 text-primary ring-1 ring-primary/15">
                            <Building2 className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{c.company}</p>
                            {c.email && <p className="truncate text-xs text-muted-foreground">{c.email}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-sm text-foreground">{c.contactPerson}</TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" />{c.mobile}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        {c.industry ? (
                          <Badge variant="secondary" className="text-[10px]">{c.industry}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">{c.city || "—"}</TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">{c.state || "—"}</TableCell>
                      <TableCell className="py-3 text-right">
                        <span className="font-semibold text-foreground">{c._count?.enquiries || 0}</span>
                      </TableCell>
                      <TableCell className="pr-4 py-3">
                        <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile stacked rows */}
            <div className="divide-y divide-border/60 md:hidden">
              {customers.map((c: any) => (
                <div
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className="flex items-start gap-3 p-3 transition cursor-pointer active:bg-muted/40"
                >
                  <div className="shrink-0 rounded-md bg-gradient-to-br from-sky-500/15 to-violet-500/15 p-1.5 text-primary ring-1 ring-primary/15">
                    <Building2 className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold text-foreground">{c.company}</p>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{c.contactPerson} · {c.mobile}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      {c.industry && <Badge variant="secondary" className="text-[10px] py-0 px-1.5">{c.industry}</Badge>}
                      {c.city && <span>{c.city}</span>}
                      {c.state && <span>· {c.state}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </PullToRefresh>
      ) : (
        <PullToRefresh
          onRefresh={async () => {
            await qc.refetchQueries({ queryKey: ["customers"] });
          }}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {customers.map((c: any) => (
              <Card
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className="group relative cursor-pointer overflow-hidden p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5"
              >
                {/* Animated left accent stripe */}
                <div
                  className="pointer-events-none absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-primary/0 transition-all duration-200 group-hover:bg-primary/60"
                  aria-hidden
                />
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 rounded-lg bg-gradient-to-br from-sky-500/15 to-violet-500/15 ring-1 ring-primary/20 transition-transform duration-200 group-hover:scale-105">
                    <AvatarFallback className="rounded-lg bg-transparent text-sm font-semibold text-primary">
                      {initials(c.company || "?")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">{c.company}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.contactPerson}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      {c.city && <span>{c.city}</span>}
                      {c.industry && <Badge variant="secondary" className="text-[10px] py-0 px-1.5">{c.industry}</Badge>}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-xs">
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{c._count?.enquiries || 0}</span> enquiries
                  </span>
                  {c.mobile && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Phone className="h-3 w-3" /> {c.mobile}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </PullToRefresh>
      )}

      {/* 360 Detail Sheet */}
      <Sheet open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selected.isLoading ? (
            <Loading label="Loading customer…" />
          ) : sel ? (
            <>
              <SheetHeader>
                <div className="flex items-start justify-between gap-2 pr-6">
                  <SheetTitle className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 rounded-lg bg-gradient-to-br from-sky-500/20 to-violet-500/20 ring-1 ring-primary/30">
                      <AvatarFallback className="rounded-lg bg-transparent text-sm font-semibold text-primary">
                        {initials(sel.company)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate">{sel.company}</p>
                    </div>
                  </SheetTitle>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditOpen(true)}
                      className="shrink-0"
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                    </Button>
                  )}
                </div>
                <SheetDescription>Customer 360° — full profile and history</SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                {/* Header KPI strip */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border bg-muted/30 p-3 text-center">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Enquiries</p>
                    <p className="mt-0.5 text-lg font-bold text-foreground">{kpi.totalEnquiries}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3 text-center">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Pipeline</p>
                    <p className="mt-0.5 text-lg font-bold text-foreground">{fmtINR(kpi.pipelineValue)}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3 text-center">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Last Activity</p>
                    <p className="mt-0.5 text-sm font-bold text-foreground" title={kpi.lastActivity ? fmtDateTime(kpi.lastActivity) : undefined}>
                      {kpi.lastActivity ? timeAgo(kpi.lastActivity) : "—"}
                    </p>
                  </div>
                </div>

                {/* Contact info */}
                <SectionCard title="Contact Information" icon={Building2}>
                  <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    <Field icon={FileText} label="Contact Person" value={sel.contactPerson} />
                    <Field icon={Phone} label="Mobile" value={sel.mobile} />
                    <Field icon={Mail} label="Email" value={sel.email} />
                    <Field icon={MapPin} label="City" value={sel.city} />
                    <Field icon={MapPin} label="State" value={sel.state} />
                    <Field icon={Globe} label="Website" value={sel.website} />
                    <Field icon={TrendingUp} label="Industry" value={sel.industry} />
                    <Field icon={Hash} label="GSTIN" value={sel.gstin} />
                  </div>
                  {sel.address && (
                    <div className="mt-3 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Address:</span> {sel.address}
                    </div>
                  )}
                </SectionCard>

                {/* Tabs: Enquiries / Activities */}
                <Tabs defaultValue="enquiries">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="enquiries">
                      <Inbox className="mr-2 h-3.5 w-3.5" /> Enquiries ({sel.enquiries?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="activities">
                      <ActivityIcon className="mr-2 h-3.5 w-3.5" /> Activity ({sel.activities?.length || 0})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="enquiries" className="mt-3 space-y-2">
                    {(sel.enquiries?.length || 0) > 0 && (
                      <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{enquiriesSummary.total}</span> enquiries
                        {" · "}
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{enquiriesSummary.converted}</span> converted
                        {" · "}
                        <span className="font-semibold text-foreground">{fmtINR(enquiriesSummary.pipeline)}</span> total pipeline
                      </div>
                    )}
                    {sel.enquiries?.length ? (
                      sel.enquiries.map((e: any) => (
                        <Card
                          key={e.id}
                          className="cursor-pointer p-3 transition-colors hover:bg-muted/40"
                          onClick={() => { setSelectedId(null); openEnquiry(e.id); }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-mono text-xs text-muted-foreground">{e.enquiryNumber}</p>
                              <p className="truncate text-sm font-medium text-foreground">{e.productInterested}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <StatusBadge status={e.status} />
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(e.date)}</span>
                            {e.budget && <span className="inline-flex items-center gap-1"><IndianRupee className="h-3 w-3" />{fmtINR(e.budget)}</span>}
                          </div>
                          {e.assignedExecutive?.name && (
                            <div className="mt-1.5 flex items-center gap-1.5 border-t border-border/60 pt-1.5 text-[11px] text-muted-foreground">
                              <Avatar className="h-4 w-4 rounded-full">
                                <AvatarFallback className="rounded-full bg-muted text-[8px] font-semibold text-muted-foreground">
                                  {initials(e.assignedExecutive.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span>{e.assignedExecutive.name}</span>
                            </div>
                          )}
                        </Card>
                      ))
                    ) : (
                      <p className="py-6 text-center text-sm text-muted-foreground">No enquiries yet</p>
                    )}
                  </TabsContent>

                  <TabsContent value="activities" className="mt-3 space-y-3">
                    <ActivityForm
                      customerId={sel.id}
                      onSubmit={(v) => activityMut.mutate(v)}
                      loading={activityMut.isPending}
                    />
                    {sel.activities?.length ? (
                      <ActivityTimeline
                        activities={sel.activities}
                        currentUserId={currentUserId}
                        role={role}
                        onDelete={(id) => setActivityToDelete(id)}
                      />
                    ) : (
                      <p className="py-6 text-center text-sm text-muted-foreground">No activities logged</p>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Customer</DialogTitle>
            <DialogDescription>Add a customer to the master directory.</DialogDescription>
          </DialogHeader>
          <CustomerForm
            mode="create"
            onSubmit={(v) => createMut.mutate(v)}
            loading={createMut.isPending}
            submitLabel="Create Customer"
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>Update customer details. Only changed fields are sent.</DialogDescription>
          </DialogHeader>
          {sel && (
            <CustomerForm
              mode="edit"
              initial={sel}
              onSubmit={(v) => updateMut.mutate({ id: sel.id, body: v })}
              loading={updateMut.isPending}
              submitLabel="Save Changes"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete activity confirmation */}
      <AlertDialog open={!!activityToDelete} onOpenChange={(o) => !o && setActivityToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete activity?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The activity entry will be permanently removed
              from this customer&apos;s timeline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteActivityMut.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteActivityMut.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (activityToDelete) deleteActivityMut.mutate(activityToDelete);
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteActivityMut.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting…</>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------- Field (contact info row) ---------- */
function Field({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-foreground">{value || "—"}</p>
      </div>
    </div>
  );
}

/* ---------- Activity Timeline (vertical) ---------- */
function ActivityTimeline({
  activities, currentUserId, role, onDelete,
}: {
  activities: any[];
  currentUserId?: string;
  role: string;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="relative pl-6">
      {/* Vertical line */}
      <div className="absolute left-[14px] top-2 bottom-2 w-px border-l-2 border-border/60" aria-hidden />
      <div className="space-y-3">
        {activities.map((a: any) => {
          const meta = ACTIVITY_TYPES[a.type] || ACTIVITY_TYPES.NOTE;
          const Icon = meta.icon;
          const canDelete = role === "ADMIN" || role === "SUPER_ADMIN" || a.userId === currentUserId;
          return (
            <div key={a.id} className="relative">
              {/* Icon circle absolutely positioned on the line */}
              <div
                className={cn(
                  "absolute -left-6 top-0 z-10 flex h-7 w-7 items-center justify-center rounded-full ring-2 ring-background",
                  meta.tint
                )}
                title={meta.label}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="rounded-lg border border-border/60 bg-card p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn("border-0 px-1.5 py-0 text-[10px] font-bold uppercase", meta.tint)}
                    >
                      {meta.label}
                    </Badge>
                    {a.user && (
                      <div className="flex items-center gap-1.5">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="bg-gradient-to-br from-sky-500/15 to-violet-500/15 text-[9px] font-semibold text-primary">
                            {initials(a.user.name) || initialsFromEmail(a.user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium text-foreground">{a.user.name}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[10px] text-muted-foreground"
                      title={fmtDateTime(a.createdAt)}
                    >
                      {timeAgo(a.createdAt)}
                    </span>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(a.id)}
                        aria-label="Delete activity"
                        title="Delete activity"
                        className="rounded p-1 text-muted-foreground transition hover:bg-red-500/10 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-foreground whitespace-pre-wrap">{a.content}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Activity Form (with type pills) ---------- */
function ActivityForm({
  customerId, onSubmit, loading,
}: {
  customerId: string;
  onSubmit: (v: any) => void;
  loading: boolean;
}) {
  const [type, setType] = useState("NOTE");
  const [content, setContent] = useState("");

  const submit = () => {
    if (!content) return;
    onSubmit({ type, entity: "customer", entityId: customerId, description: content });
    setContent("");
    setType("NOTE");
  };

  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      {/* Type pill selector */}
      <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Activity type">
        {ACTIVITY_TYPE_ORDER.map((t) => {
          const meta = ACTIVITY_TYPES[t];
          const Icon = meta.icon;
          const isActive = type === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              aria-pressed={isActive}
              aria-label={`Activity type: ${meta.label}`}
              title={meta.label}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition-all",
                isActive
                  ? cn("border-transparent ring-1", meta.tint)
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-3 w-3" />
              <span>{meta.label}</span>
            </button>
          );
        })}
      </div>
      {/* Input row */}
      <div className="flex gap-2">
        <Input
          placeholder="Log an activity…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <Button size="sm" onClick={submit} disabled={loading || !content}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
        </Button>
      </div>
    </div>
  );
}

/* ---------- Customer Form (shared create + edit) ---------- */
function CustomerForm({
  mode, initial, onSubmit, loading, submitLabel,
}: {
  mode: "create" | "edit";
  initial?: any;
  onSubmit: (v: any) => void;
  loading: boolean;
  submitLabel: string;
}) {
  const [f, setF] = useState({
    company: initial?.company || "",
    contactPerson: initial?.contactPerson || "",
    mobile: initial?.mobile || "",
    email: initial?.email || "",
    city: initial?.city || "",
    state: initial?.state || "",
    address: initial?.address || "",
    industry: initial?.industry || "Manufacturing",
    gstin: initial?.gstin || "",
    website: initial?.website || "",
  });
  // Track original values to compute diff on edit (captured once on mount)
  const originalRef = useRef<typeof f>({ ...f });

  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  const submit = () => {
    if (!f.company || !f.contactPerson || !f.mobile) return;
    if (mode === "edit") {
      // Only send changed fields
      const diff: Record<string, string> = {};
      for (const k of Object.keys(f)) {
        if ((f as any)[k] !== (originalRef as any)[k]) {
          (diff as any)[k] = (f as any)[k];
        }
      }
      // If nothing changed, just close
      if (Object.keys(diff).length === 0) {
        onSubmit({});
        return;
      }
      onSubmit(diff);
    } else {
      onSubmit(f);
    }
  };

  const valid = f.company && f.contactPerson && f.mobile;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Company *</Label>
          <Input value={f.company} onChange={(e) => set("company", e.target.value)} placeholder="Tata Steel Ltd" />
        </div>
        <div>
          <Label>Contact Person *</Label>
          <Input value={f.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} placeholder="Rajesh Kumar" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Mobile *</Label>
          <Input value={f.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="9876543210" />
        </div>
        <div>
          <Label>Email</Label>
          <Input value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="rajesh@tata.com" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>City</Label>
          <Input value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="Mumbai" />
        </div>
        <div>
          <Label>State</Label>
          <Input value={f.state} onChange={(e) => set("state", e.target.value)} placeholder="Maharashtra" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Industry</Label>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={f.industry}
            onChange={(e) => set("industry", e.target.value)}
          >
            {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div>
          <Label>GSTIN</Label>
          <Input value={f.gstin} onChange={(e) => set("gstin", e.target.value)} placeholder="27AAAAA0000A1Z5" />
        </div>
      </div>
      <div>
        <Label>Website</Label>
        <Input value={f.website} onChange={(e) => set("website", e.target.value)} placeholder="https://example.com" />
      </div>
      <div>
        <Label>Address</Label>
        <Textarea value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Full address" rows={2} />
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={loading || !valid}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </div>
  );
}
