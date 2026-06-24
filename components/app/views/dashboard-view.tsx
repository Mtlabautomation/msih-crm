"use client";

// MSIH CRM V1.0 — Module A: Dashboard
// KPIs + 6 charts (lead trend, funnel, product demand, source, employee perf, regional)
// Developer: Manoj Dore

import { useQuery } from "@tanstack/react-query";
import { api, fmtINR, fmtNum } from "@/lib/api-client";
import { useSession } from "next-auth/react";
import { KpiCard, ChartCard, EmptyState, PageSkeleton } from "../shared";
import { useUI } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, RadialBarChart, RadialBar, Legend,
} from "recharts";
import {
  Inbox, CalendarDays, CalendarRange, PhoneCall, FileText, CheckCircle2,
  Percent, TrendingUp, Activity, Filter, Target, MapPin, Flame, ArrowRight,
} from "lucide-react";
import { fmtDate } from "@/lib/api-client";

const COLORS = ["#0EA5E9", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#14B8A6", "#EC4899", "#64748B"];

export function DashboardView() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role || "EXECUTIVE";
  const { setView, openEnquiry } = useUI();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", role],
    queryFn: () => api<any>("/api/dashboard"),
    refetchInterval: 60000,
  });

  if (isLoading || !data) return <PageSkeleton variant="dashboard" />;

  const { kpis, charts, hotLeads } = data;

  return (
    <div className="space-y-6">
      {/* Greeting — gradient banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-sky-500/10 via-card to-violet-500/5 p-5 sm:p-6">
        {/* Decorative orbs */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-16 right-1/3 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl" aria-hidden />
        {/* Subtle dotted grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(circle, hsl(var(--muted-foreground) / 0.12) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary ring-1 ring-primary/20">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              Live Dashboard
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Welcome back, {session?.user?.name?.split(" ")[0]} <span className="inline-block animate-wave origin-[70%_70%]">👋</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Here&apos;s your sales overview for{" "}
              <span className="font-medium text-foreground/80">
                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </span>
              .
            </p>
          </div>
          <Button onClick={() => setView("enquiries")} className="w-fit shadow-sm">
            <Inbox className="mr-2 h-4 w-4" /> New Enquiry
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="Today's Enquiries" value={fmtNum(kpis.todayEnquiries)} icon={Inbox} accent="blue" hint="New leads today" />
        <KpiCard label="This Week" value={fmtNum(kpis.weekEnquiries)} icon={CalendarDays} accent="cyan" hint="Last 7 days" />
        <KpiCard label="This Month" value={fmtNum(kpis.monthEnquiries)} icon={CalendarRange} accent="violet" hint="Current month" />
        <KpiCard label="Open Follow-Ups" value={fmtNum(kpis.openFollowUps)} icon={PhoneCall} accent="amber" hint={`${kpis.overdueFollowUps} overdue`} />
        <KpiCard label="Quotations Sent" value={fmtNum(kpis.quotationsSent)} icon={FileText} accent="slate" hint="All time" />
        <KpiCard label="Orders Closed" value={fmtNum(kpis.ordersClosed)} icon={CheckCircle2} accent="emerald" hint="Converted leads" />
        <KpiCard label="Conversion Rate" value={`${kpis.conversionRate}%`} icon={Percent} accent="red" hint={`${fmtNum(kpis.totalEnquiries)} total enquiries`} />
        <KpiCard label="Revenue Forecast" value={fmtINR(kpis.revenueForecast)} icon={TrendingUp} accent="emerald" hint="Active pipeline value" />
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Lead Trend" description="Enquiries (last 30 days)" icon={Activity} className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={charts.leadTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} className="text-muted-foreground" />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                labelFormatter={(d) => new Date(d as string).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              />
              <Area type="monotone" dataKey="count" stroke="#0EA5E9" strokeWidth={2} fill="url(#leadGrad)" name="Enquiries" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Lead Sources" description="Where enquiries come from" icon={Filter}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={charts.sourceAnalysis} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                {charts.sourceAnalysis.map((_: any, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: any, n: any) => [`${v} enquiries`, n]} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Sales Funnel" description="Lead stages" icon={Target}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={charts.funnel} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={80} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`${v} leads`, "Count"]} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {charts.funnel.map((_: any, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Product Demand" description="Top enquiries by product" icon={Activity} className="lg:col-span-2">
          {charts.productDemand.length === 0 ? (
            <EmptyState icon={Activity} title="No product enquiries yet" description="Product demand will appear here." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={charts.productDemand} margin={{ top: 10, right: 10, left: -10, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={50} interval={0} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`${v} enquiries`, "Count"]} />
                <Bar dataKey="count" fill="#0EA5E9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Charts row 3 — only for manager+ */}
      {role !== "EXECUTIVE" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Employee Performance" description="Conversion & revenue by executive" icon={Target}>
            {charts.employeePerf.length === 0 ? (
              <EmptyState icon={Target} title="No executive data" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={charts.employeePerf} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                  <Bar yAxisId="left" dataKey="converted" name="Converted" fill="#10B981" radius={[6, 6, 0, 0]} />
                  <Bar yAxisId="left" dataKey="assigned" name="Assigned" fill="#0EA5E9" radius={[6, 6, 0, 0]} />
                  <Bar yAxisId="right" dataKey="conversion" name="Conv %" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Regional Distribution" description="Enquiries by state" icon={MapPin}>
            {charts.regionalDist.length === 0 ? (
              <EmptyState icon={MapPin} title="No regional data" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={charts.regionalDist.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="state" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`${v} enquiries`, "Count"]} />
                  <Bar dataKey="count" fill="#8B5CF6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      )}

      {/* Hot leads */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-red-500" />
            <h3 className="text-sm font-semibold text-foreground">Hot Leads</h3>
            <Badge variant="secondary" className="text-[10px]">{hotLeads.length}</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setView("enquiries")}>
            View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
        {hotLeads.length === 0 ? (
          <EmptyState icon={Flame} title="No hot leads" description="Hot leads will appear here as they're identified." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {hotLeads.map((lead: any) => (
              <button
                key={lead.id}
                onClick={() => { setView("enquiries"); openEnquiry(lead.id); }}
                className="group rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{lead.company}</p>
                    <p className="truncate text-xs text-muted-foreground">{lead.contactPerson} · {lead.product}</p>
                  </div>
                  <Badge className="bg-red-500/15 text-red-600 dark:text-red-400">HOT</Badge>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Lead Score</p>
                    <p className="text-lg font-bold text-foreground">{lead.leadScore}<span className="text-xs text-muted-foreground">/100</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase text-muted-foreground">Conv. Prob.</p>
                    <p className="text-lg font-bold text-emerald-600">{lead.conversionProb}%</p>
                  </div>
                </div>
                {lead.city && <p className="mt-2 text-xs text-muted-foreground">📍 {lead.city}</p>}
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
