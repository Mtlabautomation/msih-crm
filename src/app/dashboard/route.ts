import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startWeek = new Date(startToday);
  startWeek.setDate(startWeek.getDate() - startWeek.getDay()); // Sunday
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

  // RBAC: executives see only own data
  const isExec = user.role === "EXECUTIVE";
  const enqFilter = isExec ? { assignedTo: user.id } : {};

  const [
    todayEnquiries,
    weekEnquiries,
    monthEnquiries,
    openFollowUps,
    quotationsSent,
    ordersClosed,
    convertedEnquiries,
    totalEnquiries,
    revenueForecast,
    leadTrend,
    funnel,
    productDemand,
    sourceAnalysis,
    employeePerf,
    regionalDist,
    overdueFollowUps,
    hotLeads,
  ] = await Promise.all([
    db.enquiry.count({ where: { ...enqFilter, date: { gte: startToday } } }),
    db.enquiry.count({ where: { ...enqFilter, date: { gte: startWeek } } }),
    db.enquiry.count({ where: { ...enqFilter, date: { gte: startMonth } } }),
    db.followUp.count({
      where: {
        completed: false,
        enquiry: isExec ? { assignedTo: user.id } : {},
      },
    }),
    db.quotation.count({
      where: isExec ? { createdBy: user.id } : {},
    }),
    db.enquiry.count({
      where: { ...enqFilter, status: "CONVERTED" },
    }),
    db.enquiry.count({
      where: { ...enqFilter, status: "CONVERTED" },
    }),
    db.enquiry.count({ where: enqFilter }),
    db.enquiry.aggregate({
      where: { ...enqFilter, status: { in: ["HOT", "WARM", "QUALIFIED"] } },
      _sum: { budget: true },
    }),
    // Lead trend - last 30 days
    db.enquiry.groupBy({
      by: ["date"],
      where: { ...enqFilter, date: { gte: thirtyDaysAgo } },
      _count: true,
    }).then((rows) => {
      // bucket by day
      const map: Record<string, number> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        map[d.toISOString().slice(0, 10)] = 0;
      }
      rows.forEach((r) => {
        const k = new Date(r.date).toISOString().slice(0, 10);
        if (k in map) map[k] += r._count;
      });
      return Object.entries(map).map(([date, count]) => ({ date, count }));
    }),
    // Funnel
    Promise.all(
      ["NEW", "QUALIFIED", "HOT", "WARM", "CONVERTED"].map(async (s) => ({
        stage: s,
        count: await db.enquiry.count({ where: { ...enqFilter, status: s } }),
      }))
    ),
    // Product demand
    db.enquiry.groupBy({
      by: ["productInterested"],
      where: enqFilter,
      _count: true,
      orderBy: { _count: { productInterested: "desc" } },
      take: 8,
    }).then((rows) => rows.map((r) => ({ name: r.productInterested, count: r._count }))),
    // Source analysis
    db.enquiry.groupBy({
      by: ["source"],
      where: enqFilter,
      _count: true,
    }).then((rows) => rows.map((r) => ({ name: r.source, value: r._count }))),
    // Employee performance (only for manager+)
    isExec
      ? Promise.resolve([])
      : db.user.findMany({
          where: { role: "EXECUTIVE", active: true },
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                enquiries: { where: {} },
                followUps: true,
                quotations: true,
              },
            },
          },
        }).then(async (execs) => {
          return Promise.all(
            execs.map(async (e) => {
              const [assigned, converted, revenue] = await Promise.all([
                db.enquiry.count({ where: { assignedTo: e.id } }),
                db.enquiry.count({ where: { assignedTo: e.id, status: "CONVERTED" } }),
                db.enquiry.aggregate({
                  where: { assignedTo: e.id, status: "CONVERTED" },
                  _sum: { orderValue: true },
                }),
              ]);
              return {
                name: e.name,
                assigned,
                converted,
                revenue: revenue._sum.orderValue || 0,
                conversion: assigned ? Math.round((converted / assigned) * 100) : 0,
              };
            })
          );
        }),
    // Regional distribution
    db.enquiry.groupBy({
      by: ["state"],
      where: enqFilter,
      _count: true,
    }).then((rows) => rows.map((r) => ({ state: r.state || "Unknown", count: r._count }))),
    // Overdue follow-ups
    db.followUp.count({
      where: {
        completed: false,
        nextFollowUpDate: { lt: startToday },
        enquiry: isExec ? { assignedTo: user.id } : {},
      },
    }),
    // Hot leads
    db.enquiry.findMany({
      where: { ...enqFilter, status: "HOT" },
      take: 5,
      orderBy: { leadScore: "desc" },
      include: { product: true },
    }),
  ]);

  const conversionRate = totalEnquiries ? Math.round((convertedEnquiries / totalEnquiries) * 100) : 0;

  return NextResponse.json({
    kpis: {
      todayEnquiries,
      weekEnquiries,
      monthEnquiries,
      openFollowUps,
      overdueFollowUps,
      quotationsSent,
      ordersClosed,
      conversionRate,
      revenueForecast: revenueForecast._sum.budget || 0,
      totalEnquiries,
    },
    charts: {
      leadTrend,
      funnel,
      productDemand,
      sourceAnalysis,
      employeePerf,
      regionalDist,
    },
    hotLeads: hotLeads.map((l) => ({
      id: l.id,
      enquiryNumber: l.enquiryNumber,
      company: l.company,
      contactPerson: l.contactPerson,
      product: l.productInterested,
      leadScore: l.leadScore,
      conversionProb: l.conversionProb,
      city: l.city,
    })),
    user: { id: user.id, role: user.role, name: user.name },
  });
}
