// MSIH CRM V1.0 — Forecasting API
// Module G: Pipeline metrics + AI-generated forecast narrative.
// Developer: Manoj Dore — MIT License

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { Prisma } from "@prisma/client";

// ---------- Helpers ----------
function enquiryScope(user: { id: string; role: string }): Prisma.EnquiryWhereInput {
  return user.role === "EXECUTIVE" ? { assignedTo: user.id } : {};
}

// Weights for weighted pipeline value by status.
const STATUS_WEIGHT: Record<string, number> = {
  NEW: 0.1,
  QUALIFIED: 0.25,
  WARM: 0.4,
  HOT: 0.65,
  COLD: 0.05,
  CONVERTED: 1.0,
  LOST: 0,
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Safe LLM call — never throws.
async function callLLM(systemPrompt: string, userPrompt: string): Promise<string | null> {
  try {
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: "glm-4.5",
      temperature: 0.4,
    } as any);
    return completion?.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

// Deterministic narrative based on the data — always available.
function ruleBasedNarrative(data: {
  totalValue: number;
  weightedValue: number;
  count: number;
  hotCount: number;
  conversionRate: number;
  topProduct?: string;
  topRegion?: string;
}): string {
  const { totalValue, weightedValue, count, hotCount, conversionRate, topProduct, topRegion } = data;
  const parts: string[] = [];
  parts.push(
    `Pipeline of ₹${totalValue.toLocaleString("en-IN")} across ${count} active enquiries is forecast to close at approximately ₹${weightedValue.toLocaleString("en-IN")} (probability-weighted).`
  );
  if (hotCount > 0) {
    parts.push(`${hotCount} hot leads at ${conversionRate}% overall conversion suggest immediate revenue impact — prioritise these for closing.`);
  } else {
    parts.push(`With no hot leads and a ${conversionRate}% conversion rate, focus on warming up qualified/WARM enquiries.`);
  }
  if (topProduct || topRegion) {
    parts.push(
      `Demand concentrates in ${topProduct ? topProduct : "—"}${topRegion ? ` (${topRegion})` : ""} — align inventory and sales effort accordingly.`
    );
  }
  return parts.join(" ");
}

// ---------- GET handler ----------
export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const scope = enquiryScope(user);
    const now = new Date();
    const startOfMonth6 = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    // ---------- Pipeline metrics ----------
    const activeStatuses = ["NEW", "QUALIFIED", "HOT", "WARM", "COLD"];
    const [pipelineAgg, convertedAgg, pipelineCount, allCount] = await Promise.all([
      db.enquiry.aggregate({
        where: { ...scope, status: { in: activeStatuses } },
        _sum: { budget: true, orderValue: true },
      }),
      db.enquiry.aggregate({
        where: { ...scope, status: "CONVERTED" },
        _sum: { orderValue: true },
        _count: true,
      }),
      db.enquiry.count({ where: { ...scope, status: { in: activeStatuses } } }),
      db.enquiry.count({ where: scope }),
    ]);

    // Weighted value = sum over enquiries of budget * status weight (fallback to conversionProb)
    const activeEnquiries = await db.enquiry.findMany({
      where: { ...scope, status: { in: activeStatuses } },
      select: { budget: true, status: true, conversionProb: true },
    });
    const weightedValue = activeEnquiries.reduce((s, e) => {
      const w = STATUS_WEIGHT[e.status] ?? 0.2;
      const prob = (e.conversionProb || 0) / 100;
      // Blend deterministic status weight with the enquiry's stored conversion prob
      const blended = (w + prob) / 2;
      return s + (e.budget || 0) * blended;
    }, 0);

    const pipeline = {
      totalValue: pipelineAgg._sum.budget || 0,
      weightedValue: Math.round(weightedValue),
      count: pipelineCount,
    };

    // ---------- By status ----------
    const statusGroups = await db.enquiry.groupBy({
      by: ["status"],
      where: scope,
      _count: true,
      _sum: { budget: true, orderValue: true },
    });
    const byStatus = statusGroups.map((g) => ({
      status: g.status,
      count: g._count,
      value: (g._sum.budget || 0) + (g._sum.orderValue || 0),
    }));

    // ---------- By month (last 6 months) ----------
    const recentEnquiries = await db.enquiry.findMany({
      where: { ...scope, date: { gte: startOfMonth6 } },
      select: { date: true, status: true, orderValue: true },
    });
    const monthMap: Record<string, { enquiries: number; conversions: number; revenue: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthMap[monthKey(d)] = { enquiries: 0, conversions: 0, revenue: 0 };
    }
    for (const e of recentEnquiries) {
      const k = monthKey(e.date);
      if (!monthMap[k]) continue;
      monthMap[k].enquiries++;
      if (e.status === "CONVERTED") {
        monthMap[k].conversions++;
        monthMap[k].revenue += e.orderValue || 0;
      }
    }
    const byMonth = Object.entries(monthMap).map(([month, v]) => ({ month, ...v }));

    // ---------- By region (state) ----------
    const regionGroups = await db.enquiry.groupBy({
      by: ["state"],
      where: scope,
      _count: true,
      _sum: { orderValue: true, budget: true },
    });
    const byRegion = regionGroups
      .map((g) => ({
        region: g.state || "Unknown",
        enquiries: g._count,
        revenue: (g._sum.orderValue || 0) + (g._sum.budget || 0),
      }))
      .sort((a, b) => b.enquiries - a.enquiries);

    // ---------- By product ----------
    const productGroups = await db.enquiry.groupBy({
      by: ["productInterested"],
      where: scope,
      _count: true,
      _sum: { orderValue: true, budget: true },
    });
    const byProduct = productGroups
      .map((g) => ({
        product: g.productInterested || "Unknown",
        enquiries: g._count,
        revenue: (g._sum.orderValue || 0) + (g._sum.budget || 0),
      }))
      .sort((a, b) => b.enquiries - a.enquiries);

    // ---------- KPIs for narrative ----------
    const conversionRate = allCount ? Math.round((convertedAgg._count / allCount) * 100) : 0;
    const hotCount = byStatus.find((s) => s.status === "HOT")?.count || 0;
    const topProduct = byProduct[0]?.product;
    const topRegion = byRegion[0]?.region;

    // ---------- AI Narrative ----------
    const summary = {
      pipeline,
      conversionRate,
      hotCount,
      totalEnquiries: allCount,
      convertedRevenue: convertedAgg._sum.orderValue || 0,
      topProduct,
      topRegion,
      byMonth: byMonth.map((m) => ({ m: m.month, e: m.enquiries, c: m.conversions, r: m.revenue })),
    };
    const systemPrompt =
      "You are MSIH AI Forecasting Assistant. Produce a concise 2-3 sentence sales forecast narrative " +
      "based on the provided CRM pipeline data. Reference concrete numbers, conversion rate, hot leads, " +
      "top product, and top region. No markdown, no headers.";
    const userPrompt = `FORECAST DATA (JSON):\n${JSON.stringify(summary).slice(0, 4000)}`;

    let aiNarrative = await callLLM(systemPrompt, userPrompt);
    if (!aiNarrative) {
      aiNarrative = ruleBasedNarrative({
        totalValue: pipeline.totalValue,
        weightedValue: pipeline.weightedValue,
        count: pipeline.count,
        hotCount,
        conversionRate,
        topProduct,
        topRegion,
      });
    }

    return NextResponse.json({
      pipeline,
      byStatus,
      byMonth,
      byRegion,
      byProduct,
      aiNarrative,
      meta: {
        conversionRate,
        hotCount,
        totalEnquiries: allCount,
        convertedRevenue: convertedAgg._sum.orderValue || 0,
        scope: user.role === "EXECUTIVE" ? "own" : "team",
        generatedAt: now.toISOString(),
      },
    });
  } catch (err: any) {
    console.error("[forecasting] error:", err);
    return NextResponse.json(
      { error: "Forecasting failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
