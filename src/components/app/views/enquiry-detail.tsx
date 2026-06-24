"use client";

// MSIH CRM V1.0 — Enquiry Detail Drawer
// Shows full enquiry + follow-ups + quotations + activity timeline + edit + transfer
// Developer: Manoj Dore

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmtINR, fmtDate, fmtDateTime, timeAgo, statusColor } from "@/lib/api-client";
import { useSession } from "next-auth/react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  StatusBadge,
  Loading,
  SectionCard,
  Timeline,
  type TimelineItemData,
  type TimelineTone,
} from "../shared";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Phone, Mail, MapPin, Building2, Package, IndianRupee, Calendar, PhoneCall,
  FileText, History, ArrowLeftRight, User, Edit3, Trash2, Plus, Flame,
  TrendingUp, Clock, CheckCircle2, MessageSquare, Send, Loader2,
  Users, MessageCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

const ENQ_STATUSES = ["NEW", "QUALIFIED", "HOT", "WARM", "COLD", "CONVERTED", "LOST"];

/* ---------- Follow-up method → icon / tone / label mapping ----------
 * Mirrors the Customer 360 Activity Timeline pattern (cycle #7-b) and the
 * Audit Logs view action-tone map (cycle #8-a). The tones feed the shared
 * `Timeline` component (see src/components/app/shared.tsx).
 */
const FU_METHOD_META: Record<string, { icon: LucideIcon; tone: TimelineTone; label: string }> = {
  CALL:     { icon: Phone,          tone: "sky",     label: "Phone Call" },
  EMAIL:    { icon: Mail,           tone: "violet",  label: "Email"       },
  VISIT:    { icon: Users,          tone: "emerald", label: "Visit"       },
  WHATSAPP: { icon: MessageCircle,  tone: "cyan",    label: "WhatsApp"    },
  MEETING:  { icon: Users,          tone: "emerald", label: "Meeting"     },
  NOTE:     { icon: FileText,       tone: "slate",   label: "Note"        },
};

// Pills rendered in the quick-add form — includes NOTE per task spec
const FU_METHOD_PILLS: { value: string; icon: LucideIcon }[] = [
  { value: "CALL",     icon: Phone         },
  { value: "EMAIL",    icon: Mail          },
  { value: "VISIT",    icon: Users         },
  { value: "WHATSAPP", icon: MessageCircle },
  { value: "MEETING",  icon: Users         },
  { value: "NOTE",     icon: FileText      },
];

// Helper: format the follow-up "title" badge based on completion state
function fuStatusBadge(completed: boolean) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide",
        completed
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400"
      )}
    >
      {completed ? "Completed" : "Open"}
    </Badge>
  );
}

