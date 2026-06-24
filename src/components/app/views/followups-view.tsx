"use client";

// MSIH CRM V1.0 — Module D: Follow-Up Management
// Buckets: today / tomorrow / overdue / completed
// Developer: Manoj Dore

import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { api, fmtDate, fmtDateTime, timeAgo, statusColor } from "@/lib/api-client";
import { useUI } from "@/lib/store";
import { KpiCard, PageHeader, EmptyState, StatusBadge, Skeleton } from "../shared";
import { PullToRefresh } from "../pull-to-refresh";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  PhoneCall, Phone, Mail, MessageCircle, Users, MapPin, Calendar,
  AlertTriangle, CheckCircle2, Clock, Flame, ArrowRight, Phone as PhoneIcon,
} from "lucide-react";

const BUCKETS = [
  { key: "today", label: "Today", icon: Clock, color: "text-amber-600" },
  { key: "tomorrow", label: "Tomorrow", icon: Calendar, color: "text-sky-600" },
  { key: "overdue", label: "Overdue", icon: AlertTriangle, color: "text-red-600" },
  { key: "completed", label: "Completed", icon: CheckCircle2, color: "text-emerald-600" },
];

const methodIcon: Record<string, any> = {
  CALL: Phone, EMAIL: Mail, WHATSAPP: MessageCircle, MEETING: Users, VISIT: MapPin,
};

export function FollowupsView() {
  const [bucket, setBucket] = useState("today");
  const { setView, openEnquiry } = useUI();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["followups", bucket],
    queryFn: () => api<any>(`/api/followups?bucket=${bucket}`),
  });

  const { data: ovData } = useQuery({
    queryKey: ["followups-overview"],
    queryFn: () => Promise.all([
      api<any>("/api/followups?bucket=today"),
      api<any>("/api/followups?bucket=overdue"),
      api<any>("/api/followups?bucket=tomorrow"),
      api<any>("/api/followups?bucket=completed"),
    ]).then(([t, o, tm, c]) => ({
      today: t.followUps.length, overdue: o.followUps.length,
      tomorrow: tm.followUps.length, completed: c.followUps.length,
    })),
  });

  const completeMut = useMutation({
    mutationFn: (id: string) => api<any>(`/api/followups/${id}`, { method: "PATCH", body: JSON.stringify({ completed: true }) }),
    onSuccess: () => {
      toast.success("Follow-up marked complete");
      qc.invalidateQueries({ queryKey: ["followups"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const followUps = data?.followUps || [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Follow-Up Management"
        description="Never miss a lead — track every follow-up in one place."
        icon={PhoneCall}
        actions={<Button onClick={() => setView("enquiries")}><PhoneCall className="mr-2 h-4 w-4" /> Go to Enquiries</Button>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Due Today" value={ovData?.today ?? 0} icon={Clock} accent="amber" />
        <KpiCard label="Overdue" value={ovData?.overdue ?? 0} icon={AlertTriangle} accent="red" />
        <KpiCard label="Tomorrow" value={ovData?.tomorrow ?? 0} icon={Calendar} accent="blue" />
        <KpiCard label="Completed" value={ovData?.completed ?? 0} icon={CheckCircle2} accent="emerald" />
      </div>

      <Tabs value={bucket} onValueChange={setBucket}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          {BUCKETS.map((b) => (
            <TabsTrigger key={b.key} value={b.key} className="text-xs">
              <b.icon className={cn("mr-1.5 h-3.5 w-3.5", b.color)} />{b.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-11 w-11 shrink-0 rounded-lg opacity-80" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-3/4 opacity-80" />
                  <Skeleton className="h-3 w-2/3 opacity-70" />
                  <div className="flex gap-2 pt-1">
                    <Skeleton className="h-4 w-16 rounded-full opacity-60" />
                    <Skeleton className="h-4 w-12 rounded-full opacity-50" />
                  </div>
                </div>
                <Skeleton className="h-7 w-24 rounded-md opacity-70" />
              </div>
            </Card>
          ))}
        </div>
      ) : followUps.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={`No ${bucket} follow-ups`}
          description={bucket === "overdue" ? "Great! You're all caught up." : "Follow-ups scheduled for this period will appear here."}
        />
      ) : (
        <PullToRefresh
          onRefresh={async () => {
            await qc.refetchQueries({ queryKey: ["followups"] });
          }}
        >
          <div className="space-y-2.5">
            {followUps.map((f: any) => {
              const MIcon = methodIcon[f.method] || Phone;
              const enq = f.enquiry;
              return (
                <Card key={f.id} className="p-4 transition hover:shadow-md">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className={cn("shrink-0 rounded-lg p-2.5 ring-1", bucket === "overdue" ? "bg-red-500/10 text-red-600 ring-red-500/20" : "bg-primary/10 text-primary ring-primary/15")}>
                        <MIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <button onClick={() => { setView("enquiries"); openEnquiry(enq.id); }} className="font-semibold text-foreground hover:text-primary hover:underline">
                            {enq?.company}
                          </button>
                          <StatusBadge status={enq?.status} />
                          <Badge variant="outline" className="text-[10px]">{f.method}</Badge>
                          {enq?.leadScore >= 70 && <Badge className="bg-red-500/15 text-red-600 dark:text-red-400"><Flame className="mr-1 h-3 w-3" />{enq.leadScore}</Badge>}
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {enq?.contactPerson} · {enq?.productInterested} · {enq?.mobile}
                        </p>
                        <p className="mt-1 text-sm text-foreground">{f.notes}</p>
                        {f.nextFollowUpDate && (
                          <p className={cn("mt-1 text-xs font-medium", bucket === "overdue" ? "text-red-600" : "text-muted-foreground")}>
                            <Calendar className="mr-1 inline h-3 w-3" />
                            {bucket === "overdue" ? "Was due: " : "Scheduled: "}{fmtDateTime(f.nextFollowUpDate)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {!f.completed && (
                        <Button size="sm" variant="outline" onClick={() => completeMut.mutate(f.id)}>
                          <CheckCircle2 className="mr-1.5 h-4 w-4 text-emerald-600" /> Mark Done
                        </Button>
                      )}
                      <a href={`tel:${enq?.mobile}`}>
                        <Button size="sm" variant="ghost"><PhoneIcon className="h-4 w-4" /></Button>
                      </a>
                      <Button size="sm" variant="ghost" onClick={() => { setView("enquiries"); openEnquiry(enq.id); }}>
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </PullToRefresh>
      )}
    </div>
  );
}
