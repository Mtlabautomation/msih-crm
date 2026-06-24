"use client";

// MSIH CRM V1.0 — Quotations Management
// List, filter, create, status update, and detail drawer for quotations.
// Card/Table view toggle persisted to localStorage.
// Developer: Manoj Dore — MIT License

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmtINR, fmtDate } from "@/lib/api-client";
import { useUI } from "@/lib/store";
import { KpiCard, PageHeader, StatusBadge, EmptyState, SectionCard, ListSkeleton } from "../shared";
import { SavedViewsBar, SaveViewForm, useSavedViews } from "../saved-views-bar";
import { PullToRefresh } from "../pull-to-refresh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableRow, TableCell, TableHead,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  FileSignature, Plus, Search, IndianRupee, Calendar, FileText, Building2,
  Loader2, CheckCircle2, XCircle, Clock, Send, Pencil, TrendingUp, Receipt,
  LayoutGrid, List, ArrowRight,
} from "lucide-react";

const QT_STATUSES = ["all", "DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "REVISED"];

const qtStatusColor: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300",
  SENT: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  ACCEPTED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  EXPIRED: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  REVISED: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
};

// Shape of the Quotations filter state — persisted to SavedView.filters JSON
type QuotationFilters = {
  status: string;
  search: string;
};

const DEFAULT_FILTERS: QuotationFilters = {
  status: "all",
  search: "",
};

