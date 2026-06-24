// MSIH CRM V1.0 — Reports API
// Module H: 6 report types with JSON & CSV output, RBAC-scoped.
// Developer: Manoj Dore — MIT License

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { Prisma } from "@prisma/client";

// ---------- Types ----------
type ReportType =
  | "lead-source"
  | "lead-status"
  | "conversion-funnel"
  | "revenue-by-exec"
  | "product-demand"
  | "region-wise";

interface ReportPayload {
  title: string;
  columns: string[];
  rows: (string | number)[][];
  summary: Record<string, string | number>;
}

// ---------- Helpers ----------
function enquiryScope(user: { id: string; role: string }): Prisma.EnquiryWhereInput {
  return user.role === "EXECUTIVE" ? { assignedTo: user.id } : {};
}

function fmtINR(n: number): string {
  return "₹" + (n || 0).toLocaleString("en-IN");
}

// CSV escape — wraps field in quotes and doubles any embedded quotes.
function csvCell(v: string | number): string {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function toCSV(payload: ReportPayload): string {
  const header = payload.columns.map(csvCell).join(",");
  const lines = payload.rows.map((r) => r.map(csvCell).join(","));
  return [header, ...lines].join("\n");
}

// ---------- Report builders ----------

async function reportLeadSource(scope: Prisma.EnquiryWhereInput): Promise<ReportPayload> {
  const groups = await db.enquiry.groupBy({
    by: ["source"],
    where: scope,
    _count: true,
    _sum: { orderValue: true, budget: true },
  });
  const total = groups.reduce((s, g) => s + g._count, 0);
  const rows = groups
    .sort((a, b) => b._count - a._count)
    .map((g) => [
      g.source,
      g._count,
      total ? `${Math.round((g._count / total) * 100)}%` : "0%",
      fmtINR((g._sum.budget || 0) + (g._sum.orderValue || 0)),
    ]);
  return {
    title: "Lead Source Analysis",
    columns: ["Source", "Enquiries", "Share", "Pipeline Value"],
    rows,
    summary: {
      totalSources: groups.length,
      totalEnquiries: total,
      topSource: groups[0]?.source || "—",
    },
  };
}

async function reportLeadStatus(scope: Prisma.EnquiryWhereInput): Promise<ReportPayload> {
  const groups = await db.enquiry.groupBy({
    by: ["status"],
    where: scope,
    _count: true,
    _sum: { orderValue: true, budget: true },
  });
  const total = groups.reduce((s, g) => s + g._count, 0);
  const rows = groups
    .map((g) => [
      g.status,
      g._count,
      total ? `${Math.round((g._count / total) * 100)}%` : "0%",
      fmtINR((g._sum.budget || 0) + (g._sum.orderValue || 0)),
    ])
    .sort((a, b) => Number(b[1]) - Number(a[1]));
  return {
    title: "Lead Status Distribution",
    columns: ["Status", "Enquiries", "Share", "Value"],
    rows,
    summary: {
      totalStatuses: groups.length,
      totalEnquiries: total,
      converted: groups.find((g) => g.status === "CONVERTED")?._count || 0,
    },
  };
}

async function reportConversionFunnel(scope: Prisma.EnquiryWhereInput): Promise<ReportPayload> {
  const stages = ["NEW", "QUALIFIED", "HOT", "WARM", "CONVERTED"];
  const counts = await Promise.all(
    stages.map((s) => db.enquiry.count({ where: { ...scope, status: s } }))
  );
  const total = counts[0] || 1;
  const rows = stages.map((s, i) => [
    s,
    counts[i],
    `${Math.round((counts[i] / total) * 100)}%`,
    i > 0 ? `${Math.round((counts[i] / Math.max(counts[0], 1)) * 100)}%` : "100%",
  ]);
  return {
    title: "Conversion Funnel",
    columns: ["Stage", "Count", "Stage Conversion", "Of New"],
    rows,
    summary: {
      newLeads: counts[0],
      converted: counts[4],
      overallConversionRate: `${Math.round((counts[4] / Math.max(counts[0], 1)) * 100)}%`,
    },
  };
}

async function reportRevenueByExec(user: { id: string; role: string }): Promise<ReportPayload> {
  // Executive-only users see only their own row
  if (user.role === "EXECUTIVE") {
    const [assigned, converted, revAgg] = await Promise.all([
      db.enquiry.count({ where: { assignedTo: user.id } }),
      db.enquiry.count({ where: { assignedTo: user.id, status: "CONVERTED" } }),
      db.enquiry.aggregate({
        where: { assignedTo: user.id, status: "CONVERTED" },
        _sum: { orderValue: true },
      }),
    ]);
    return {
      title: "Revenue by Executive (You)",
      columns: ["Executive", "Assigned", "Converted", "Conv. Rate", "Revenue"],
      rows: [
        [
          "You",
          assigned,
          converted,
          `${assigned ? Math.round((converted / assigned) * 100) : 0}%`,
          fmtINR(revAgg._sum.orderValue || 0),
        ],
      ],
      summary: { assigned, converted, revenue: fmtINR(revAgg._sum.orderValue || 0) },
    };
  }

  const execs = await db.user.findMany({
    where: { role: "EXECUTIVE", active: true },
    select: { id: true, name: true },
  });
  const rows: (string | number)[][] = [];
  let totalRev = 0;
  let totalConv = 0;
  for (const e of execs) {
    const [assigned, converted, revAgg] = await Promise.all([
      db.enquiry.count({ where: { assignedTo: e.id } }),
      db.enquiry.count({ where: { assignedTo: e.id, status: "CONVERTED" } }),
      db.enquiry.aggregate({
        where: { assignedTo: e.id, status: "CONVERTED" },
        _sum: { orderValue: true },
      }),
    ]);
    totalRev += revAgg._sum.orderValue || 0;
    totalConv += converted;
    rows.push([
      e.name,
      assigned,
      converted,
      `${assigned ? Math.round((converted / assigned) * 100) : 0}%`,
      fmtINR(revAgg._sum.orderValue || 0),
    ]);
  }
  rows.sort((a, b) => Number(b[4].toString().replace(/[^\d]/g, "")) - Number(a[4].toString().replace(/[^\d]/g, "")));
  return {
    title: "Revenue by Executive",
    columns: ["Executive", "Assigned", "Converted", "Conv. Rate", "Revenue"],
    rows,
    summary: {
      executives: execs.length,
      totalConverted: totalConv,
      totalRevenue: fmtINR(totalRev),
    },
  };
}

async function reportProductDemand(scope: Prisma.EnquiryWhereInput): Promise<ReportPayload> {
  const groups = await db.enquiry.groupBy({
    by: ["productInterested"],
    where: scope,
    _count: true,
    _sum: { orderValue: true, budget: true },
  });
  const total = groups.reduce((s, g) => s + g._count, 0);
  const rows = groups
    .sort((a, b) => b._count - a._count)
    .map((g) => [
      g.productInterested || "Unknown",
      g._count,
      total ? `${Math.round((g._count / total) * 100)}%` : "0%",
      fmtINR((g._sum.budget || 0) + (g._sum.orderValue || 0)),
    ]);
  return {
    title: "Product Demand Report",
    columns: ["Product", "Enquiries", "Share", "Value"],
    rows,
    summary: {
      products: groups.length,
      totalEnquiries: total,
      topProduct: groups[0]?.productInterested || "—",
    },
  };
}

async function reportRegionWise(scope: Prisma.EnquiryWhereInput): Promise<ReportPayload> {
  const groups = await db.enquiry.groupBy({
    by: ["state"],
    where: scope,
    _count: true,
    _sum: { orderValue: true, budget: true },
  });
  const total = groups.reduce((s, g) => s + g._count, 0);
  const rows = groups
    .sort((a, b) => b._count - a._count)
    .map((g) => [
      g.state || "Unknown",
      g._count,
      total ? `${Math.round((g._count / total) * 100)}%` : "0%",
      fmtINR((g._sum.budget || 0) + (g._sum.orderValue || 0)),
    ]);
  return {
    title: "Region-wise Report",
    columns: ["State", "Enquiries", "Share", "Value"],
    rows,
    summary: {
      regions: groups.length,
      totalEnquiries: total,
      topRegion: groups[0]?.state || "—",
    },
  };
}

// ---------- GET handler ----------
export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") || "lead-source") as ReportType;
  const format = (searchParams.get("format") || "json").toLowerCase();

  const validTypes: ReportType[] = [
    "lead-source",
    "lead-status",
    "conversion-funnel",
    "revenue-by-exec",
    "product-demand",
    "region-wise",
  ];
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { error: `Invalid report type. Valid: ${validTypes.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const scope = enquiryScope(user);
    let payload: ReportPayload;

    switch (type) {
      case "lead-source":
        payload = await reportLeadSource(scope);
        break;
      case "lead-status":
        payload = await reportLeadStatus(scope);
        break;
      case "conversion-funnel":
        payload = await reportConversionFunnel(scope);
        break;
      case "revenue-by-exec":
        payload = await reportRevenueByExec(user);
        break;
      case "product-demand":
        payload = await reportProductDemand(scope);
        break;
      case "region-wise":
        payload = await reportRegionWise(scope);
        break;
    }

    if (format === "csv") {
      const csv = toCSV(payload!);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (format !== "json") {
      return NextResponse.json({ error: "format must be 'json' or 'csv'" }, { status: 400 });
    }

    return NextResponse.json({ ...payload!, type, scope: user.role === "EXECUTIVE" ? "own" : "team" });
  } catch (err: any) {
    console.error("[reports] error:", err);
    return NextResponse.json(
      { error: "Report generation failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
