"use client";

// MSIH CRM V1.0 — Shared Saved Views UI
// Reusable SavedViewsBar + SaveViewForm + useSavedViews hook.
// Used by Tasks and Quotations views. (Enquiries keeps its own inline copy for stability.)
// Developer: Manoj Dore — MIT License

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Bookmark, BookmarkCheck, ChevronDown, Save, Trash2, X, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SavedView = {
  id: string;
  name: string;
  entity: string;
  filters: string; // JSON string
  isDefault: boolean;
  isShared?: boolean;
  createdAt?: string;
};

/* ============================================================
 * useSavedViews — encapsulates the React Query boilerplate for
 * loading/saving/deleting/applying saved views for one entity.
 *
 * Generic over the filter shape T (e.g. { status, search }).
 * Caller maintains the individual filter state vars and passes
 * them aggregated as `filters` + a `setFilters` callback that
 * can decompose the object back into individual setters.
 * ============================================================ */
export function useSavedViews<T extends Record<string, any>>({
  entity,
  filters,
  setFilters,
  defaultFilters,
}: {
  entity: string;
  filters: T;
  setFilters: (f: T) => void;
  defaultFilters: T;
}) {
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [defaultApplied, setDefaultApplied] = useState(false);

  const { data: savedViewsData, refetch: refetchViews } = useQuery({
    queryKey: ["saved-views", entity],
    queryFn: () => api<{ views: SavedView[] }>(`/api/saved-views?entity=${entity}`),
  });

  const views: SavedView[] = savedViewsData?.views || [];
  const defaultView = views.find((v) => v.isDefault);

  // Shallow equality over the values of two filter objects
  const filtersEqual = (a: T, b: T): boolean => {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    return ak.every((k) => a[k] === b[k]);
  };

  const hasActiveFilters = !filtersEqual(filters, defaultFilters);

  // Auto-apply the default saved view on first mount (only when no manual
  // selection has been made yet and the filter state is still pristine).
  // This is a one-time synchronization effect that runs after the saved-views
  // query returns; once `defaultApplied` is true, it never runs again.
  useEffect(() => {
    if (defaultApplied) return;
    if (!defaultView) return;
    if (!activeViewId && filtersEqual(filters, defaultFilters)) {
      try {
        const f = JSON.parse(defaultView.filters) as Partial<T>;
        setFilters({ ...defaultFilters, ...f });
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time default-view application on mount
        setActiveViewId(defaultView.id);
      } catch {
        /* malformed filters JSON — ignore */
      }
    }
    setDefaultApplied(true);
  }, [defaultView, defaultApplied]);

  /* ---- mutations ---- */
  const saveViewMut = useMutation({
    mutationFn: (body: { name: string; entity: string; filters: T; isDefault: boolean }) =>
      api<SavedView>("/api/saved-views", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success("View saved");
      refetchViews();
    },
    onError: (e: Error) => toast.error(e.message || "Failed to save view"),
  });

  const deleteViewMut = useMutation({
    mutationFn: (id: string) => api(`/api/saved-views/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("View deleted");
      refetchViews();
      // If the active view was deleted, reset to defaults so the bar stays consistent.
      // (We don't have access to activeViewId here without a ref, so the caller's
      //  applyView/clearFilters handle the visual state.)
    },
    onError: (e: Error) => toast.error(e.message || "Failed to delete view"),
  });

  const setDefaultMut = useMutation({
    mutationFn: ({ id, isDefault }: { id: string; isDefault: boolean }) =>
      api<SavedView>(`/api/saved-views/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isDefault }),
      }),
    onSuccess: () => {
      toast.success("Default view updated");
      refetchViews();
    },
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });

  /* ---- imperative actions ---- */
  const applyView = (v: SavedView) => {
    try {
      const f = JSON.parse(v.filters) as Partial<T>;
      setFilters({ ...defaultFilters, ...f });
      setActiveViewId(v.id);
      toast.info(`Applied view: ${v.name}`);
    } catch {
      toast.error("Invalid view data");
    }
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
    setActiveViewId(null);
  };

  const saveView = (name: string, isDefault: boolean) => {
    saveViewMut.mutate({ name, entity, filters, isDefault });
  };

  const deleteView = (id: string) => {
    // If we're about to delete the active view, reset filters to default
    if (id === activeViewId) {
      setFilters(defaultFilters);
      setActiveViewId(null);
    }
    deleteViewMut.mutate(id);
  };

  const setDefaultView = (id: string, isDefault: boolean) => {
    setDefaultMut.mutate({ id, isDefault });
  };

  return {
    views,
    activeViewId,
    saveView,
    deleteView,
    setDefaultView,
    applyView,
    clearFilters,
    hasActiveFilters,
    isSaving: saveViewMut.isPending,
  };
}