export function EnquiryDetail({ enquiryId, onClose }: { enquiryId: string | null; onClose: () => void }) {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role || "EXECUTIVE";
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["enquiry", enquiryId],
    queryFn: () => api<any>(`/api/enquiries/${enquiryId}`),
    enabled: !!enquiryId,
  });

  const e = data?.enquiry;
  const canEdit = role !== "EXECUTIVE" || (e && (e.assignedTo === (session?.user as any)?.id || e.createdBy === (session?.user as any)?.id));
  const canTransfer = role === "ADMIN" || role === "SUPER_ADMIN" || role === "MANAGER";

  return (
    <Sheet open={!!enquiryId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {e?.company || "Enquiry"}
          </SheetTitle>
          <SheetDescription>
            {e?.enquiryNumber} · Created {timeAgo(e?.createdAt)}
          </SheetDescription>
        </SheetHeader>

        {isLoading || !e ? (
          <Loading label="Loading enquiry…" />
        ) : (
          <div className="mt-4 space-y-4">
            {/* status bar */}
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={e.status} />
              {e.leadScore >= 70 && <Badge className="bg-red-500/15 text-red-600 dark:text-red-400"><Flame className="mr-1 h-3 w-3" />Hot Lead · {e.leadScore}</Badge>}
              <Badge variant="outline" className="text-emerald-600"><TrendingUp className="mr-1 h-3 w-3" />{e.conversionProb}% conv.</Badge>
              {e.assignedExecutive && <Badge variant="secondary"><User className="mr-1 h-3 w-3" />{e.assignedExecutive.name}</Badge>}
            </div>

            {/* quick info grid */}
            <Card className="grid grid-cols-2 gap-3 p-4 text-sm">
              <Info icon={Phone} label="Mobile" value={e.mobile} />
              <Info icon={Mail} label="Email" value={e.email || "—"} />
              <Info icon={Package} label="Product" value={e.productInterested} />
              <Info icon={IndianRupee} label="Budget" value={e.budget ? fmtINR(e.budget) : "—"} />
              <Info icon={MapPin} label="Location" value={[e.city, e.state].filter(Boolean).join(", ") || "—"} />
              <Info icon={Calendar} label="Date" value={fmtDate(e.date)} />
              <Info icon={User} label="Contact" value={e.contactPerson} />
              <Info icon={Calendar} label="Next Follow-Up" value={e.nextFollowUpDate ? fmtDate(e.nextFollowUpDate) : "—"} />
            </Card>

            {e.specification && (
              <Card className="p-4">
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Specification</p>
                <p className="text-sm text-foreground">{e.specification}</p>
              </Card>
            )}
            {e.remarks && (
              <Card className="p-4">
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Remarks</p>
                <p className="text-sm text-foreground">{e.remarks}</p>
              </Card>
            )}

            {/* action buttons */}
            <div className="flex flex-wrap gap-2">
              <EditEnquiryButton enquiry={e} canEdit={canEdit} />
              {canTransfer && <TransferButton enquiry={e} />}
              <DeleteButton enquiry={e} role={role} />
            </div>

            {/* tabs */}
            <Tabs defaultValue="followups">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="followups" className="text-xs"><PhoneCall className="mr-1 h-3.5 w-3.5" />Follow-Ups ({e.followUps.length})</TabsTrigger>
                <TabsTrigger value="quotations" className="text-xs"><FileText className="mr-1 h-3.5 w-3.5" />Quotations ({e.quotations.length})</TabsTrigger>
                <TabsTrigger value="timeline" className="text-xs"><History className="mr-1 h-3.5 w-3.5" />Timeline</TabsTrigger>
              </TabsList>

              <TabsContent value="followups" className="mt-3 space-y-3">
                <FollowUpHistorySection
                  enquiryId={e.id}
                  followUps={e.followUps}
                  role={role}
                  currentUserId={(session?.user as any)?.id}
                />
              </TabsContent>

              <TabsContent value="quotations" className="mt-3 space-y-3">
                <AddQuotationForm enquiryId={e.id} />
                {e.quotations.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No quotations sent yet.</p>
                ) : (
                  <div className="space-y-2">
                    {e.quotations.map((q: any) => (
                      <Card key={q.id} className="flex items-center justify-between p-3">
                        <div>
                          <p className="font-semibold text-foreground">{q.number}</p>
                          <p className="text-xs text-muted-foreground">{fmtDate(q.date)} · {fmtINR(q.amount)}</p>
                        </div>
                        <Badge className={statusColor(q.status)}>{q.status}</Badge>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="timeline" className="mt-3 space-y-2">
                {e.transfers.length > 0 && (
                  <Card className="p-3">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground"><ArrowLeftRight className="h-3.5 w-3.5" />Transfer History</p>
                    {e.transfers.map((t: any) => (
                      <div key={t.id} className="border-t border-border py-2 text-xs first:border-0">
                        <p><span className="font-medium">{t.fromUser?.name}</span> → <span className="font-medium">{t.toUser?.name}</span></p>
                        <p className="text-muted-foreground">{t.reason}</p>
                        <p className="text-muted-foreground">{fmtDateTime(t.createdAt)}</p>
                      </div>
                    ))}
                  </Card>
                )}
                {e.activities.length === 0 && e.transfers.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
                ) : (
                  e.activities.map((a: any) => (
                    <Card key={a.id} className="flex items-start gap-3 p-3">
                      <div className="rounded-lg bg-muted p-1.5 text-muted-foreground"><MessageSquare className="h-3.5 w-3.5" /></div>
                      <div className="flex-1">
                        <p className="text-sm text-foreground">{a.content}</p>
                        <p className="text-xs text-muted-foreground">{a.user?.name} · {timeAgo(a.createdAt)}</p>
                      </div>
                    </Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Info({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

/* ---------- Follow-up History section (Timeline + quick-add form) ----------
 * Replaces the legacy card-list rendering inside the Enquiry detail sheet's
 * Follow-Ups tab. Uses the shared `Timeline` component (cycle #7-c) with
 * method-colored icons (mirrors the Customer 360 Activity Timeline pattern
 * from cycle #7-b). Wraps everything in a `SectionCard` so the summary
 * header, quick-add form, and timeline read as a single cohesive block.
 */
function FollowUpHistorySection({
  enquiryId,
  followUps,
  role,
  currentUserId,
}: {
  enquiryId: string;
  followUps: any[];
  role: string;
  currentUserId?: string;
}) {
  const qc = useQueryClient();

  // PATCH /api/followups/[id] — only toggles `completed: true` (per API route)
  const completeMut = useMutation({
    mutationFn: (id: string) =>
      api<any>(`/api/followups/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ completed: true }),
      }),
    onSuccess: () => {
      toast.success("Follow-up marked complete");
      qc.invalidateQueries({ queryKey: ["enquiry", enquiryId] });
      qc.invalidateQueries({ queryKey: ["followups"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Newest-first sort by `date` (the API already returns desc by date, but we
  // re-sort to be safe in case the consumer changes).
  const sorted = [...followUps].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const completedCount = sorted.filter((f) => f.completed).length;
  const nextFu = sorted.find((f) => f.nextFollowUpDate && !f.completed);
  const lastContact = sorted[0];

  // Build the Timeline items
  const items: TimelineItemData[] = sorted.map((f: any) => {
    const meta = FU_METHOD_META[f.method] || FU_METHOD_META.NOTE;
    const canComplete =
      !f.completed &&
      (role === "ADMIN" ||
        role === "SUPER_ADMIN" ||
        role === "MANAGER" ||
        f.createdBy === currentUserId);

    // Prefer nextFollowUpDate for the relative timestamp (it's the more
    // actionable date — "due in 3 days"), fall back to the actual contact date.
    const ts = f.nextFollowUpDate
      ? new Date(f.nextFollowUpDate)
      : new Date(f.date);

    return {
      id: f.id,
      icon: meta.icon,
      tone: meta.tone,
      title: (
        <span className="flex items-center gap-1.5">
          <span>{meta.label}</span>
          {fuStatusBadge(f.completed)}
        </span>
      ),
      content: f.notes,
      meta: (
        <span className="flex flex-wrap items-center gap-1">
          {f.outcome && (
            <>
              <span className="font-medium text-foreground/80">Outcome:</span>
              <span>{f.outcome}</span>
              <span aria-hidden>·</span>
            </>
          )}
          <span>by {f.user?.name || "—"}</span>
        </span>
      ),
      timestamp: timeAgo(ts),
      fullTimestamp: fmtDateTime(ts),
      actions: canComplete ? (
        <Button
          size="sm"
          variant="outline"
          className="h-6 gap-1 px-2 text-[10px]"
          disabled={completeMut.isPending}
          onClick={() => completeMut.mutate(f.id)}
        >
          <CheckCircle2 className="h-3 w-3" /> Mark complete
        </Button>
      ) : undefined,
    };
  });

  // Compact summary line shown as a styled banner above the quick-add form.
  // (SectionCard.description is typed as `string`, so we render the rich
  //  summary inline as a muted banner instead.)
  const summary = (
    <div className="mb-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <span className="block">
        <span className="font-semibold text-foreground">{sorted.length}</span> follow-ups
        {" · "}
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{completedCount}</span> completed
        {" · "}
        Next:{" "}
        <span className="font-medium text-foreground">
          {nextFu?.nextFollowUpDate ? fmtDate(nextFu.nextFollowUpDate) : "None scheduled"}
        </span>
        {lastContact && (
          <>
            {" · "}
            Last: <span className="font-medium text-foreground">{fmtDateTime(lastContact.date)}</span>
          </>
        )}
      </span>
    </div>
  );

  return (
    <SectionCard title="Follow-up History" icon={PhoneCall}>
      {summary}
      <AddFollowUpForm enquiryId={enquiryId} />
      <div className="mt-3">
        <Timeline items={items} />
      </div>
    </SectionCard>
  );
}

function AddFollowUpForm({ enquiryId }: { enquiryId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState("CALL");
  const [status, setStatus] = useState<"OPEN" | "COMPLETED">("OPEN");
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState("");
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");

  const m = useMutation({
    mutationFn: () =>
      api<any>("/api/followups", {
        method: "POST",
        body: JSON.stringify({
          enquiryId,
          method,
          notes: notes.trim(),
          outcome: outcome.trim() || null,
          status, // "OPEN" | "COMPLETED" — stored verbatim per task spec
          completed: status === "COMPLETED", // also flips the completion flag
          nextFollowUpDate: nextFollowUpDate || null,
        }),
      }),
    onSuccess: () => {
      toast.success("Follow-up logged");
      // Invalidate both the enquiry-detail cache (drives the Timeline) and the
      // global follow-ups cache (drives the Follow-Ups kanban view).
      qc.invalidateQueries({ queryKey: ["enquiry", enquiryId] });
      qc.invalidateQueries({ queryKey: ["followups"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setMethod("CALL");
      setStatus("OPEN");
      setNotes("");
      setOutcome("");
      setNextFollowUpDate("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" /> Log Follow-Up
      </Button>
    );
  }

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Log Follow-Up</p>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setOpen(false)} type="button">
          Cancel
        </Button>
      </div>

      {/* Method pills */}
      <div className="space-y-1.5">
        <Label className="text-xs">Method</Label>
        <div className="flex flex-wrap gap-1.5">
          {FU_METHOD_PILLS.map((p) => {
            const Icon = p.icon;
            const active = method === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => setMethod(p.value)}
                className={cn(
                  "inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                )}
                aria-pressed={active}
              >
                <Icon className="h-3 w-3" /> {p.value}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Notes *</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Discussion summary, key points, customer response…"
          rows={3}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Outcome (optional)</Label>
        <Input
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          placeholder="e.g. Will revert in 2 days"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Status</Label>
          <div className="flex gap-1.5">
            {(["OPEN", "COMPLETED"] as const).map((s) => {
              const active = status === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn(
                    "h-8 flex-1 rounded-md border text-[11px] font-semibold transition-colors",
                    active
                      ? s === "COMPLETED"
                        ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600"
                        : "border-sky-500 bg-sky-500 text-white hover:bg-sky-600"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  )}
                  aria-pressed={active}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Next Follow-Up</Label>
          <Input
            type="date"
            value={nextFollowUpDate}
            onChange={(e) => setNextFollowUpDate(e.target.value)}
          />
        </div>
      </div>

      <Button size="sm" onClick={() => m.mutate()} disabled={m.isPending || !notes.trim()}>
        {m.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Plus className="mr-2 h-4 w-4" />
        )}
        Add Follow-up
      </Button>
    </Card>
  );
}

function AddQuotationForm({ enquiryId }: { enquiryId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const m = useMutation({
    mutationFn: () => api<any>("/api/quotations", { method: "POST", body: JSON.stringify({ enquiryId, amount: parseFloat(amount), notes }) }),
    onSuccess: () => {
      toast.success("Quotation created");
      qc.invalidateQueries({ queryKey: ["enquiry", enquiryId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false); setAmount(""); setNotes("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!open) return <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Quotation</Button>;
  return (
    <Card className="space-y-3 p-4">
      <p className="text-sm font-semibold">Add Quotation</p>
      <div className="space-y-1.5">
        <Label className="text-xs">Amount (₹)</Label>
        <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 450000" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => m.mutate()} disabled={m.isPending || !amount}><Send className="mr-2 h-4 w-4" /> Create</Button>
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </Card>
  );
}

function EditEnquiryButton({ enquiry, canEdit }: { enquiry: any; canEdit: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(enquiry.status);
  const [budget, setBudget] = useState(enquiry.budget || "");
  const [nextFu, setNextFu] = useState(enquiry.nextFollowUpDate ? enquiry.nextFollowUpDate.slice(0, 10) : "");

  const m = useMutation({
    mutationFn: () => api<any>(`/api/enquiries/${enquiry.id}`, { method: "PATCH", body: JSON.stringify({ status, budget: budget ? parseFloat(budget) : null, nextFollowUpDate: nextFu || null }) }),
    onSuccess: () => {
      toast.success("Enquiry updated");
      qc.invalidateQueries({ queryKey: ["enquiry", enquiry.id] });
      qc.invalidateQueries({ queryKey: ["enquiries"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!canEdit) return null;
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Edit3 className="mr-2 h-4 w-4" /> Edit</Button>
      {open && (
        <Card className="absolute left-4 right-4 top-20 z-50 space-y-3 p-4 shadow-xl sm:left-auto sm:right-4 sm:w-80">
          <p className="text-sm font-semibold">Quick Edit</p>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{ENQ_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Budget (₹)</Label>
            <Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Next Follow-Up</Label>
            <Input type="date" value={nextFu} onChange={(e) => setNextFu(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => m.mutate()} disabled={m.isPending}>Save</Button>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </Card>
      )}
    </>
  );
}

function TransferButton({ enquiry }: { enquiry: any }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: usersData } = useQuery({ queryKey: ["users-list"], queryFn: () => api<any>("/api/users") });
  const [toUser, setToUser] = useState("");
  const [reason, setReason] = useState("");

  const m = useMutation({
    mutationFn: () => api<any>(`/api/enquiries/${enquiry.id}`, { method: "PATCH", body: JSON.stringify({ assignedTo: toUser, transferReason: reason }) }),
    onSuccess: () => {
      toast.success("Lead transferred");
      qc.invalidateQueries({ queryKey: ["enquiry", enquiry.id] });
      qc.invalidateQueries({ queryKey: ["enquiries"] });
      setOpen(false); setToUser(""); setReason("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const execs = (usersData?.users || []).filter((u: any) => u.role === "EXECUTIVE" && u.id !== enquiry.assignedTo);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}><ArrowLeftRight className="mr-2 h-4 w-4" /> Transfer</Button>
      {open && (
        <Card className="absolute left-4 right-4 top-20 z-50 space-y-3 p-4 shadow-xl sm:left-auto sm:right-4 sm:w-80">
          <p className="text-sm font-semibold">Transfer Lead</p>
          <p className="text-xs text-muted-foreground">Current: {enquiry.assignedExecutive?.name}</p>
          <div className="space-y-1.5">
            <Label className="text-xs">Assign To</Label>
            <Select value={toUser} onValueChange={setToUser}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select executive" /></SelectTrigger>
              <SelectContent>{execs.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Reason *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => m.mutate()} disabled={m.isPending || !toUser || !reason}>Transfer</Button>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </Card>
      )}
    </>
  );
}

function DeleteButton({ enquiry, role }: { enquiry: any; role: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const canDelete = role === "ADMIN" || role === "SUPER_ADMIN";

  const m = useMutation({
    mutationFn: () => api<any>(`/api/enquiries/${enquiry.id}?reason=${encodeURIComponent(reason)}`, { method: "DELETE" }),
    onSuccess: (d) => {
      toast.success(canDelete ? "Enquiry deleted permanently" : "Deletion request submitted to Admin");
      qc.invalidateQueries({ queryKey: ["enquiries"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false); setReason("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <Button variant="outline" size="sm" className="text-red-600 hover:text-red-600" onClick={() => setOpen(true)}><Trash2 className="mr-2 h-4 w-4" /> {canDelete ? "Delete" : "Request Delete"}</Button>
      {open && (
        <Card className="absolute left-4 right-4 top-20 z-50 space-y-3 p-4 shadow-xl sm:left-auto sm:right-4 sm:w-80">
          <p className="text-sm font-semibold text-red-600">{canDelete ? "Permanent Delete" : "Request Deletion"}</p>
          <p className="text-xs text-muted-foreground">{canDelete ? "This action cannot be undone. A backup will be retained in audit logs." : "Your request will be sent to an Admin for approval."}</p>
          <div className="space-y-1.5">
            <Label className="text-xs">Reason *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Why delete this enquiry?" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={() => m.mutate()} disabled={m.isPending || !reason}>Confirm</Button>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </Card>
      )}
    </>
  );
}
