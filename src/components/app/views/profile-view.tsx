"use client";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { api, fmtDate, roleColor } from "@/lib/api-client";
import { PageHeader, Loading, KpiCard } from "../shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserRound, Mail, Phone, MapPin, Calendar, Briefcase, Inbox, CheckCircle2, PhoneCall, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProfileView() {
  const { data: session } = useSession();
  const { data: meData, isLoading } = useQuery({ queryKey: ["me"], queryFn: () => api<any>("/api/me") });
  const u = meData?.user;
  const initials = (u?.name || "?").split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();
  const { data: dash } = useQuery({ queryKey: ["dashboard"], queryFn: () => api<any>("/api/dashboard") });

  return (
    <div className="space-y-5">
      <PageHeader title="My Profile" description="Your account information and activity summary." icon={UserRound} />
      {isLoading ? <Loading /> : u ? (
        <>
          <Card className="p-6">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <Avatar className="h-20 w-20 border-2 border-primary/20"><AvatarFallback className="bg-primary/10 text-xl font-bold text-primary">{initials}</AvatarFallback></Avatar>
              <div className="flex-1 text-center sm:text-left">
                <h2 className="text-xl font-bold text-foreground">{u.name}</h2>
                <div className="mt-1 flex flex-wrap justify-center gap-2 sm:justify-start">
                  <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", roleColor(u.role))}>{u.role.replace(/_/g, " ")}</span>
                  {u.designation && <Badge variant="outline">{u.designation}</Badge>}
                </div>
                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <p className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" />{u.email}</p>
                  <p className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" />{u.phone || "—"}</p>
                  <p className="flex items-center gap-2 text-muted-foreground"><Briefcase className="h-4 w-4" />{u.employeeId || "—"}</p>
                  <p className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" />{[u.city, u.state].filter(Boolean).join(", ") || "—"}</p>
                </div>
              </div>
            </div>
          </Card>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="My Enquiries" value={dash?.kpis?.totalEnquiries ?? 0} icon={Inbox} accent="blue" />
            <KpiCard label="Open Follow-Ups" value={dash?.kpis?.openFollowUps ?? 0} icon={PhoneCall} accent="amber" />
            <KpiCard label="Quotations" value={dash?.kpis?.quotationsSent ?? 0} icon={FileText} accent="slate" />
            <KpiCard label="Orders Closed" value={dash?.kpis?.ordersClosed ?? 0} icon={CheckCircle2} accent="emerald" />
          </div>
        </>
      ) : <Loading />}
    </div>
  );
}
