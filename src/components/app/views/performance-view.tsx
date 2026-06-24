"use client";
import { useQuery } from "@tanstack/react-query";
import { api, fmtINR, fmtNum } from "@/lib/api-client";
import { PageHeader, Loading, EmptyState, SectionCard } from "../shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Trophy, TrendingUp, Award, Target } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { cn } from "@/lib/utils";

export function PerformanceView() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => api<any>("/api/dashboard") });
  if (isLoading || !data) return <Loading label="Loading performance data…" />;
  const perf = data.charts.employeePerf || [];
  const ranked = [...perf].sort((a: any, b: any) => b.revenue - a.revenue);

  return (
    <div className="space-y-5">
      <PageHeader title="Employee Performance" description="Team leaderboard, conversion rates, and revenue generated." icon={Users} accent="amber" />
      {perf.length === 0 ? <EmptyState icon={Users} title="No performance data" description="Performance metrics appear once executives have assigned enquiries." /> : (
        <>
          {/* Leaderboard */}
          <SectionCard title="🏆 Leaderboard" description="Ranked by revenue generated" icon={Trophy}>
            <div className="space-y-2">
              {ranked.map((e: any, i: number) => (
                <Card key={e.name} className={cn("flex items-center gap-3 p-3", i === 0 && "border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/20")}>
                  <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold", i === 0 ? "bg-amber-400 text-white" : i === 1 ? "bg-slate-300 text-slate-700" : i === 2 ? "bg-orange-300 text-orange-800" : "bg-muted text-muted-foreground")}>
                    {i + 1}
                  </div>
                  <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{e.name.split(" ").map((s: string) => s[0]).slice(0, 2).join("")}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{e.name}</p>
                    <p className="text-xs text-muted-foreground">{e.converted}/{e.assigned} converted · {e.conversion}% rate</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-foreground">{fmtINR(e.revenue)}</p>
                    <p className="text-xs text-muted-foreground">revenue</p>
                  </div>
                  {i === 0 && <Trophy className="h-5 w-5 text-amber-500" />}
                </Card>
              ))}
            </div>
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Conversion Comparison" description="Assigned vs converted" icon={Target}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={perf} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                  <Bar dataKey="assigned" name="Assigned" fill="#0EA5E9" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="converted" name="Converted" fill="#10B981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
            <SectionCard title="Revenue by Executive" description="Total revenue generated" icon={TrendingUp}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={perf} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: any) => fmtINR(v)} />
                  <Bar dataKey="revenue" name="Revenue" fill="#8B5CF6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