/* ============================================================
 * SavedViewsBar — bookmark chips for each saved view + Save/Clear buttons.
 * Visually consistent with the inline SavedViewsBar in enquiries-view.tsx.
 * ============================================================ */
export function SavedViewsBar({
  views,
  activeViewId,
  onApply,
  onDelete,
  onSetDefault,
  onSaveCurrent,
  onClear,
  hasActiveFilters,
}: {
  views: SavedView[];
  activeViewId: string | null;
  onApply: (v: SavedView) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string, isDefault: boolean) => void;
  onSaveCurrent: () => void;
  onClear: () => void;
  hasActiveFilters: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-card/60 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Bookmark className="h-3.5 w-3.5" /> Views
        </span>
        {views.length === 0 ? (
          <span className="text-xs text-muted-foreground italic">No saved views yet</span>
        ) : (
          views.map((v) => (
            <div key={v.id} className="group relative">
              <button
                type="button"
                onClick={() => onApply(v)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition",
                  v.id === activeViewId
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
                title={v.isDefault ? "Default view — click to apply" : `Apply "${v.name}"`}
              >
                {v.isDefault && <BookmarkCheck className="h-3 w-3 text-primary" />}
                {v.name}
              </button>
              {/* Per-view actions dropdown on hover */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full border bg-background text-muted-foreground group-hover:flex hover:text-foreground"
                    aria-label={`Options for ${v.name}`}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  <DropdownMenuItem onClick={() => onApply(v)}>
                    <Bookmark className="mr-2 h-3.5 w-3.5" /> Apply
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSetDefault(v.id, !v.isDefault)}>
                    <BookmarkCheck className="mr-2 h-3.5 w-3.5" />{" "}
                    {v.isDefault ? "Unset default" : "Set as default"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    onClick={() => onDelete(v.id)}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={onSaveCurrent}
          disabled={!hasActiveFilters && views.length > 0}
        >
          <Save className="mr-1.5 h-3.5 w-3.5" /> Save View
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="mr-1.5 h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>
    </div>
  );
}

/* ============================================================
 * SaveViewForm — Dialog with name + "set as default" checkbox.
 * Self-contained: caller just passes `open`, `onOpenChange`,
 * `onSave`, `loading`, and (optional) `activeFilterCount`.
 *
 * The form fields live in a separate `SaveViewFormBody` component
 * that is only mounted when `open` is true, ensuring the input
 * state resets to defaults each time the dialog opens.
 * ============================================================ */
export function SaveViewForm({
  open,
  onOpenChange,
  onSave,
  loading,
  activeFilterCount = 0,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (name: string, isDefault: boolean) => void;
  loading: boolean;
  activeFilterCount?: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5 text-primary" /> Save Current View
          </DialogTitle>
          <DialogDescription>
            Save the current filter state as a reusable preset.
          </DialogDescription>
        </DialogHeader>
        {/* Render the body only when open so form state resets on each open */}
        {open && (
          <SaveViewFormBody
            onSave={onSave}
            loading={loading}
            activeFilterCount={activeFilterCount}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SaveViewFormBody({
  onSave,
  loading,
  activeFilterCount = 0,
}: {
  onSave: (name: string, isDefault: boolean) => void;
  loading: boolean;
  activeFilterCount: number;
}) {
  const [name, setName] = useState("");
  const [makeDefault, setMakeDefault] = useState(false);

  return (
    <div className="space-y-3 py-2">
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Current filters
        </p>
        {activeFilterCount === 0 ? (
          <p className="mt-0.5 text-sm text-foreground">
            No active filters — saves the default state
          </p>
        ) : (
          <p className="mt-0.5 text-sm text-foreground">
            <span className="font-semibold text-primary">{activeFilterCount}</span> active
            filter{activeFilterCount === 1 ? "" : "s"} will be saved
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sv-name">View name *</Label>
        <Input
          id="sv-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. High Priority Tasks"
          autoFocus
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="make-default-sv"
          checked={makeDefault}
          onCheckedChange={(v) => setMakeDefault(v === true)}
        />
        <Label htmlFor="make-default-sv" className="cursor-pointer text-sm font-normal">
          Set as default view (auto-applies on page load)
        </Label>
      </div>
      <DialogFooter>
        <Button
          onClick={() => onSave(name.trim(), makeDefault)}
          disabled={!name.trim() || loading}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save View
        </Button>
      </DialogFooter>
    </div>
  );
}
