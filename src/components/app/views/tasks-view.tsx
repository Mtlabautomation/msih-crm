"use client";

// MSIH CRM V1.0 — Tasks Management (Kanban-style board)
// Create, assign, prioritize, and track tasks across OPEN / IN_PROGRESS / DONE / CANCELLED.
// Saved Views: persist named filter presets (entity="TASK").
// Developer: Manoj Dore — MIT License

import { useState, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmtDate, fmtDateTime } from "@/lib/api-client";
import { useUI } from "@/lib/store";
import { useSession } from "next-auth/react";
import { KpiCard, PageHeader, EmptyState, PageSkeleton } from "../shared";
import { PullToRefresh } from "../pull-to-refresh";
import { SavedViewsBar, SaveViewForm, useSavedViews } from "../saved-views-bar";
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
import { toast } from "sonner";
import {
  ListChecks, Plus, Loader2, Clock, CheckCircle2, AlertTriangle, Calendar,
  Flag, User, Trash2, Play, X, Filter, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

const COLUMNS = [
  { key: "OPEN", label: "To Do", accent: "border-t-slate-400", dot: "bg-slate-400" },
  { key: "IN_PROGRESS", label: "In Progress", accent: "border-t-sky-500", dot: "bg-sky-500" },
  { key: "DONE", label: "Done", accent: "border-t-emerald-500", dot: "bg-emerald-500" },
  { key: "CANCELLED", label: "Cancelled", accent: "border-t-rose-400", dot: "bg-rose-400" },
];

const PRIORITIES = ["all", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
const STATUSES = ["all", ...COLUMNS.map((c) => c.key)];

const priorityColor: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300",
  MEDIUM: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  HIGH: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  CRITICAL: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

// Shape of the Tasks filter state — persisted to SavedView.filters JSON
type TaskFilters = {
  status: string;
  priority: string;
  search: string;
  assigneeId: string;
};

const DEFAULT_FILTERS: TaskFilters = {
  status: "all",
  priority: "all",
  search: "",
  assigneeId: "",
};

export function TasksView() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role || "EXECUTIVE";
  const me = session?.user as any;
  const qc = useQueryClient();

  // Filter state — roundtripped through saved views
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_FILTERS);
  const { status, priority, search, assigneeId } = filters;
  const canFilterByAssignee = role === "MANAGER" || role === "ADMIN" || role === "SUPER_ADMIN";

  const setFilter = (patch: Partial<TaskFilters>) =>
    setFilters((prev) => ({ ...prev, ...patch }));

  const [createOpen, setCreateOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);

  // Saved views (entity = TASK)
  const sv = useSavedViews<TaskFilters>({
    entity: "TASK",
    filters,
    setFilters,
    defaultFilters: DEFAULT_FILTERS,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["tasks", assigneeId],
    queryFn: () => {
      const p = new URLSearchParams();
      if (canFilterByAssignee && assigneeId) p.set("assignee", assigneeId);
      return api<any>(`/api/tasks?${p}`);
    },
  });

  const { data: usersData } = useQuery({
    queryKey: ["users-tasks-list"],
    queryFn: () => api<any>("/api/users"),
  });

  // Client-side filter on top of the server response (priority + search + status-focus)
  const allTasks = data?.tasks || [];
  const tasks = useMemo(() => {
    let list = allTasks;
    if (priority !== "all") list = list.filter((t: any) => t.priority === priority);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t: any) =>
          t.title?.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.assignee?.name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allTasks, priority, search]);

  // When status filter is active, focus the kanban on just that column
  const visibleColumns =
    status === "all" ? COLUMNS : COLUMNS.filter((c) => c.key === status);

  // KPIs (computed on the filtered set)
  const open = tasks.filter((t: any) => t.status === "OPEN").length;
  const inProgress = tasks.filter((t: any) => t.status === "IN_PROGRESS").length;
  const done = tasks.filter((t: any) => t.status === "DONE").length;
  const overdue = tasks.filter(
    (t: any) => t.status !== "DONE" && t.status !== "CANCELLED" && t.dueDate && new Date(t.dueDate) < new Date()
  ).length;

  const createMut = useMutation({
    mutationFn: (body: any) => api("/api/tasks", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success("Task created");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setCreateOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Failed to create task"),
  });

  const patchMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      api(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to update task"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Task deleted");
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete"),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tasks"
        description="Track to-dos, follow-up actions, and team assignments in a Kanban board."
        icon={ListChecks}
        accent="amber"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Task
          </Button>
        }
      />

      {/* KPI Row */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="TO DO" value={open} icon={Clock} hint="Open tasks" accent="slate" />
        <KpiCard label="IN PROGRESS" value={inProgress} icon={Play} hint="Being worked on" accent="blue" />
        <KpiCard label="DONE" value={done} icon={CheckCircle2} hint="Completed" accent="emerald" />
        <KpiCard label="OVERDUE" value={overdue} icon={AlertTriangle} hint="Past due date" accent="red" />
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

      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by title, description, assignee…"
              value={search}
              onChange={(e) => setFilter({ search: e.target.value })}
              className="pl-9"
              aria-label="Search tasks"
            />
          </div>
          <Select
            value={priority}
            onValueChange={(v) => setFilter({ priority: v })}
          >
            <SelectTrigger className="w-36" aria-label="Filter tasks by priority">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p === "all" ? "All priorities" : p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(v) => setFilter({ status: v })}
          >
            <SelectTrigger className="w-36" aria-label="Filter tasks by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "all"
                    ? "All columns"
                    : COLUMNS.find((c) => c.key === s)?.label || s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canFilterByAssignee && (
            <Select
              value={assigneeId || "all"}
              onValueChange={(v) => setFilter({ assigneeId: v === "all" ? "" : v })}
            >
              <SelectTrigger className="w-48" aria-label="Filter tasks by assignee">
                <SelectValue placeholder="All assignees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All assignees</SelectItem>
                {(usersData?.users || []).map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="hidden items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-[10px] text-muted-foreground sm:flex">
          <kbd className="rounded bg-background px-1.5 py-0.5 font-mono text-[9px] font-semibold text-foreground shadow-sm">←</kbd>
          <kbd className="rounded bg-background px-1.5 py-0.5 font-mono text-[9px] font-semibold text-foreground shadow-sm">→</kbd>
          <span>move</span>
          <kbd className="ml-1 rounded bg-background px-1.5 py-0.5 font-mono text-[9px] font-semibold text-foreground shadow-sm">Enter</kbd>
          <span>advance</span>
          <kbd className="ml-1 rounded bg-background px-1.5 py-0.5 font-mono text-[9px] font-semibold text-foreground shadow-sm">Del</kbd>
          <span>delete</span>
        </div>
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <PageSkeleton variant="kanban" />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No tasks match"
          description="Try adjusting your filters, or create a new task to get started."
          action={<Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Task</Button>}
        />
      ) : (
        <PullToRefresh
          onRefresh={async () => {
            await qc.refetchQueries({ queryKey: ["tasks"] });
          }}
        >
          <div
            className={cn(
              "grid gap-3",
              visibleColumns.length === 1
                ? "grid-cols-1 max-w-2xl"
                : "md:grid-cols-2 xl:grid-cols-4"
            )}
          >
            {visibleColumns.map((col) => {
              const colTasks = tasks.filter((t: any) => t.status === col.key);
              return (
                <div
                  key={col.key}
                  role="list"
                  aria-label={`${col.label} column, ${colTasks.length} task${colTasks.length === 1 ? "" : "s"}`}
                  className={cn(
                    "flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3 border-t-4",
                    col.accent
                  )}
                >
                  <div className="flex items-center justify-between pb-2">
                    <div className="flex items-center gap-2">
                      <span className={cn("inline-block h-2 w-2 rounded-full", col.dot)} />
                      <p className="text-sm font-semibold text-foreground">{col.label}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">{colTasks.length}</Badge>
                  </div>
                  <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1">
                    {colTasks.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                        No tasks
                      </div>
                    ) : (
                      colTasks.map((t: any) => (
                        <div role="listitem" key={t.id}>
                          <TaskCard
                            task={t}
                            onMove={(status) => patchMut.mutate({ id: t.id, body: { status } })}
                            onDelete={() => deleteMut.mutate(t.id)}
                            canDelete={role !== "EXECUTIVE" || t.createdBy === me?.id}
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </PullToRefresh>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Task</DialogTitle>
            <DialogDescription>Create a task and assign it to a team member.</DialogDescription>
          </DialogHeader>
          <CreateTaskForm
            users={usersData?.users || []}
            defaultAssignee={me?.id}
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
          (status !== "all" ? 1 : 0) +
          (priority !== "all" ? 1 : 0) +
          (search.trim() ? 1 : 0) +
          (assigneeId ? 1 : 0)
        }
      />
    </div>
  );
}

function TaskCard({
  task, onMove, onDelete, canDelete,
}: {
  task: any;
  onMove: (status: string) => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const overdue = task.dueDate && task.status !== "DONE" && task.status !== "CANCELLED" && new Date(task.dueDate) < new Date();

  // Map current status to next/prev column for arrow-key navigation
  const order = ["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"];
  const idx = order.indexOf(task.status);

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Don't intercept when focus is inside an action button (let button handle it)
      const target = e.target as HTMLElement;
      if (target.tagName === "BUTTON" || target.closest("button")) return;

      if (e.key === "ArrowRight" && idx < order.length - 1) {
        e.preventDefault();
        onMove(order[idx + 1]);
      } else if (e.key === "ArrowLeft" && idx > 0) {
        e.preventDefault();
        onMove(order[idx - 1]);
      } else if (e.key === "Enter" || e.key === " ") {
        // Primary action: OPEN→IN_PROGRESS, IN_PROGRESS→DONE
        e.preventDefault();
        if (task.status === "OPEN") onMove("IN_PROGRESS");
        else if (task.status === "IN_PROGRESS") onMove("DONE");
      } else if ((e.key === "Delete" || e.key === "Backspace") && canDelete) {
        e.preventDefault();
        onDelete();
      }
    },
    [idx, order, onMove, onDelete, canDelete, task.status]
  );

  const ariaLabel = `Task: ${task.title}. Status: ${task.status}. Priority: ${task.priority}.${
    task.assignee ? ` Assignee: ${task.assignee.name}.` : ""
  }${overdue ? " Overdue." : ""} Use arrow keys to move between columns, Enter to advance status, Delete to remove.`;

  return (
    <Card
      ref={cardRef}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onKeyDown={handleKey}
      className="group relative cursor-default p-3 outline-none transition-all hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground leading-snug">{task.title}</p>
        <span
          className={cn("inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase", priorityColor[task.priority] || priorityColor.MEDIUM)}
          aria-label={`Priority ${task.priority}`}
        >
          {task.priority}
        </span>
      </div>
      {task.description && (
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{task.description}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        {task.dueDate && (
          <span className={cn("inline-flex items-center gap-1", overdue && "text-red-600 font-medium")} aria-label={`Due ${fmtDate(task.dueDate)}${overdue ? ", overdue" : ""}`}>
            <Calendar className="h-3 w-3" aria-hidden="true" />
            {fmtDate(task.dueDate)}
            {overdue && " · Overdue"}
          </span>
        )}
        {task.assignee && (
          <span className="inline-flex items-center gap-1" aria-label={`Assignee: ${task.assignee.name}`}>
            <User className="h-3 w-3" aria-hidden="true" />
            {task.assignee.name}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        {task.status !== "DONE" && task.status !== "CANCELLED" && (
          <>
            {task.status === "OPEN" && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => onMove("IN_PROGRESS")}
                aria-label={`Start task: ${task.title}`}
              >
                <Play className="mr-1 h-3 w-3" aria-hidden="true" /> Start
              </Button>
            )}
            {task.status === "IN_PROGRESS" && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-emerald-600"
                onClick={() => onMove("DONE")}
                aria-label={`Complete task: ${task.title}`}
              >
                <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" /> Complete
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-rose-600"
              onClick={() => onMove("CANCELLED")}
              aria-label={`Cancel task: ${task.title}`}
            >
              <X className="mr-1 h-3 w-3" aria-hidden="true" /> Cancel
            </Button>
          </>
        )}
        {task.status !== "DONE" && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => onMove("DONE")}
            aria-label={`Mark done: ${task.title}`}
          >
            <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" /> Done
          </Button>
        )}
        {canDelete && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-rose-600"
            onClick={onDelete}
            aria-label={`Delete task: ${task.title}`}
          >
            <Trash2 className="h-3 w-3" aria-hidden="true" />
          </Button>
        )}
      </div>
    </Card>
  );
}

function CreateTaskForm({
  users, defaultAssignee, onSubmit, loading,
}: {
  users: any[];
  defaultAssignee?: string;
  onSubmit: (v: any) => void;
  loading: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState(defaultAssignee || "");
  const [priority, setPriority] = useState("MEDIUM");
  const [dueDate, setDueDate] = useState("");

  const submit = () => {
    if (!title || !assigneeId) return;
    onSubmit({ title, description, assigneeId, priority, dueDate });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Title *</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Send revised quotation to Tata Steel" />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add details…" rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Assignee *</Label>
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {users.map((u: any) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Due Date</Label>
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={loading || !title || !assigneeId}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Task
        </Button>
      </DialogFooter>
    </div>
  );
}