export function QuotationsView() {
  const { openEnquiry } = useUI();
  const qc = useQueryClient();

  // Filter state — roundtripped through saved views (entity = QUOTATION)
  const [filters, setFilters] = useState<QuotationFilters>(DEFAULT_FILTERS);
  const { status, search } = filters;
  const setFilter = (patch: Partial<QuotationFilters>) =>
    setFilters((prev) => ({ ...prev, ...patch }));

  const sv = useSavedViews<QuotationFilters>({
    entity: "QUOTATION",
    filters,
    setFilters,
    defaultFilters: DEFAULT_FILTERS,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // View mode (card | table) persisted to localStorage
  const [viewMode, setViewMode] = useState<"card" | "table">(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("msih-quotations-view");
      if (stored === "card" || stored === "table") return stored;
    }
    return "card";
  });
  const toggleViewMode = (mode: "card" | "table") => {
    setViewMode(mode);
    try { window.localStorage.setItem("msih-quotations-view", mode); } catch {}
  };

  const { data, isLoading } = useQuery({
    queryKey: ["quotations", status, search],
    queryFn: () => {
      const p = new URLSearchParams({ status, search });
      return api<any>(`/api/quotations?${p}`);
    },
  });

  const { data: enquiriesData } = useQuery({
    queryKey: ["enquiries-qt-list"],
    queryFn: () => api<any>(`/api/enquiries?status=all&search=&page=1&limit=100`),
  });

  const quotations = data?.quotations || [];
  const selected = quotations.find((q: any) => q.id === selectedId);

  // KPIs
  const totalQt = quotations.length;
  const totalValue = quotations.reduce((s: number, q: any) => s + (q.amount || 0), 0);
  const accepted = quotations.filter((q: any) => q.status === "ACCEPTED");
  const acceptedValue = accepted.reduce((s: number, q: any) => s + (q.amount || 0), 0);
  const pending = quotations.filter((q: any) => q.status === "SENT" || q.status === "DRAFT").length;

  const createMut = useMutation({
    mutationFn: (body: any) => api("/api/quotations", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success("Quotation created");
      qc.invalidateQueries({ queryKey: ["quotations"] });
      setCreateOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Failed to create quotation"),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/api/quotations/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["quotations"] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to update"),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Quotations"
        description="Create, track, and manage price quotations for enquiries."
        icon={FileSignature}
        accent="cyan"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Quotation
          </Button>
        }
      />

      {/* KPI Row */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="TOTAL QUOTATIONS" value={totalQt} icon={FileText} hint="All quotations" accent="blue" />
        <KpiCard label="PIPELINE VALUE" value={fmtINR(totalValue)} icon={IndianRupee} hint="Sum of all quotations" accent="violet" />
        <KpiCard label="ACCEPTED" value={accepted.length} icon={CheckCircle2} hint={`${fmtINR(acceptedValue)} won`} accent="emerald" />
        <KpiCard label="PENDING" value={pending} icon={Clock} hint="Draft + Sent" accent="amber" />
      </div>

      {/* Saved Views Bar */}
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

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={status} onValueChange={(v) => setFilter({ status: v })}>
          <TabsList className="overflow-x-auto">
            {QT_STATUSES.map((s) => (
              <TabsTrigger key={s} value={s} className="text-xs">
                {s === "all" ? "All" : s}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by number, company…"
              value={search}
              onChange={(e) => setFilter({ search: e.target.value })}
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

      {/* List */}
      {isLoading ? (
        <ListSkeleton count={6} variant="card" />
      ) : quotations.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          title="No quotations found"
          description="Create your first quotation to start tracking sales proposals."
          action={<Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Quotation</Button>}
        />
      ) : viewMode === "table" ? (
        <PullToRefresh
          onRefresh={async () => {
            await qc.refetchQueries({ queryKey: ["quotations"] });
          }}
        >
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {/* Desktop / tablet table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="pl-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quotation #</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Company</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Product</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valid Until</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Created</TableHead>
                    <TableHead className="w-10 pr-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotations.map((q: any) => (
                    <TableRow
                      key={q.id}
                      onClick={() => setSelectedId(q.id)}
                      className="group cursor-pointer hover:bg-muted/40"
                    >
                      <TableCell className="pl-4 py-3">
                        <span className="font-mono text-xs font-semibold text-foreground">{q.number}</span>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="shrink-0 rounded-md bg-gradient-to-br from-sky-500/15 to-violet-500/15 p-1.5 text-primary ring-1 ring-primary/15">
                            <Building2 className="h-3.5 w-3.5" />
                          </div>
                          <span className="truncate font-medium text-foreground">{q.enquiry?.company || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate py-3 text-sm text-muted-foreground">
                        {q.enquiry?.productInterested || "—"}
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <span className="font-bold text-foreground">{fmtINR(q.amount)}</span>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase", qtStatusColor[q.status] || "bg-muted text-muted-foreground")}>
                          {q.status}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">{fmtDate(q.validUntil)}</TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">{fmtDate(q.createdAt)}</TableCell>
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
              {quotations.map((q: any) => (
                <div
                  key={q.id}
                  onClick={() => setSelectedId(q.id)}
                  className="flex items-start gap-3 p-3 transition cursor-pointer active:bg-muted/40"
                >
                  <div className="shrink-0 rounded-md bg-gradient-to-br from-sky-500/15 to-violet-500/15 p-1.5 text-primary ring-1 ring-primary/15">
                    <FileSignature className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-mono text-sm font-semibold text-foreground">{q.number}</p>
                      <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase", qtStatusColor[q.status] || "bg-muted text-muted-foreground")}>
                        {q.status}
                      </span>
                    </div>
                    <p className="truncate text-xs font-medium text-foreground">{q.enquiry?.company || "—"}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{q.enquiry?.productInterested || "—"}</p>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="font-bold text-foreground">{fmtINR(q.amount)}</span>
                      <span>Valid: {fmtDate(q.validUntil)}</span>
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
            await qc.refetchQueries({ queryKey: ["quotations"] });
          }}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {quotations.map((q: any) => (
              <Card
                key={q.id}
                onClick={() => setSelectedId(q.id)}
                className="group relative cursor-pointer overflow-hidden p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5"
              >
                {/* Animated left accent stripe */}
                <div
                  className="pointer-events-none absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-primary/0 transition-all duration-200 group-hover:bg-primary/60"
                  aria-hidden
                />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-foreground">{q.number}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{fmtDate(q.date)}</p>
                  </div>
                  <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${qtStatusColor[q.status] || "bg-muted text-muted-foreground"}`}>
                    {q.status}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="truncate text-sm font-medium text-foreground">{q.enquiry?.company || "—"}</p>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{q.enquiry?.productInterested}</p>
                <div className="mt-3 flex items-end justify-between border-t border-border/60 pt-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Amount</p>
                    <p className="text-lg font-bold text-foreground">{fmtINR(q.amount)}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    Valid until {fmtDate(q.validUntil)}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </PullToRefresh>
      )}

      {/* Detail Drawer */}
      <Sheet open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <FileSignature className="h-5 w-5 text-primary" />
                  {selected.number}
                </SheetTitle>
                <SheetDescription>
                  Quotation details and status management
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase ${qtStatusColor[selected.status]}`}>
                    {selected.status}
                  </span>
                  <span className="text-xs text-muted-foreground">Created {fmtDate(selected.createdAt)}</span>
                </div>

                <SectionCard title="Customer & Enquiry" icon={Building2}>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Company</span><span className="font-medium">{selected.enquiry?.company}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Contact</span><span className="font-medium">{selected.enquiry?.contactPerson}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Product</span><span className="font-medium text-right">{selected.enquiry?.productInterested}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Enquiry #</span><span className="font-mono text-xs">{selected.enquiry?.enquiryNumber}</span></div>
                  </div>
                </SectionCard>

                <SectionCard title="Financials" icon={IndianRupee}>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="text-lg font-bold text-foreground">{fmtINR(selected.amount)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Valid Until</span><span className="font-medium">{fmtDate(selected.validUntil)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Created By</span><span className="font-medium">{selected.user?.name || "—"}</span></div>
                  </div>
                </SectionCard>

                {selected.notes && (
                  <SectionCard title="Notes" icon={FileText}>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{selected.notes}</p>
                  </SectionCard>
                )}

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Update Status</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "REVISED"].map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={selected.status === s ? "default" : "outline"}
                        disabled={statusMut.isPending || selected.status === s}
                        onClick={() => statusMut.mutate({ id: selected.id, status: s })}
                        className="text-xs"
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>

                {selected.enquiry && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => { setSelectedId(null); openEnquiry(selected.enquiry.id); }}
                  >
                    View Related Enquiry →
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Quotation</DialogTitle>
            <DialogDescription>Create a quotation for an existing enquiry.</DialogDescription>
          </DialogHeader>
          <CreateQuotationForm
            enquiries={enquiriesData?.enquiries || []}
            onSubmit={(v) => createMut.mutate(v)}
            loading={createMut.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Save View Dialog */}
      <SaveViewForm
        open={saveViewOpen}
        onOpenChange={setSaveViewOpen}
        onSave={(name, isDefault) => {
          sv.saveView(name, isDefault);
          setSaveViewOpen(false);
        }}
        loading={sv.isSaving}
        activeFilterCount={
          (status !== "all" ? 1 : 0) + (search.trim() ? 1 : 0)
        }
      />
    </div>
  );
}

function CreateQuotationForm({
  enquiries, onSubmit, loading,
}: {
  enquiries: any[];
  onSubmit: (v: any) => void;
  loading: boolean;
}) {
  const [enquiryId, setEnquiryId] = useState("");
  const [amount, setAmount] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("DRAFT");

  const submit = () => {
    if (!enquiryId || !amount) return;
    onSubmit({ enquiryId, amount: parseFloat(amount), validUntil, notes, status });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Enquiry *</Label>
        <Select value={enquiryId} onValueChange={setEnquiryId}>
          <SelectTrigger><SelectValue placeholder="Select enquiry" /></SelectTrigger>
          <SelectContent className="max-h-72">
            {enquiries.map((e: any) => (
              <SelectItem key={e.id} value={e.id}>
                {e.enquiryNumber} · {e.company} · {e.productInterested}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Amount (₹) *</Label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </div>
        <div>
          <Label>Valid Until</Label>
          <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {["DRAFT", "SENT", "REVISED"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Terms, conditions, inclusions…" rows={3} />
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={loading || !enquiryId || !amount}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Quotation
        </Button>
      </DialogFooter>
    </div>
  );
}
