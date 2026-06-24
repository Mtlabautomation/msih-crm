"use client";
import { PageHeader, SectionCard } from "../shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, Building2, User, Database, Shield, Info } from "lucide-react";

export function AdminSettingsView() {
  const settings = [
    { icon: Building2, label: "Company Name", value: "MetTechnik Pvt. Ltd." },
    { icon: Building2, label: "Company Address", value: "Plot No. 24, MIDC Bhosari, Pune - 411026, Maharashtra, India" },
    { icon: Building2, label: "Company Phone", value: "+91 98765 43210" },
    { icon: Shield, label: "GSTIN", value: "27AABCM1234L1Z5" },
    { icon: Database, label: "Currency", value: "INR (₹)" },
    { icon: User, label: "Developer", value: "Manoj Dore" },
    { icon: Database, label: "Version", value: "V1.0" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" description="Organization configuration & system settings." icon={Settings} />
      <SectionCard title="Organization Details" description="Company information used across reports & quotations" icon={Building2}>
        <div className="grid gap-3 sm:grid-cols-2">
          {settings.map((s) => (
            <Card key={s.label} className="flex items-start gap-3 p-4">
              <div className="rounded-lg bg-primary/10 p-2 text-primary"><s.icon className="h-4 w-4" /></div>
              <div className="min-w-0"><p className="text-xs uppercase text-muted-foreground">{s.label}</p><p className="truncate text-sm font-semibold text-foreground">{s.value}</p></div>
            </Card>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="System Information" description="About this CRM" icon={Info}>
        <Card className="p-4">
          <div className="flex flex-col gap-2 text-sm">
            <p className="flex justify-between"><span className="text-muted-foreground">Application</span><span className="font-semibold text-foreground">MSIH — MetTechnik Sales Intelligence Hub</span></p>
            <p className="flex justify-between"><span className="text-muted-foreground">Version</span><Badge>V1.0</Badge></p>
            <p className="flex justify-between"><span className="text-muted-foreground">Developer</span><span className="font-semibold text-foreground">Manoj Dore</span></p>
            <p className="flex justify-between"><span className="text-muted-foreground">License</span><Badge variant="secondary">MIT — Free & Open Source</Badge></p>
            <p className="flex justify-between"><span className="text-muted-foreground">Tech Stack</span><span className="text-foreground">Next.js 16 · TypeScript · Prisma · NextAuth</span></p>
          </div>
        </Card>
      </SectionCard>
    </div>
  );
}
