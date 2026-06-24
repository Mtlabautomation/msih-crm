"use client";
import { useQuery } from "@tanstack/react-query";
import { api, fmtINR, fmtNum } from "@/lib/api-client";
import { PageHeader, Loading, SectionCard, KpiCard, EmptyState } from "../shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BrainCircuit, TrendingUp, Sparkles, Target, Flame, AlertTriangle, Loader2, Zap } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function ForecastingView() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => api<any>("/api/dashboard") });
  if (isLoading || !data) return <Loading label="Loading forecast…" />;
  const { kpis, charts } = data;

  return (
    <div className="space-y-5">
      <PageHeader title="Forecasting" description="Revenue, demand, and pipeline predictions for planning." icon={TrendingUp} accent="emerald" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Pipeline Value" value={fmtINR(kpis.revenueForecast)} icon={TrendingUp} accent="emerald" hint="Active leads" />
        <KpiCard label="Expected Orders" value={fmtNum(Math.round(kpis.revenueForecast / 500000))} icon={Target} accent="blue" hint="Est. @ ₹5L avg" />
        <KpiCard label="Hot Leads" value={charts.funnel.find((f: any) => f.stage === "HOT")?.count || 0} icon={Flame} accent="red" hint="High probability" />
        <KpiCard label="Conversion Rate" value={`${kpis.conversionRate}%`} icon={Zap} accent="violet" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Product Demand Forecast" description="Predicted enquiry distribution" icon={Target}>
          {charts.productDemand.length === 0 ? <EmptyState icon={Target} title="No demand data" /> : (
            <div className="space-y-2">
              {charts.productDemand.map((p: any, i: number) => {
                const max = Math.max(...charts.productDemand.map((x: any) => x.count));
                const pct = (p.count / max) * 100;
                return (
                  <div key={p.name}>
                    <div className="mb-1 flex justify-between text-xs"><span className="truncate pr-2 font-medium text-foreground">{p.name}</span><span className="text-muted-foreground">{p.count} enquiries</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
        <SectionCard title="Regional Performance" description="Enquiries by state" icon={Target}>
          {charts.regionalDist.length === 0 ? <EmptyState icon={Target} title="No regional data" /> : (
            <div className="space-y-2">
              {charts.regionalDist.slice(0, 8).map((r: any) => {
                const max = Math.max(...charts.regionalDist.map((x: any) => x.count));
                const pct = (r.count / max) * 100;
                return (
                  <div key={r.state}>
                    <div className="mb-1 flex justify-between text-xs"><span className="font-medium text-foreground">{r.state}</span><span className="text-muted-foreground">{r.count}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-violet-500" style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="🤖 AI Forecast Narrative" description="Auto-generated sales forecast summary" icon={Sparkles}>
        <Card className="p-4">
          <p className="text-sm leading-relaxed text-foreground">
            Based on current pipeline analysis, MetTechnik has <strong>{fmtINR(kpis.revenueForecast)}</strong> in active opportunities across{" "}
            <strong>{kpis.totalEnquiries}</strong> enquiries. With a <strong>{kpis.conversionRate}%</strong> conversion rate and{" "}
            <strong>{charts.funnel.find((f: any) => f.stage === "HOT")?.count || 0} hot leads</strong>, projected closing value is approximately{" "}
            <strong className="text-emerald-600">{fmtINR(kpis.revenueForecast * (kpis.conversionRate / 100))}</strong>.
            {" "}{kpis.overdueFollowUps > 0 && <span className="text-amber-600">⚠️ {kpis.overdueFollowUps} overdue follow-ups risk pipeline leakage.</span>}
            {" "}Top demand: {(charts.productDemand[0]?.name || "N/A")}. Focus executive effort on hot leads in {(charts.regionalDist[0]?.state || "top regions")} for maximum revenue impact.
          </p>
        </Card>
      </SectionCard>
    </div>
  );
}
