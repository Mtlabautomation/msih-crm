"use client";

// MSIH CRM V1.0 — Module H: Reports
// Hero banner + KPI hints + Real PDF export (jspdf + autotable) + per-card CSV exports + date range
// Developer: Manoj Dore

import { useQuery } from "@tanstack/react-query";
import {
  api,
  fmtINR,
  fmtNum,
  fmtDate,
  fmtDateTime,
} from "@/lib/api-client";
import {
  PageHeader,
  Loading,
  SectionCard,
  KpiCard,
  EmptyState,
} from "../shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileText,
  Download,
  Calendar,
  TrendingUp,
  Users,
  Package,
  FileSpreadsheet,
  FileBarChart,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useSession } from "next-auth/react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------- CSV helpers ---------- */
function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function downloadCSV(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
) {
  const csv = [headers, ...rows]
    .map((r) => r.map(csvEscape).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function inRange(dateStr: string | null | undefined, from: string, to: string): boolean {
  if (!dateStr) return false;
  // dateStr is ISO; compare by date only
  const d = new Date(dateStr).getTime();
  const f = new Date(from).getTime();
  const t = new Date(to).getTime() + 86_400_000 - 1; // inclusive end
  return d >= f && d <= t;
}

function sameDay(d: Date, ref: Date): boolean {
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

export function ReportsView() {
  const { data: session } = useSession();
  const userName = session?.user?.name || "Unknown";

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<any>("/api/dashboard"),
  });
  const { data: enqData } = useQuery({
    queryKey: ["enquiries-report"],
    queryFn: () => api<any>("/api/enquiries?limit=200"),
  });

  // Date range filter
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const allEnquiries: any[] = enqData?.enquiries || [];

  // Apply date filter to enquiries (client-side) — must be before any early return
  const enquiries = useMemo(() => {
    if (!dateFrom && !dateTo) return allEnquiries;
    const from = dateFrom || "1970-01-01";
    const to = dateTo || todayISO();
    return allEnquiries.filter((e: any) => inRange(e.date, from, to));
  }, [allEnquiries, dateFrom, dateTo]);

  if (isLoading || !data) return <Loading label="Loading reports…" />;

  const { kpis } = data;
  const perf: any[] = data?.charts?.employeePerf || [];

  // Computed KPI metrics
  const revenueClosed = enquiries
    .filter((e: any) => e.status === "CONVERTED")
    .reduce((s: number, e: any) => s + (e.orderValue || 0), 0);
  const pipelineValue = kpis.revenueForecast || 0;
  const conversionRate = kpis.conversionRate || 0;

  /* ---------- PDF Export (real, via jspdf + autotable) ---------- */
  const exportPDF = () => {
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const now = new Date();
      const dateStr = now.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      // Header band
      doc.setFillColor(14, 165, 233); // sky-500
      doc.rect(0, 0, pageW, 56, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("MSIH CRM — Sales Report", 40, 26);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(
        `Generated: ${dateStr}  ·  User: ${userName}`,
        40,
        44
      );

      // Sub-header band (violet)
      doc.setFillColor(139, 92, 246); // violet-500
      doc.rect(0, 56, pageW, 4, "F");

      // KPI summary section
      let y = 80;
      doc.setTextColor(31, 41, 55); // gray-800
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("KPI Summary", 40, y);

      autoTable(doc, {
        startY: y + 6,
        head: [["Metric", "Value"]],
        body: [
          ["Total Enquiries", String(enquiries.length)],
          ["Conversion Rate", `${conversionRate}%`],
          ["Revenue Closed (Converted)", fmtINR(revenueClosed)],
          ["Pipeline Value (Active)", fmtINR(pipelineValue)],
        ],
        theme: "striped",
        headStyles: {
          fillColor: [14, 165, 233],
          textColor: 255,
          fontStyle: "bold",
        },
        bodyStyles: { textColor: [31, 41, 55] },
        alternateRowStyles: { fillColor: [241, 245, 249] },
        margin: { left: 40, right: 40 },
        styles: { fontSize: 10, cellPadding: 6 },
      });

      // Enquiries table
      // @ts-ignore — autoTable extends the doc at runtime
      y = (doc as any).lastAutoTable.finalY + 24;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(
        `Enquiries (${enquiries.length} records${dateFrom || dateTo ? ` · filtered` : ""})`,
        40,
        y
      );

      autoTable(doc, {
        startY: y + 6,
        head: [
          [
            "Enquiry #",
            "Date",
            "Company",
            "Contact",
            "Product",
            "Budget",
            "Status",
            "Lead",
            "Executive",
          ],
        ],
        body: enquiries.slice(0, 100).map((e: any) => [
          e.enquiryNumber || "—",
          fmtDate(e.date),
          e.company || "—",
          e.contactPerson || "—",
          e.productInterested || "—",
          e.budget ? fmtINR(e.budget) : "—",
          e.status || "—",
          String(e.leadScore ?? "—"),
          e.assignedExecutive?.name || "—",
        ]),
        theme: "grid",
        headStyles: {
          fillColor: [16, 185, 129], // emerald-500
          textColor: 255,
          fontStyle: "bold",
          fontSize: 9,
        },
        bodyStyles: { fontSize: 8, cellPadding: 4, textColor: [31, 41, 55] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 40, right: 40 },
        columnStyles: {
          0: { cellWidth: 70 },
          1: { cellWidth: 60 },
          5: { cellWidth: 60, halign: "right" },
          7: { cellWidth: 30, halign: "center" },
        },
      });

      // Footer on every page
      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        const ph = doc.internal.pageSize.getHeight();
        doc.setDrawColor(226, 232, 240);
        doc.line(40, ph - 28, pageW - 40, ph - 28);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(
          "Generated by MSIH CRM V1.0 · MIT License · Manoj Dore",
          40,
          ph - 16
        );
        doc.text(
          `Page ${i} of ${pages}`,
          pageW - 40,
          ph - 16,
          { align: "right" }
        );
      }

      const filename = `msih-report-${now.toISOString().slice(0, 10)}.pdf`;
      doc.save(filename);
      toast.success(`PDF exported as ${filename}`);
    } catch (err: any) {
      console.error("PDF export failed:", err);
      toast.error(`PDF export failed: ${err?.message || "Unknown error"}`);
    }
  };

  /* ---------- CSV export for the full enquiries table ---------- */
  const exportCSV = () => {
    const headers = [
      "Enquiry #",
      "Date",
      "Company",
      "Contact",
      "Mobile",
      "Product",
      "Budget",
      "Status",
      "Lead Score",
      "Executive",
    ];
    const rows = enquiries.map((e: any) => [
      e.enquiryNumber,
      fmtDate(e.date),
      e.company,
      e.contactPerson,
      e.mobile,
      e.productInterested,
      e.budget || "",
      e.status,
      e.leadScore,
      e.assignedExecutive?.name || "",
    ]);
    downloadCSV(`msih-report-${todayISO()}.csv`, headers, rows);
    toast.success(`CSV exported (${rows.length} rows)`);
  };

  /* ---------- Per-card CSV generators ---------- */
  const exportDaily = () => {
    const today = new Date();
    const rows = allEnquiries
      .filter((e: any) => sameDay(new Date(e.date), today))
      .map((e: any) => [
        e.enquiryNumber,
        fmtDateTime(e.date),
        e.company,
        e.contactPerson,
        e.productInterested,
        e.budget ? fmtINR(e.budget) : "—",
        e.status,
        e.assignedExecutive?.name || "—",
      ]);
    downloadCSV(
      `msih-daily-${todayISO()}.csv`,
      [
        "Enquiry #",
        "DateTime",
        "Company",
        "Contact",
        "Product",
        "Budget",
        "Status",
        "Executive",
      ],
      rows
    );
    toast.success(`Daily report exported (${rows.length} rows)`);
  };

  const exportWeekly = () => {
    const cutoff = Date.now() - 7 * 86_400_000;
    const rows = allEnquiries
      .filter((e: any) => new Date(e.date).getTime() >= cutoff)
      .map((e: any) => [
        e.enquiryNumber,
        fmtDate(e.date),
        e.company,
        e.productInterested,
        e.budget ? fmtINR(e.budget) : "—",
        e.status,
        e.leadScore,
        e.assignedExecutive?.name || "—",
      ]);
    downloadCSV(
      `msih-weekly-${todayISO()}.csv`,
      [
        "Enquiry #",
        "Date",
        "Company",
        "Product",
        "Budget",
        "Status",
        "Lead",
        "Executive",
      ],
      rows
    );
    toast.success(`Weekly report exported (${rows.length} rows)`);
  };

  const exportMonthly = () => {
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const rows = allEnquiries
      .filter((e: any) => new Date(e.date).getTime() >= startMonth)
      .map((e: any) => [
        e.enquiryNumber,
        fmtDate(e.date),
        e.company,
        e.contactPerson,
        e.productInterested,
        e.budget ? fmtINR(e.budget) : "—",
        e.status,
        e.leadScore,
        e.assignedExecutive?.name || "—",
      ]);
    downloadCSV(
      `msih-monthly-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}.csv`,
      [
        "Enquiry #",
        "Date",
        "Company",
        "Contact",
        "Product",
        "Budget",
        "Status",
        "Lead",
        "Executive",
      ],
      rows
    );
    toast.success(`Monthly report exported (${rows.length} rows)`);
  };

  const exportExecutive = () => {
    const rows = perf.map((p: any) => [
      p.name,
      String(p.assigned),
      String(p.converted),
      `${p.conversion}%`,
      fmtINR(p.revenue),
    ]);
    downloadCSV(
      `msih-executive-${todayISO()}.csv`,
      ["Executive", "Assigned", "Converted", "Conversion Rate", "Revenue"],
      rows
    );
    toast.success(`Executive performance exported (${rows.length} rows)`);
  };

  const exportProduct = () => {
    // Group enquiries by product
    const map = new Map<string, { count: number; converted: number; pipeline: number }>();
    allEnquiries.forEach((e: any) => {
      const p = e.productInterested || "—";
      const entry = map.get(p) || { count: 0, converted: 0, pipeline: 0 };
      entry.count += 1;
      if (e.status === "CONVERTED") entry.converted += 1;
      entry.pipeline += e.budget || 0;
      map.set(p, entry);
    });
    const rows = Array.from(map.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([product, v]) => [
        product,
        String(v.count),
        String(v.converted),
        v.count ? `${Math.round((v.converted / v.count) * 100)}%` : "0%",
        fmtINR(v.pipeline),
      ]);
    downloadCSV(
      `msih-product-${todayISO()}.csv`,
      ["Product", "Enquiries", "Converted", "Conv. Rate", "Pipeline Value"],
      rows
    );
    toast.success(`Product performance exported (${rows.length} rows)`);
  };

  const exportSummary = () => {
    const rows: (string | number)[][] = [
      ["Total Enquiries", enquiries.length],
      ["Conversion Rate", `${conversionRate}%`],
      ["Revenue Closed (Converted)", fmtINR(revenueClosed)],
      ["Pipeline Value (Active)", fmtINR(pipelineValue)],
      ["Today's Enquiries", kpis.todayEnquiries ?? "—"],
      ["This Week", kpis.weekEnquiries ?? "—"],
      ["This Month", kpis.monthEnquiries ?? "—"],
      ["Open Follow-Ups", kpis.openFollowUps ?? "—"],
      ["Quotations Sent", kpis.quotationsSent ?? "—"],
      ["Orders Closed", kpis.ordersClosed ?? "—"],
    ];
    downloadCSV(`msih-summary-${todayISO()}.csv`, ["Metric", "Value"], rows);
    toast.success(`Management summary exported (${rows.length} rows)`);
  };

  /* ---------- Report type cards ---------- */
  interface ReportCard {
    icon: LucideIcon;
    title: string;
    desc: string;
    color: string;
    onClick: () => void;
    rowCount: number;
  }

  const todayCount = allEnquiries.filter((e: any) =>
    sameDay(new Date(e.date), new Date())
  ).length;
  const weekCount = allEnquiries.filter(
    (e: any) => new Date(e.date).getTime() >= Date.now() - 7 * 86_400_000
  ).length;
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthCount = allEnquiries.filter(
    (e: any) => new Date(e.date).getTime() >= startMonth
  ).length;

  const reportTypes: ReportCard[] = [
    {
      icon: Calendar,
      title: "Daily Sales Report",
      desc: "Today's enquiries, follow-ups, and conversions",
      color: "text-sky-600 bg-sky-500/10",
      onClick: exportDaily,
      rowCount: todayCount,
    },
    {
      icon: TrendingUp,
      title: "Weekly Report",
      desc: "7-day performance summary with trends",
      color: "text-emerald-600 bg-emerald-500/10",
      onClick: exportWeekly,
      rowCount: weekCount,
    },
    {
      icon: FileBarChart,
      title: "Monthly Report",
      desc: "Complete monthly sales analytics",
      color: "text-violet-600 bg-violet-500/10",
      onClick: exportMonthly,
      rowCount: monthCount,
    },
    {
      icon: Users,
      title: "Executive Performance",
      desc: "Individual & team performance metrics",
      color: "text-amber-600 bg-amber-500/10",
      onClick: exportExecutive,
      rowCount: perf.length,
    },
    {
      icon: Package,
      title: "Product Performance",
      desc: "Demand, revenue & conversion by product",
      color: "text-cyan-600 bg-cyan-500/10",
      onClick: exportProduct,
      rowCount: new Set(allEnquiries.map((e: any) => e.productInterested || "—")).size,
    },
    {
      icon: FileText,
      title: "Management Summary",
      desc: "Executive dashboard overview for leadership",
      color: "text-rose-600 bg-rose-500/10",
      onClick: exportSummary,
      rowCount: 10,
    },
  ];

  const hasDateFilter = Boolean(dateFrom || dateTo);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        description="Generate and export sales reports — PDF, CSV, and per-type breakdowns."
        icon={FileText}
        accent="emerald"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportCSV}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Export CSV
            </Button>
            <Button onClick={exportPDF} className="bg-emerald-600 hover:bg-emerald-700">
              <Download className="mr-2 h-4 w-4" /> PDF
            </Button>
          </div>
        }
      />

      {/* Hero banner — sky → emerald gradient with dotted grid + orbs */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-emerald-500/10 via-sky-500/10 to-violet-500/5 p-5 sm:p-6">
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 right-1/3 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl animate-float"
          aria-hidden
        />
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
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-500/25 dark:text-emerald-300">
              <Sparkles className="h-3 w-3" />
              Reports &amp; Exports
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Sales intelligence, on demand.
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {enquiries.length} enquiries ready for export · PDF includes KPIs + full table
              {hasDateFilter ? " · date range applied" : ""}
            </p>
          </div>

          {/* Date range filter */}
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                From
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 w-[150px]"
                aria-label="Filter from date"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                To
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 w-[150px]"
                aria-label="Filter to date"
              />
            </div>
            {hasDateFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  toast.info("Date range cleared");
                }}
                className="h-9 text-muted-foreground transition hover:text-foreground"
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Total Enquiries"
          value={fmtNum(enquiries.length)}
          icon={TrendingUp}
          accent="blue"
          hint={hasDateFilter ? "Filtered by date range" : "All records"}
        />
        <KpiCard
          label="Conversion Rate"
          value={`${conversionRate}%`}
          icon={Users}
          accent="emerald"
          hint="Converted ÷ total enquiries"
        />
        <KpiCard
          label="Revenue (Closed)"
          value={fmtINR(revenueClosed)}
          icon={TrendingUp}
          accent="violet"
          hint="Sum of orderValue for CONVERTED"
        />
        <KpiCard
          label="Pipeline Value"
          value={fmtINR(pipelineValue)}
          icon={Package}
          accent="amber"
          hint="Active pipeline (HOT/WARM/QUALIFIED)"
        />
      </div>

      {/* Report type cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reportTypes.map((r) => (
          <Card
            key={r.title}
            className="group relative cursor-pointer overflow-hidden p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-md"
            onClick={r.onClick}
          >
            {/* Animated left accent stripe */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-emerald-500/0 transition-all duration-200 group-hover:bg-emerald-500/60" />
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "inline-flex rounded-lg bg-gradient-to-br from-emerald-500/15 to-sky-500/15 p-2.5 ring-1 ring-inset ring-emerald-500/10 transition-transform duration-200 group-hover:scale-105",
                  r.color
                )}
              >
                <r.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-foreground">{r.title}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{r.desc}</p>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
                  ~{r.rowCount} rows · CSV
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs font-medium text-emerald-600 opacity-0 transition-all duration-200 group-hover:opacity-100 dark:text-emerald-400">
              <Download className="h-3.5 w-3.5" /> Generate report
              <ChevronRight className="ml-auto h-3.5 w-3.5" />
            </div>
          </Card>
        ))}
      </div>

      {/* Recent Enquiries table */}
      <SectionCard
        title="Recent Enquiries"
        description={`${enquiries.length} records ready for export`}
        icon={FileText}
        action={
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export
          </Button>
        }
      >
        {enquiries.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No data"
            description="Adjust your date range to see enquiries here."
          />
        ) : (
          <div className="scroll-thin max-h-80 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-2">Enquiry #</th>
                  <th className="p-2">Date</th>
                  <th className="p-2">Company</th>
                  <th className="p-2">Product</th>
                  <th className="p-2 text-right">Budget</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Executive</th>
                </tr>
              </thead>
              <tbody>
                {enquiries.slice(0, 50).map((e: any) => (
                  <tr
                    key={e.id}
                    className="border-t border-border/60 transition-colors hover:bg-muted/40"
                  >
                    <td className="p-2 font-mono text-[10px]">{e.enquiryNumber}</td>
                    <td className="p-2 text-muted-foreground">{fmtDate(e.date)}</td>
                    <td className="p-2 font-medium text-foreground">{e.company}</td>
                    <td className="p-2 text-muted-foreground">
                      {e.productInterested}
                    </td>
                    <td className="p-2 text-right">
                      {e.budget ? fmtINR(e.budget) : "—"}
                    </td>
                    <td className="p-2">
                      <Badge variant="outline" className="text-[10px]">
                        {e.status}
                      </Badge>
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {e.assignedExecutive?.name || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Footer attribution */}
      <p className="text-center text-[11px] text-muted-foreground">
        Generated by MSIH CRM V1.0 · MIT License · Manoj Dore
      </p>
    </div>
  );
}
