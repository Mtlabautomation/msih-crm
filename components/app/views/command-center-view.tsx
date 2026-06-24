"use client";
import { useQuery } from "@tanstack/react-query";
import { api, fmtINR, fmtDate, fmtNum } from "@/lib/api-client";
import { PageHeader, Loading, KpiCard, SectionCard, EmptyState } from "../shared";
import { useUI } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LayoutGrid, Flame, TrendingUp, Clock, AlertTriangle, Sparkles, CalendarDays,
  ArrowRight, Target, PhoneCall, CheckCircle2,
} from "lucide-react";

export function CommandCenterView() {
  const { setView, openEnquiry } = useUI();
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => api<any>("/api/dashboard") });
  const { data: fuData } = useQuery({ queryKey: ["followups-overdue"], queryFn: () => api<any>("/api/followups?bucket=overdue") });
  if (isLoading || !data) return <Loading label="Loading command center…" />;
  const { kpis, hotLeads } = data;
  const overdue = fuData?.followUps || [];

  return (
    <div className="space-y-5">
      <PageHeader title="Manager Command Center" description="Your leadership dashboard — first screen for sales managers." icon={LayoutGrid} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Today's Enquiries" value={fmtNum(kpis.todayEnquiries)} icon={CalendarDays} accent="blue" />
        <KpiCard label="Hot Leads" value={hotLeads.length} icon={Flame} accent="red" />
        <KpiCard label="Overdue FU" value={kpis.overdueFollowUps} icon={AlertTriangle} accent="amber" />
        <KpiCard label="Open FU" value={kpis.openFollowUps} icon={PhoneCall} accent="violet" />
        <KpiCard label="Conversion" value={`${kpis.conversionRate}%`} icon={Target} accent="emerald" />
        <KpiCard label="Forecast" value={fmtINR(kpis.revenueForecast)} icon={TrendingUp} accent="cyan" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="🔥 Today's Priorities" description="Hot leads needing immediate attention" icon={Flame}>
          {hotLeads.length === 0 ? <EmptyState icon={Flame} title="No hot leads" /> : (
            <div className="space-y-2">
              {hotLeads.slice(0, 5).map((l: any) => (
                <button key={l.id} onClick={() => { setView("enquiries"); openEnquiry(l.id); }} className="flex w-full items-center justify-between rounded-lg border border-border p-3 text-left hover:border-primary/40 hover:bg-accent">
                  <div className="min-w-0"><p className="truncate font-semibold text-foreground">{l.company}</p><p className="truncate text-xs text-muted-foreground">{l.product} · {l.city}</p></div>
                  <div className="flex items-center gap-3"><Badge className="bg-red-500/15 text-red-600">{l.leadScore}</Badge><ArrowRight className="h-4 w-4 text-muted-foreground" /></div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="⏰ Overdue Follow-Ups" description="Need executive support" icon={Clock}>
          {overdue.length === 0 ? <EmptyState icon={CheckCircle2} title="No overdue follow-ups" description="Team is on track!" /> : (
            <div className="space-y-2">
              {overdue.slice(0, 5).map((f: any) => (
                <button key={f.id} onClick={() => { setView("enquiries"); openEnquiry(f.enquiry.id); }} className="flex w-full items-center justify-between rounded-lg border border-red-200 bg-red-50/50 p-3 text-left hover:bg-red-50 dark:border-red-900 dark:bg-red-950/30">
                  <div className="min-w-0"><p className="truncate font-semibold text-foreground">{f.enquiry?.company}</p><p className="truncate text-xs text-muted-foreground">{f.enquiry?.contactPerson} · {f.method}</p></div>
                  <Badge variant="destructive" className="text-[10px]">Overdue</Badge>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="✨ AI Recommendations" description="Smart insights from your sales data" icon={Sparkles}>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { icon: TrendingUp, t: "Revenue Forecast", d: `₹${fmtNum(kpis.revenueForecast)} in active pipeline — focus on converting HOT leads.`, c: "text-emerald-600" },
            { icon: Flame, t: "Lead Conversion", d: `${kpis.conversionRate}% conversion rate across ${kpis.totalEnquiries} enquiries. Target: 25%+.`, c: "text-amber-600" },
            { icon: AlertTriangle, t: "Follow-up Risk", d: `${kpis.overdueFollowUps} overdue follow-ups need immediate action to avoid lead loss.`, c: "text-red-600" },
            { icon: Target, t: "Weekly Summary", d: `${kpis.weekEnquiries} new enquiries this week, ${kpis.ordersClosed} orders closed.`, c: "text-sky-600" },
          ].map((r, i) => (
            <Card key={i} className="flex items-start gap-3 p-4">
              <r.icon className={`h-5 w-5 shrink-0 ${r.c}`} />
              <div><p className="text-sm font-semibold text-foreground">{r.t}</p><p className="text-xs text-muted-foreground">{r.d}</p></div>
            </Card>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
