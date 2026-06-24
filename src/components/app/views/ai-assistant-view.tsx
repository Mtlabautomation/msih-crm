"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmtINR, fmtDate } from "@/lib/api-client";
import { PageHeader, Loading, EmptyState, SectionCard } from "../shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BrainCircuit, Sparkles, Loader2, Flame, TrendingUp, AlertTriangle, Target, Zap, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export function AiAssistantView() {
  const { data: enqData } = useQuery({ queryKey: ["enquiries-ai"], queryFn: () => api<any>("/api/enquiries?limit=50") });
  const enquiries = enqData?.enquiries || [];

  const insightMut = useMutation({
    mutationFn: () => api<any>("/api/ai-assistant", { method: "POST", body: JSON.stringify({ action: "insights" }) }),
    onSuccess: () => toast.success("AI insights refreshed"),
    onError: (e: any) => toast.error(e.message),
  });

  const askMut = useMutation({
    mutationFn: (q: string) => api<any>("/api/ai-assistant", { method: "POST", body: JSON.stringify({ action: "ask", question: q }) }),
    onError: (e: any) => toast.error(e.message),
  });

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const stagnant = enquiries.filter((e: any) => {
    if (["CONVERTED", "LOST"].includes(e.status)) return false;
    const days = e.nextFollowUpDate ? Math.floor((Date.now() - new Date(e.nextFollowUpDate).getTime()) / 86400000) : 999;
    return days > 7;
  });
  const highProb = enquiries.filter((e: any) => e.conversionProb >= 60 && !["CONVERTED", "LOST"].includes(e.status)).sort((a: any, b: any) => b.conversionProb - a.conversionProb);
  const duplicates = enquiries.filter((e: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.mobile === e.mobile && x.mobile) !== i);

  return (
    <div className="space-y-5">
      <PageHeader title="AI Sales Assistant" description="Actionable recommendations powered by AI." icon={BrainCircuit} accent="violet"
        actions={<Button variant="outline" onClick={() => insightMut.mutate()} disabled={insightMut.isPending}>{insightMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Refresh Insights</Button>} />

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="🎯 Likely to Convert" description={`${highProb.length} high-probability leads`} icon={TrendingUp}>
          {highProb.length === 0 ? <EmptyState icon={TrendingUp} title="No high-probability leads" /> : (
            <div className="max-h-72 space-y-2 overflow-y-auto [scrollbar-width:thin]">
              {highProb.slice(0, 8).map((e: any) => (
                <div key={e.id} className="rounded-lg border border-border p-2.5"><div className="flex justify-between"><p className="truncate text-sm font-semibold text-foreground">{e.company}</p><Badge className="bg-emerald-500/15 text-emerald-600">{e.conversionProb}%</Badge></div><p className="truncate text-xs text-muted-foreground">{e.productInterested}</p></div>
              ))}
            </div>
          )}
        </SectionCard>
        <SectionCard title="⏰ Stagnant Leads" description={`${stagnant.length} inactive >7 days`} icon={AlertTriangle}>
          {stagnant.length === 0 ? <EmptyState icon={CheckCircle2} title="No stagnant leads" /> : (
            <div className="max-h-72 space-y-2 overflow-y-auto [scrollbar-width:thin]">
              {stagnant.slice(0, 8).map((e: any) => (
                <div key={e.id} className="rounded-lg border border-amber-200 bg-amber-50/40 p-2.5 dark:border-amber-900 dark:bg-amber-950/20"><p className="truncate text-sm font-semibold text-foreground">{e.company}</p><p className="text-xs text-muted-foreground">{e.status} · last FU {fmtDate(e.lastFollowUpDate)}</p></div>
              ))}
            </div>
          )}
        </SectionCard>
        <SectionCard title="🔁 Possible Duplicates" description={`${duplicates.length} detected`} icon={Zap}>
          {duplicates.length === 0 ? <EmptyState icon={CheckCircle2} title="No duplicates found" /> : (
            <div className="max-h-72 space-y-2 overflow-y-auto [scrollbar-width:thin]">
              {duplicates.slice(0, 8).map((e: any) => (
                <div key={e.id} className="rounded-lg border border-border p-2.5"><p className="truncate text-sm font-semibold text-foreground">{e.company}</p><p className="text-xs text-muted-foreground">📞 {e.mobile} · {e.enquiryNumber}</p></div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="💬 Ask AI Assistant" description="Ask any question about your sales data" icon={Sparkles}>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Which products have the highest demand? What should I prioritize today?" rows={2} />
          </div>
          <Button onClick={async () => { setAnswer(""); askMut.mutate(question, { onSuccess: (d) => setAnswer(d.answer) }); }} disabled={askMut.isPending || !question}>
            {askMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Ask AI
          </Button>
          <div className="flex flex-wrap gap-2">
            {["Which leads should I follow up today?", "Summarize my sales pipeline", "What's my revenue forecast?"].map((q) => (
              <Button key={q} size="sm" variant="outline" onClick={() => setQuestion(q)}>{q}</Button>
            ))}
          </div>
          {(askMut.isPending || answer) && (
            <Card className="p-4">
              {askMut.isPending ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> AI is analyzing your data…</p> :
                <div className="space-y-2"><div className="flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-primary" /><p className="text-xs font-semibold uppercase text-muted-foreground">AI Response</p></div><p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{answer}</p></div>}
            </Card>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
