"use client";

// MSIH CRM V1.0 — Reminder Queue
// Schedule and track WhatsApp, SMS, and Email reminders to customers.
// Statuses: QUEUED → SENT | FAILED | CANCELLED. Retries supported on FAILED.
// All authenticated roles may create; EXECUTIVE sees only their own reminders.
// Developer: Manoj Dore — MIT License

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmtDateTime } from "@/lib/api-client";
import { useSession } from "next-auth/react";
import { KpiCard, PageHeader, EmptyState, EnquiryCardSkeleton, KpiSkeleton } from "../shared";
import { PullToRefresh } from "../pull-to-refresh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  BellRing, Plus, Search, Send, CheckCircle2, AlertTriangle, XCircle,
  Clock, MessageCircle, Mail, Smartphone, RefreshCw, Trash2, User,
  Building2, Loader2, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Channel = "WHATSAPP" | "SMS" | "EMAIL";
type Status = "QUEUED" | "SENT" | "FAILED" | "CANCELLED";

const STATUS_TABS: { key: string; label: string; dot: string }[] = [
  { key: "all", label: "All", dot: "bg-slate-400" },
  { key: "QUEUED", label: "Queued", dot: "bg-sky-500" },
  { key: "SENT", label: "Sent", dot: "bg-emerald-500" },
  { key: "FAILED", label: "Failed", dot: "bg-red-500" },
  { key: "CANCELLED", label: "Cancelled", dot: "bg-slate-500" },
];

const CHANNELS: Channel[] = ["WHATSAPP", "SMS", "EMAIL"];

const channelMeta: Record<
  Channel,
  { icon: typeof MessageCircle; label: string; color: string; ring: string; chip: string }
