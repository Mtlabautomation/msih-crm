"use client";

// MSIH CRM V1.0 — Calendar View
// Monthly calendar grid showing follow-ups + tasks due dates + enquiry creation dates.
// Developer: Manoj Dore — MIT License

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, fmtDate } from "@/lib/api-client";
import { useUI } from "@/lib/store";
import { PageHeader, EmptyState, Skeleton } from "../shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CalendarDays, ChevronLeft, ChevronRight, PhoneCall, ListChecks, Inbox,
  Clock, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type CalItem = {
  id: string;
  date: string;
  type: "followup" | "task" | "enquiry";
  title: string;
  meta?: string;
  status?: string;
};

export function CalendarView() {
  const { openEnquiry, setView } = useUI();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  // Fetch follow-ups (overdue + upcoming this month)
  const { data: fuData, isLoading: fuLoading } = useQuery({
    queryKey: ["calendar-followups", year, month],
    queryFn: () => api<any>("/api/followups"),
  });

  const { data: tasksData } = useQuery({
    queryKey: ["calendar-tasks"],
    queryFn: () => api<any>("/api/tasks"),
  });

  const { data: enqData } = useQuery({
    queryKey: ["calendar-enquiries"],
    queryFn: () => api<any>("/api/enquiries?status=all&search=&page=1&limit=200"),
  });

  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    const add = (date: string | Date, item: CalItem) => {
      const key = new Date(date).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    };

    (fuData?.followups || []).forEach((f: any) => {
      if (f.nextFollowUpDate) {
        add(f.nextFollowUpDate, {
          id: `fu-${f.id}`,
          date: f.nextFollowUpDate,
          type: "followup",
          title: f.enquiry?.company || "Follow-up",
          meta: f.enquiry?.productInterested,
          status: f.completed ? "DONE" : new Date(f.nextFollowUpDate) < new Date() ? "OVERDUE" : "PENDING",
        });
      }
    });

    (tasksData?.tasks || []).forEach((t: any) => {
      if (t.dueDate) {
        add(t.dueDate, {
          id: `t-${t.id}`,
          date: t.dueDate,
          type: "task",
          title: t.title,
          meta: t.assignee?.name,
          status: t.status,
        });
      }
    });

    (enqData?.enquiries || []).forEach((e: any) => {
      add(e.date, {
        id: `e-${e.id}`,
        date: e.date,
        type: "enquiry",
        title: e.company,
        meta: e.productInterested,
        status: e.status,
      });
    });

    return map;
  }, [fuData, tasksData, enqData]);

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isToday = (d: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  // Monthly stats
  const monthItems: CalItem[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const key = new Date(year, month, d).toDateString();
    monthItems.push(...(itemsByDay.get(key) || []));
  }
  const stats = {
    total: monthItems.length,
    followups: monthItems.filter((i) => i.type === "followup").length,
    tasks: monthItems.filter((i) => i.type === "task").length,
    enquiries: monthItems.filter((i) => i.type === "enquiry").length,
  };

  const prevMonth = () => setCursor(new Date(year, month - 1, 1));
  const nextMonth = () => setCursor(new Date(year, month + 1, 1));
  const goToday = () => {
    const d = new Date();
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const selectedItems = selectedDay ? (itemsByDay.get(new Date(selectedDay).toDateString()) || []) : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Calendar"
        description="Monthly view of follow-ups, tasks, and enquiry milestones."
        icon={CalendarDays}
        accent="amber"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
            <Button variant="outline" size="sm" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        }
      />

      {/* Month header + stats */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          {MONTHS[month]} <span className="text-muted-foreground">{year}</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-xs"><PhoneCall className="mr-1 h-3 w-3" /> {stats.followups} follow-ups</Badge>
          <Badge variant="secondary" className="text-xs"><ListChecks className="mr-1 h-3 w-3" /> {stats.tasks} tasks</Badge>
          <Badge variant="secondary" className="text-xs"><Inbox className="mr-1 h-3 w-3" /> {stats.enquiries} enquiries</Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Calendar grid */}
        <Card className="p-3">
          {fuLoading ? (
            <>
              {/* Weekday header skeleton */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={i} className="mx-auto h-3 w-8 opacity-70" />
                ))}
                {/* Calendar day cells skeleton */}
                {Array.from({ length: 35 }).map((_, i) => (
                  <Skeleton key={`c-${i}`} className="aspect-square rounded-lg opacity-50" />
                ))}
              </div>
              {/* Legend skeleton */}
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border/60 pt-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={`l-${i}`} className="h-3 w-20 opacity-60" />
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="pb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {d}
                  </div>
                ))}
                {cells.map((d, i) => {
                  if (d === null) return <div key={i} className="aspect-square" />;
                  const key = new Date(year, month, d).toDateString();
                  const items = itemsByDay.get(key) || [];
                  const today_ = isToday(d);
                  const overdue = items.some((it) => it.status === "OVERDUE");
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDay(new Date(year, month, d).toISOString())}
                      className={cn(
                        "group relative aspect-square rounded-lg border p-1.5 text-left transition-all hover:border-primary/40 hover:shadow-sm",
                        today_ ? "border-primary bg-primary/5" : "border-border/60 bg-card",
                        selectedDay === new Date(year, month, d).toISOString() && "ring-2 ring-primary ring-offset-1",
                        overdue && "border-red-300 dark:border-red-900/50"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                          today_ ? "bg-primary text-primary-foreground" : "text-foreground"
                        )}>
                          {d}
                        </span>
                        {items.length > 0 && (
                          <span className="text-[10px] font-bold text-muted-foreground">{items.length}</span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-0.5">
                        {items.slice(0, 3).map((it) => (
                          <span
                            key={it.id}
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              it.type === "followup" && (it.status === "OVERDUE" ? "bg-red-500" : it.status === "DONE" ? "bg-emerald-500" : "bg-sky-500"),
                              it.type === "task" && "bg-violet-500",
                              it.type === "enquiry" && "bg-amber-500"
                            )}
                          />
                        ))}
                        {items.length > 3 && <span className="text-[9px] text-muted-foreground">+{items.length - 3}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500" /> Follow-up</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-violet-500" /> Task</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Enquiry</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Overdue</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Done</span>
              </div>
            </>
          )}
        </Card>

        {/* Side panel: selected day items */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-foreground">
            {selectedDay ? fmtDate(selectedDay) : "Select a day"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {selectedItems.length === 0 ? "No items scheduled" : `${selectedItems.length} item${selectedItems.length > 1 ? "s" : ""} scheduled`}
          </p>

          <div className="mt-3 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {selectedItems.length === 0 ? (
              <EmptyState icon={CalendarDays} title="Nothing scheduled" description="Pick another day or schedule a follow-up." />
            ) : (
              selectedItems
                .sort((a, b) => a.type.localeCompare(b.type))
                .map((it) => (
                  <div
                    key={it.id}
                    className="rounded-lg border border-border/60 p-2.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{it.title}</p>
                        {it.meta && <p className="truncate text-xs text-muted-foreground">{it.meta}</p>}
                      </div>
                      <span className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase",
                        it.type === "followup" && "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
                        it.type === "task" && "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
                        it.type === "enquiry" && "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      )}>
                        {it.type}
                      </span>
                    </div>
                    {it.status && (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                        {it.status === "OVERDUE" && <AlertTriangle className="h-3 w-3 text-red-500" />}
                        {it.status === "DONE" && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                        {it.status === "PENDING" && <Clock className="h-3 w-3 text-sky-500" />}
                        <span>{it.status}</span>
                      </div>
                    )}
                  </div>
                ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
