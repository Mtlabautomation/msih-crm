"use client";

// MSIH CRM V1.0 — Email Templates Management
// Admin-managed reusable templates for sales communications
// (welcome, follow-up, quotation sent, reminder, thank-you, general).
// Read = all roles; Create/Edit/Delete = ADMIN/SUPER_ADMIN only.
// Developer: Manoj Dore — MIT License

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, timeAgo } from "@/lib/api-client";
import { useSession } from "next-auth/react";
import { KpiCard, PageHeader, EmptyState, EnquiryCardSkeleton, KpiSkeleton } from "../shared";
import { PullToRefresh } from "../pull-to-refresh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
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
import { toast } from "sonner";
import {
  Mail, Plus, Search, Edit, Trash2, Eye, FileText, Tag, Clock, User,
  Layers, Sparkles, Copy, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = ["WELCOME", "FOLLOWUP", "QUOTATION", "REMINDER", "THANK_YOU", "GENERAL"] as const;

const categoryColor: Record<string, string> = {
  WELCOME: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  FOLLOWUP: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  QUOTATION: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  REMINDER: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  THANK_YOU: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  GENERAL: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

// Sample data for preview substitution
const SAMPLE_VARS: Record<string, string> = {
  company: "Acme Industries",
  contactPerson: "John Doe",
  product: "ZEISS Microscope",
  amount: "₹1,50,000",
  executivePhone: "+91 98765 43210",
};

// Replace {{var}} placeholders with provided values
function substitute(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? `{{${k}}}`);
}

// Safely parse the variables JSON string stored on the template
function parseVariables(v: string | null | undefined): string[] {
  if (!v) return [];
  try {
    const arr = JSON.parse(v);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function EmailTemplatesView() {
  const { data: session } = useSession();
  const me = session?.user as any;
  const role = me?.role || "EXECUTIVE";
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
  const qc = useQueryClient();

  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [previewTpl, setPreviewTpl] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["email-templates", category],
    queryFn: () => {
      const p = new URLSearchParams();
      if (category !== "all") p.set("category", category);
      return api<any>(`/api/email-templates?${p}`);
    },
  });

  const templates = data?.templates || [];

  // Client-side search across name + subject
  const filtered = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase();
    return templates.filter(
      (t: any) =>
        t.name?.toLowerCase().includes(q) ||
        t.subject?.toLowerCase().includes(q)
    );
  }, [templates, search]);

  // KPIs
  const total = templates.length;
  const byCategory = new Set(templates.map((t: any) => t.category)).size;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentlyUpdated = templates.filter(
    (t: any) => new Date(t.updatedAt) >= sevenDaysAgo
  ).length;
  const authoredByMe = templates.filter(
    (t: any) => t.createdBy === me?.id
  ).length;

  const createMut = useMutation({
    mutationFn: (body: any) =>
      api("/api/email-templates", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success("Template created");
      qc.invalidateQueries({ queryKey: ["email-templates"] });
      setCreateOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Failed to create template"),
  });

  const patchMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      api(`/api/email-templates/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success("Template updated");
      qc.invalidateQueries({ queryKey: ["email-templates"] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message || "Failed to update template"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      api(`/api/email-templates/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Template deleted");
      qc.invalidateQueries({ queryKey: ["email-templates"] });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete template"),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Email Templates"
        description="Reusable templates for quotations, follow-ups, and customer communications."
        icon={Mail}
        accent="violet"
        actions={
          isAdmin ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New Template
            </Button>
          ) : null
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
          {/* Template card grid skeleton */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <EnquiryCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Total Templates" value={total} icon={Mail} hint="All categories" accent="blue" />
            <KpiCard label="Categories" value={byCategory} icon={Layers} hint="Distinct types" accent="cyan" />
            <KpiCard label="Recently Updated" value={recentlyUpdated} icon={Clock} hint="Last 7 days" accent="amber" />
            <KpiCard label="Authored by Me" value={authoredByMe} icon={User} hint="Created by you" accent="emerald" />
          </div>

          {/* Filters */}
          <Card className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Tabs value={category} onValueChange={setCategory}>
                <TabsList className="flex h-auto flex-wrap gap-1 bg-muted/60">
                  <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                  {CATEGORIES.map((c) => (
                    <TabsTrigger key={c} value={c} className="text-xs">
                      {c.replace(/_/g, " ")}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div className="relative w-full lg:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search name or subject…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </Card>

          {/* Grid */}
          {filtered.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="No templates found"
              description={
                isAdmin
                  ? "Create your first email template to standardize sales communications."
                  : "No templates match your current filters."
              }
              action={
                isAdmin ? (
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> New Template
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <PullToRefresh
              onRefresh={async () => {
                await qc.refetchQueries({ queryKey: ["email-templates"] });
              }}
            >
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {filtered.map((t: any) => {
                  const vars = parseVariables(t.variables);
                  return (
                    <Card key={t.id} className="group flex flex-col p-4 transition-all hover:shadow-md">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-1">
                          {t.name}
                        </h3>
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                            categoryColor[t.category] || categoryColor.GENERAL
                          )}
                        >
                          <Tag className="h-3 w-3" />
                          {t.category?.replace(/_/g, " ")}
                        </span>
                      </div>

                      <div className="mt-2 flex items-start gap-1.5 text-xs">
                        <FileText className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                        <p className="line-clamp-1 font-medium text-foreground/80">
                          {t.subject || "—"}
                        </p>
                      </div>

                      <p className="mt-2 text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                        {t.body}
                      </p>

                      {vars.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {vars.slice(0, 4).map((v: string) => (
                            <span
                              key={v}
                              className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                            >
                              {`{{${v}}}`}
                            </span>
                          ))}
                          {vars.length > 4 && (
                            <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              +{vars.length - 4}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeAgo(t.updatedAt)}
                        </span>
                        <span className="flex items-center gap-1 truncate">
                          <User className="h-3 w-3 shrink-0" />
                          <span className="truncate">{t.user?.name || "Unknown"}</span>
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() => setPreviewTpl(t)}
                        >
                          <Eye className="mr-1 h-3 w-3" /> Preview
                        </Button>
                        {isAdmin && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => setEditing(t)}
                            >
                              <Edit className="mr-1 h-3 w-3" /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700"
                              onClick={() => setDeleteTarget(t)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </PullToRefresh>
          )}
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Email Template</DialogTitle>
            <DialogDescription>
              Compose a reusable template. Use {`{{variableName}}`} placeholders for personalization.
            </DialogDescription>
          </DialogHeader>
          <TemplateForm
            onSubmit={(v) => createMut.mutate(v)}
            loading={createMut.isPending}
            submitLabel="Create Template"
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>Update template content, category, and variables.</DialogDescription>
          </DialogHeader>
          {editing && (
            <TemplateForm
              key={editing.id}
              initial={editing}
              onSubmit={(v) => patchMut.mutate({ id: editing.id, body: v })}
              loading={patchMut.isPending}
              submitLabel="Save Changes"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Template?</DialogTitle>
            <DialogDescription>
              This will permanently delete &ldquo;{deleteTarget?.name}&rdquo;. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Sheet */}
      <Sheet open={!!previewTpl} onOpenChange={(o) => !o && setPreviewTpl(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {previewTpl && (
            <TemplatePreview tpl={previewTpl} executiveName={me?.name || "Executive"} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ============ Template Form (Create / Edit) ============ */
function TemplateForm({
  initial,
  onSubmit,
  loading,
  submitLabel,
}: {
  initial?: any;
  onSubmit: (v: any) => void;
  loading: boolean;
  submitLabel: string;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [subject, setSubject] = useState(initial?.subject || "");
  const [body, setBody] = useState(initial?.body || "");
  const [category, setCategory] = useState<string>(initial?.category || "GENERAL");
  const [varsInput, setVarsInput] = useState(
    parseVariables(initial?.variables).join(", ")
  );

  const submit = () => {
    if (!name || !subject || !body) return;
    const variables = varsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    onSubmit({ name, subject, body, category, variables });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>Template Name *</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Welcome Follow-up"
          />
        </div>
        <div>
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Subject *</Label>
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Email subject line"
        />
      </div>

      <div>
        <Label>Body *</Label>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={"Dear {{contactPerson}},\n\nThank you for your interest…"}
          rows={8}
          className="font-mono text-xs"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Use <code className="rounded bg-muted px-1">{`{{variableName}}`}</code> placeholders.
          Common: company, contactPerson, product, amount, executiveName, executivePhone.
        </p>
      </div>

      <div>
        <Label>Variables (comma-separated)</Label>
        <Input
          value={varsInput}
          onChange={(e) => setVarsInput(e.target.value)}
          placeholder="company, contactPerson, product"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Leave blank to auto-detect {`{{var}}`} placeholders from the body.
        </p>
      </div>

      <DialogFooter>
        <Button onClick={submit} disabled={loading || !name || !subject || !body}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </div>
  );
}

/* ============ Template Preview Sheet ============ */
function TemplatePreview({
  tpl,
  executiveName,
}: {
  tpl: any;
  executiveName: string;
}) {
  const vars = parseVariables(tpl.variables);
  const sampleVars: Record<string, string> = {
    ...SAMPLE_VARS,
    executiveName,
    senderName: executiveName, // alias used in some templates
  };
  const subject = substitute(tpl.subject || "", sampleVars);
  const body = substitute(tpl.body || "", sampleVars);

  const [copied, setCopied] = useState(false);
  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Clipboard not available");
    }
  };

  return (
    <div className="flex h-full flex-col">
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-sky-500" />
          Template Preview
        </SheetTitle>
        <SheetDescription>
          {tpl.name} · sample variable substitution
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-6">
        {vars.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
              Sample Variables
            </p>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {vars.map((v: string) => (
                <div
                  key={v}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <code className="text-muted-foreground">{`{{${v}}}`}</code>
                  <span className="truncate font-medium text-foreground">
                    {sampleVars[v] ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-lg border border-border p-4">
          <div className="mb-3 border-b border-border pb-2">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">
              Subject
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              {subject}
            </p>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
              Body
            </p>
            <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/90">
              {body}
            </pre>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Dummy data: company = Acme Industries, contactPerson = John Doe,
          product = ZEISS Microscope, amount = ₹1,50,000, executiveName ={" "}
          {executiveName}, executivePhone = +91 98765 43210
        </p>
      </div>

      <div className="border-t border-border p-4">
        <Button onClick={copyAll} variant="outline" className="w-full">
          <Copy className="mr-2 h-4 w-4" />
          {copied ? "Copied!" : "Copy Subject + Body"}
        </Button>
      </div>
    </div>
  );
}
