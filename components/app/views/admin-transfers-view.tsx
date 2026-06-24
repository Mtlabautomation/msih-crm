"use client";
import { useQuery } from "@tanstack/react-query";
import { api, fmtDateTime } from "@/lib/api-client";
import { PageHeader, Loading, EmptyState } from "../shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeftRight, ArrowRight, User } from "lucide-react";

export function AdminTransfersView() {
  const { data, isLoading } = useQuery({ queryKey: ["enquiries-transfers"], queryFn: () => api<any>("/api/enquiries?limit=100") });
  const enquiries = (data?.enquiries || []).filter((e: any) => e.transfers?.length > 0 || e._count?.transfers > 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Lead Transfers" description="Track all lead ownership changes and transfer history." icon={ArrowLeftRight} />
      {isLoading ? <Loading /> : enquiries.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} title="No transfers recorded" description="When managers reassign leads, the full transfer history will appear here." />
      ) : (
        <div className="space-y-2">
          {enquiries.map((e: any) => (
            <Card key={e.id} className="p-4">
              <div className="flex items-center justify-between">
                <div><p className="font-semibold text-foreground">{e.company}</p><p className="text-xs text-muted-foreground">{e.enquiryNumber} · {e.productInterested}</p></div>
                <div className="flex items-center gap-2 text-sm"><span className="text-muted-foreground">Assigned to</span><Badge variant="secondary"><User className="mr-1 h-3 w-3" />{e.assignedExecutive?.name}</Badge></div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <p className="text-center text-xs text-muted-foreground">🔒 Complete transfer history (previous owner, new owner, reason, approver) is recorded per enquiry in the audit trail.</p>
    </div>
  );
}
