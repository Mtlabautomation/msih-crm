"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmtDate } from "@/lib/api-client";
import { PageHeader, Loading, EmptyState } from "../shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trash2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminDeletionsView() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["deletion-requests"], queryFn: () => api<any>("/api/deletion-requests") });
  const reqs = data?.requests || [];

  const [note, setNote] = useState<Record<string, string>>({});
  const decMut = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      api<any>(`/api/deletion-requests/${id}`, { method: "PATCH", body: JSON.stringify({ approve, adminNote: note[id] || "" }) }),
    onSuccess: (_d, v) => { toast.success(v.approve ? "Deletion approved & executed" : "Deletion request rejected"); qc.invalidateQueries({ queryKey: ["deletion-requests"] }); setNote((n) => ({ ...n, [v.id]: "" })); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Deletion Requests" description="Review and approve/reject data deletion requests." icon={Trash2} />
      {isLoading ? <Loading /> : reqs.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="No pending requests" description="All deletion requests have been processed." />
      ) : (
        <div className="space-y-3">
          {reqs.map((r: any) => (
            <Card key={r.id} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge className={cn("text-[10px]", r.status === "PENDING" ? "bg-amber-500/15 text-amber-600" : r.status === "APPROVED" ? "bg-emerald-500/15 text-emerald-600" : "bg-red-500/15 text-red-600")}>
                      {r.status === "PENDING" ? <Clock className="mr-1 h-3 w-3" /> : r.status === "APPROVED" ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                      {r.status}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">{r.entityType}</Badge>
                  </div>
                  <p className="mt-1.5 font-semibold text-foreground">{r.entityLabel}</p>
                  <p className="text-sm text-muted-foreground">Reason: {r.reason}</p>
                  <p className="text-xs text-muted-foreground">Requested by {r.requestedBy?.name || "—"} · {fmtDate(r.createdAt)}</p>
                </div>
                {r.status === "PENDING" && (
                  <div className="w-full shrink-0 space-y-2 sm:w-64">
                    <Textarea placeholder="Admin note (optional)…" value={note[r.id] || ""} onChange={(e) => setNote((n) => ({ ...n, [r.id]: e.target.value }))} rows={2} />
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" className="flex-1" onClick={() => decMut.mutate({ id: r.id, approve: true })}>Approve & Delete</Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => decMut.mutate({ id: r.id, approve: false })}>Reject</Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      <p className="text-center text-xs text-muted-foreground">📦 Approved deletions retain a backup snapshot in the audit log.</p>
    </div>
  );
}