> = {
  WHATSAPP: {
    icon: MessageCircle,
    label: "WhatsApp",
    color: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/20 bg-emerald-500/10",
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  SMS: {
    icon: Smartphone,
    label: "SMS",
    color: "text-sky-600 dark:text-sky-400",
    ring: "ring-sky-500/20 bg-sky-500/10",
    chip: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  },
  EMAIL: {
    icon: Mail,
    label: "Email",
    color: "text-violet-600 dark:text-violet-400",
    ring: "ring-violet-500/20 bg-violet-500/10",
    chip: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  },
};

const statusBadge: Record<Status, string> = {
  QUEUED: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  SENT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  FAILED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  CANCELLED: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

function isOverdue(r: any): boolean {
  return r.status === "QUEUED" && new Date(r.scheduledAt) < new Date();
}

function isSentToday(r: any): boolean {
  if (r.status !== "SENT" || !r.sentAt) return false;
  const sent = new Date(r.sentAt);
  const now = new Date();
  return (
    sent.getFullYear() === now.getFullYear() &&
    sent.getMonth() === now.getMonth() &&
    sent.getDate() === now.getDate()
  );
}

export function RemindersView() {
  const { data: session } = useSession();
  const me = session?.user as any;
  const role = me?.role || "EXECUTIVE";
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
  const qc = useQueryClient();

  const [statusTab, setStatusTab] = useState("all");
  const [channelFilter, setChannelFilter] = useState<"all" | Channel>("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [failTarget, setFailTarget] = useState<any | null>(null);
  const [retryTarget, setRetryTarget] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["reminders"],
    queryFn: () => api<any>("/api/reminders?limit=500"),
  });

  // Optional relation lists for the create form
  const { data: enquiriesData } = useQuery({
    queryKey: ["enquiries-reminder-link"],
    queryFn: () => api<any>("/api/enquiries?limit=200"),
  });
  const { data: customersData } = useQuery({
    queryKey: ["customers-reminder-link"],
    queryFn: () => api<any>("/api/customers?limit=200"),
  });

  const reminders = data?.reminders || [];

  // KPIs (computed from the full, unfiltered list)
  const queued = reminders.filter((r: any) => r.status === "QUEUED").length;
  const sentToday = reminders.filter(isSentToday).length;
  const failed = reminders.filter((r: any) => r.status === "FAILED").length;
  const overdue = reminders.filter(isOverdue).length;

  // Status tab counts
  const statusCounts: Record<string, number> = {
    all: reminders.length,
    QUEUED: queued,
    SENT: reminders.filter((r: any) => r.status === "SENT").length,
    FAILED: failed,
    CANCELLED: reminders.filter((r: any) => r.status === "CANCELLED").length,
  };

  // Apply status + channel + search filters client-side
  const filtered = useMemo(() => {
    let list = reminders;
    if (statusTab !== "all") list = list.filter((r: any) => r.status === statusTab);
    if (channelFilter !== "all") list = list.filter((r: any) => r.channel === channelFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r: any) =>
          r.recipient?.toLowerCase().includes(q) ||
          r.recipientName?.toLowerCase().includes(q) ||
          r.message?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [reminders, statusTab, channelFilter, search]);

  const createMut = useMutation({
    mutationFn: (body: any) =>
      api("/api/reminders", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success("Reminder queued");
      qc.invalidateQueries({ queryKey: ["reminders"] });
      setCreateOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Failed to queue reminder"),
  });

  const patchMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      api(`/api/reminders/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: (_d, vars) => {
      const action =
        vars.body.status === "SENT"
          ? "Reminder marked as sent"
          : vars.body.status === "FAILED"
          ? "Reminder marked as failed"
          : vars.body.status === "CANCELLED"
          ? "Reminder cancelled"
          : vars.body.status === "QUEUED"
          ? "Reminder retried — back in queue"
          : "Reminder updated";
      toast.success(action);
      qc.invalidateQueries({ queryKey: ["reminders"] });
      setFailTarget(null);
      setRetryTarget(null);
    },
    onError: (e: any) => toast.error(e.message || "Failed to update reminder"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/reminders/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Reminder deleted");
      qc.invalidateQueries({ queryKey: ["reminders"] });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete reminder"),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reminder Queue"
        description="Schedule and track WhatsApp, SMS, and Email reminders to customers."
        icon={BellRing}
        accent="rose"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Reminder
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-5">
          {/* KPI row skeleton */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <KpiSkeleton key={i} />
            ))}
          </div>
          {/* Card grid skeleton */}
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <EnquiryCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <KpiCard label="QUEUED" value={queued} icon={Clock} hint="Waiting to send" accent="blue" />
            <KpiCard label="SENT TODAY" value={sentToday} icon={CheckCircle2} hint="Delivered today" accent="emerald" />
            <KpiCard label="FAILED" value={failed} icon={AlertTriangle} hint="Need attention" accent="red" />
            <KpiCard label="OVERDUE" value={overdue} icon={BellRing} hint="Queued & past scheduled time" accent="amber" />
          </div>

          {/* Filters */}
          <Card className="p-4">
            <div className="flex flex-col gap-3">
              {/* Status tabs with counts */}
              <Tabs value={statusTab} onValueChange={setStatusTab}>
                <TabsList className="flex h-auto flex-wrap gap-1 bg-muted/60">
                  {STATUS_TABS.map((t) => (
                    <TabsTrigger key={t.key} value={t.key} className="text-xs">
                      <span className={cn("inline-block h-1.5 w-1.5 rounded-full", t.dot)} />
                      {t.label}
                      <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                        {statusCounts[t.key] || 0}
                      </Badge>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              {/* Channel pills + search */}
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground mr-1">Channel:</span>
                  <button
                    onClick={() => setChannelFilter("all")}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      channelFilter === "all"
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    All
                  </button>
                  {CHANNELS.map((c) => {
                    const meta = channelMeta[c];
                    const Icon = meta.icon;
                    const active = channelFilter === c;
                    return (
                      <button
                        key={c}
                        onClick={() => setChannelFilter(c)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                          active
                            ? "bg-foreground text-background"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
                <div className="relative w-full lg:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search recipient, name, or message…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Reminder grid */}
          {filtered.length === 0 ? (
            <EmptyState
              icon={BellRing}
              title="No reminders found"
              description={
                reminders.length === 0
                  ? "Queue your first customer follow-up reminder — WhatsApp, SMS, or Email."
                  : "No reminders match the current filters."
              }
              action={
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> New Reminder
                </Button>
              }
            />
          ) : (
            <PullToRefresh
              onRefresh={async () => {
                await qc.refetchQueries({ queryKey: ["reminders"] });
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                {filtered.map((r: any) => (
                  <ReminderCard
                    key={r.id}
                    reminder={r}
                    meId={me?.id}
                    isAdmin={isAdmin}
                    onMarkSent={() => patchMut.mutate({ id: r.id, body: { status: "SENT" } })}
                    onMarkFailed={() => setFailTarget(r)}
                    onRetry={() => setRetryTarget(r)}
                    onCancel={() => patchMut.mutate({ id: r.id, body: { status: "CANCELLED" } })}
                    onDelete={() => setDeleteTarget(r)}
                    updating={patchMut.isPending}
                  />
                ))}
              </div>
            </PullToRefresh>
          )}
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Reminder</DialogTitle>
            <DialogDescription>
              Queue a WhatsApp, SMS, or Email reminder. The CRM does not auto-send — use the action buttons to mark delivery status.
            </DialogDescription>
          </DialogHeader>
          <CreateReminderForm
            enquiries={enquiriesData?.enquiries || []}
            customers={customersData?.customers || []}
            onSubmit={(v) => createMut.mutate(v)}
            loading={createMut.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Mark Failed Dialog */}
      <Dialog open={!!failTarget} onOpenChange={(o) => !o && setFailTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Reminder as Failed</DialogTitle>
            <DialogDescription>
              Record why this reminder could not be delivered. The attempt count will be incremented.
            </DialogDescription>
          </DialogHeader>
          <MarkFailedForm
            recipient={failTarget?.recipient}
            defaultValue={failTarget?.errorMessage || ""}
            loading={patchMut.isPending}
            onSubmit={(errMsg) =>
              patchMut.mutate({
                id: failTarget.id,
                body: { status: "FAILED", errorMessage: errMsg },
              })
            }
          />
        </DialogContent>
      </Dialog>

      {/* Retry Dialog */}
      <Dialog open={!!retryTarget} onOpenChange={(o) => !o && setRetryTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Retry Reminder</DialogTitle>
            <DialogDescription>
              Reset this failed reminder back into the queue. The error message will be cleared; the attempt count is retained for audit.
            </DialogDescription>
          </DialogHeader>
          {retryTarget && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold", channelMeta[retryTarget.channel as Channel]?.chip)}>
                    {channelMeta[retryTarget.channel as Channel]?.label}
                  </span>
                  {retryTarget.recipientName || retryTarget.recipient}
                </div>
                <p className="mt-2 text-xs text-muted-foreground line-clamp-3">{retryTarget.message}</p>
                {retryTarget.errorMessage && (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                    Previous error: {retryTarget.errorMessage}
                  </p>
                )}
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Attempts so far: {retryTarget.attemptCount || 0}
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRetryTarget(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    patchMut.mutate({
                      id: retryTarget.id,
                      body: { status: "QUEUED" },
                    })
                  }
                  disabled={patchMut.isPending}
                >
                  {patchMut.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Retry Now
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation (ADMIN+ only) */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Reminder</DialogTitle>
            <DialogDescription>
              This permanently removes the reminder from the queue. The action is recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold", channelMeta[deleteTarget.channel as Channel]?.chip)}>
                    {channelMeta[deleteTarget.channel as Channel]?.label}
                  </span>
                  {deleteTarget.recipientName || deleteTarget.recipient}
                </div>
                <p className="mt-2 text-xs text-muted-foreground line-clamp-3">{deleteTarget.message}</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                  Keep
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteMut.mutate(deleteTarget.id)}
                  disabled={deleteMut.isPending}
                >
                  {deleteMut.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Delete
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Reminder Card ---------- */
function ReminderCard({
  reminder: r,
  meId,
  isAdmin,
  onMarkSent,
  onMarkFailed,
  onRetry,
  onCancel,
  onDelete,
  updating,
}: {
  reminder: any;
  meId?: string;
  isAdmin: boolean;
  onMarkSent: () => void;
  onMarkFailed: () => void;
  onRetry: () => void;
  onCancel: () => void;
  onDelete: () => void;
  updating: boolean;
}) {
  const meta = channelMeta[r.channel as Channel] || channelMeta.WHATSAPP;
  const ChannelIcon = meta.icon;
  const overdue = isOverdue(r);
  const canModify = isAdmin || r.createdBy === meId;

  return (
    <Card className="group flex flex-col gap-3 p-4 transition-all hover:shadow-md">
      {/* Header row: channel + recipient + status */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className={cn("shrink-0 rounded-lg p-2 ring-1", meta.ring)}>
            <ChannelIcon className={cn("h-4 w-4", meta.color)} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {r.recipientName || "(no name)"}
            </p>
            <p className="truncate font-mono text-xs text-muted-foreground">{r.recipient}</p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            statusBadge[r.status as Status] || statusBadge.QUEUED
          )}
        >
          {r.status}
        </span>
      </div>

      {/* Message preview */}
      <p className="text-sm text-foreground/90 line-clamp-3 whitespace-pre-wrap break-words">
        {r.message}
      </p>

      {/* Linked enquiry + customer chips */}
      {(r.enquiry || r.customer) && (
        <div className="flex flex-wrap gap-1.5">
          {r.enquiry && (
            <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300">
              <FileText className="h-3 w-3" />
              {r.enquiry.enquiryNumber} · {r.enquiry.company}
            </span>
          )}
          {r.customer && (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <Building2 className="h-3 w-3" />
              {r.customer.company}
              {r.customer.contactPerson ? ` · ${r.customer.contactPerson}` : ""}
            </span>
          )}
        </div>
      )}

      {/* Meta row: scheduled / sent / attempts */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className={cn("inline-flex items-center gap-1", overdue && "font-medium text-amber-600 dark:text-amber-400")}>
          <Clock className="h-3 w-3" />
          {overdue ? "Overdue · " : "Scheduled "}
          {fmtDateTime(r.scheduledAt)}
        </span>
        {r.sentAt && (
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <Send className="h-3 w-3" />
            Sent {fmtDateTime(r.sentAt)}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <RefreshCw className="h-3 w-3" />
          {r.attemptCount || 0} attempt{(r.attemptCount || 0) === 1 ? "" : "s"}
        </span>
        {r.user && (
          <span className="inline-flex items-center gap-1">
            <User className="h-3 w-3" />
            {r.user.name}
          </span>
        )}
      </div>

      {/* Error message */}
      {r.status === "FAILED" && r.errorMessage && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="break-words">{r.errorMessage}</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
        {r.status === "QUEUED" && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-emerald-500/40 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950"
              onClick={onMarkSent}
              disabled={updating}
            >
              <CheckCircle2 className="mr-1 h-3 w-3" /> Mark Sent
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-red-500/40 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950"
              onClick={onMarkFailed}
              disabled={updating}
            >
              <XCircle className="mr-1 h-3 w-3" /> Mark Failed
            </Button>
            {canModify && (
              <Button size="sm" variant="ghost" className="h-7 text-muted-foreground" onClick={onCancel} disabled={updating}>
                <XCircle className="mr-1 h-3 w-3" /> Cancel
              </Button>
            )}
          </>
        )}
        {r.status === "FAILED" && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-sky-500/40 text-sky-600 hover:bg-sky-50 hover:text-sky-700 dark:text-sky-400 dark:hover:bg-sky-950"
              onClick={onRetry}
              disabled={updating}
            >
              <RefreshCw className="mr-1 h-3 w-3" /> Retry
            </Button>
            {canModify && (
              <Button size="sm" variant="ghost" className="h-7 text-muted-foreground" onClick={onCancel} disabled={updating}>
                <XCircle className="mr-1 h-3 w-3" /> Cancel
              </Button>
            )}
          </>
        )}
        {r.status === "SENT" && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" /> Delivered
          </span>
        )}
        {r.status === "CANCELLED" && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <XCircle className="h-3 w-3" /> Cancelled
          </span>
        )}

        {isAdmin && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-7 px-2 text-muted-foreground hover:text-red-600"
            onClick={onDelete}
            title="Delete (admin)"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </Card>
  );
}

/* ---------- Create Reminder Form ---------- */
function CreateReminderForm({
  enquiries,
  customers,
  onSubmit,
  loading,
}: {
  enquiries: any[];
  customers: any[];
  onSubmit: (v: any) => void;
  loading: boolean;
}) {
  const [channel, setChannel] = useState<Channel>("WHATSAPP");
  const [recipient, setRecipient] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [message, setMessage] = useState("");
  const [enquiryId, setEnquiryId] = useState("");
  const [customerId, setCustomerId] = useState("");
  // default to now (rounded to minutes, local time) for datetime-local input
  const nowLocal = useMemo(() => {
    const d = new Date();
    d.setSeconds(0, 0);
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tz).toISOString().slice(0, 16);
  }, []);
  const [scheduledAt, setScheduledAt] = useState(nowLocal);

  const recipientHint =
    channel === "EMAIL"
      ? "Customer email address"
      : channel === "SMS"
      ? "Customer mobile number (SMS)"
      : "Customer WhatsApp number (with country code)";

  const charCount = message.length;
  const overLimit = channel === "SMS" && charCount > 160;

  // Auto-fill recipient + name when a customer is selected
  function onCustomerChange(id: string) {
    setCustomerId(id);
    if (id) {
      const c = customers.find((x) => x.id === id);
      if (c) {
        if (!recipient) {
          setRecipient(channel === "EMAIL" ? c.email || "" : c.mobile || "");
        }
        if (!recipientName) setRecipientName(c.contactPerson || "");
      }
    }
  }

  function onEnquiryChange(id: string) {
    setEnquiryId(id);
    if (id) {
      const e = enquiries.find((x) => x.id === id);
      if (e) {
        if (!recipient) {
          setRecipient(channel === "EMAIL" ? e.email || "" : e.mobile || "");
        }
        if (!recipientName) setRecipientName(e.contactPerson || "");
        if (!customerId && e.customerId) setCustomerId(e.customerId);
      }
    }
  }

  function submit() {
    if (!recipient.trim() || !message.trim() || overLimit) return;
    onSubmit({
      channel,
      recipient: recipient.trim(),
      recipientName: recipientName.trim() || undefined,
      message,
      enquiryId: enquiryId || undefined,
      customerId: customerId || undefined,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>Channel</Label>
          <Select value={channel} onValueChange={(v) => setChannel(v as Channel)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="WHATSAPP">
                <span className="inline-flex items-center gap-2">
                  <MessageCircle className="h-3.5 w-3.5 text-emerald-600" /> WhatsApp
                </span>
              </SelectItem>
              <SelectItem value="SMS">
                <span className="inline-flex items-center gap-2">
                  <Smartphone className="h-3.5 w-3.5 text-sky-600" /> SMS
                </span>
              </SelectItem>
              <SelectItem value="EMAIL">
                <span className="inline-flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-violet-600" /> Email
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Scheduled At</Label>
          <Input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label>Recipient *</Label>
        <Input
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder={channel === "EMAIL" ? "customer@example.com" : "+91 98765 43210"}
        />
        <p className="mt-1 text-[11px] text-muted-foreground">{recipientHint}</p>
      </div>

      <div>
        <Label>Recipient Name (optional)</Label>
        <Input
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
          placeholder="e.g. John Doe"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label>Message *</Label>
          <span
            className={cn(
              "text-[11px]",
              overLimit
                ? "font-medium text-red-600"
                : channel === "SMS"
                ? "text-muted-foreground"
                : "text-muted-foreground"
            )}
          >
            {charCount}
            {channel === "SMS" ? " / 160 chars" : " chars"}
          </span>
        </div>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type the reminder message…"
          rows={4}
          className={cn(overLimit && "border-red-500 focus-visible:ring-red-500/30")}
        />
        {overLimit && (
          <p className="mt-1 text-[11px] text-red-600">
            SMS messages are limited to 160 characters. Trim the message or switch to WhatsApp/Email.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>Link to Enquiry (optional)</Label>
          <Select value={enquiryId} onValueChange={onEnquiryChange}>
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {enquiries.length === 0 ? (
                <SelectItem value="__none__" disabled>
                  No enquiries
                </SelectItem>
              ) : (
                enquiries.map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.enquiryNumber} · {e.company}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Link to Customer (optional)</Label>
          <Select value={customerId} onValueChange={onCustomerChange}>
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {customers.length === 0 ? (
                <SelectItem value="__none__" disabled>
                  No customers
                </SelectItem>
              ) : (
                customers.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company} · {c.contactPerson}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <Button onClick={submit} disabled={loading || !recipient.trim() || !message.trim() || overLimit}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Queue Reminder
        </Button>
      </DialogFooter>
    </div>
  );
}

/* ---------- Mark Failed Form ---------- */
function MarkFailedForm({
  recipient,
  defaultValue,
  loading,
  onSubmit,
}: {
  recipient?: string;
  defaultValue?: string;
  loading: boolean;
  onSubmit: (errMsg: string) => void;
}) {
  const [errMsg, setErrMsg] = useState(defaultValue || "");

  return (
    <div className="space-y-3">
      {recipient && (
        <p className="text-xs text-muted-foreground">
          Recipient: <span className="font-mono text-foreground">{recipient}</span>
        </p>
      )}
      <div>
        <Label>Error / Reason</Label>
        <Textarea
          value={errMsg}
          onChange={(e) => setErrMsg(e.target.value)}
          placeholder="e.g. Number not on WhatsApp, invalid email, recipient blocked, etc."
          rows={3}
        />
      </div>
      <DialogFooter>
        <Button
          variant="destructive"
          onClick={() => onSubmit(errMsg.trim() || "Delivery failed")}
          disabled={loading}
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
          Mark as Failed
        </Button>
      </DialogFooter>
    </div>
  );
}
