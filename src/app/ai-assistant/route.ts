// MSIH CRM V1.0 — AI Sales Assistant API
// Module F: LLM-powered recommendations, stagnant lead detection,
// duplicate detection, and natural-language Q&A over CRM data.
// Developer: Manoj Dore — MIT License

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { Prisma } from "@prisma/client";

// ---------- Types ----------
type Action = "recommendations" | "insights" | "stagnant" | "duplicates" | "ask";

interface RecResult {
  enquiryId: string;
  recommendation: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  rationale: string;
}

// ---------- Helpers ----------

// Compute "days since" without timezone drift.
function daysSince(d: Date | null | string): number {
  if (!d) return Infinity;
  const t = new Date(d).getTime();
  if (Number.isNaN(t)) return Infinity;
  return Math.floor((Date.now() - t) / 86400000);
}

// RBAC-aware filter for enquiries
function enquiryScope(user: { id: string; role: string }): Prisma.EnquiryWhereInput {
  return user.role === "EXECUTIVE" ? { assignedTo: user.id } : {};
}

// Safely call the LLM; returns null on any failure so callers can fall back.
async function callLLM(systemPrompt: string, userPrompt: string): Promise<string | null> {
  try {
    // Lazy import so the route never crashes at module load if SDK is missing.
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: "glm-4.5",
      temperature: 0.7,
    } as any);
    return completion?.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

// Deterministic rule-based recommendations — used as fallback or supplement.
function ruleBasedRecommendations(
  enquiries: Array<{
    id: string;
    enquiryNumber: string;
    company: string;
    productInterested: string;
    status: string;
    leadScore: number;
    conversionProb: number;
    budget: number | null;
    lastFollowUpDate: Date | null;
    nextFollowUpDate: Date | null;
  }>
): RecResult[] {
  const out: RecResult[] = [];
  for (const e of enquiries) {
    const sinceFU = daysSince(e.lastFollowUpDate);
    if (e.status === "CONVERTED" || e.status === "LOST") continue;

    // Hot lead + high probability → close now
    if (e.status === "HOT" && e.conversionProb >= 60) {
      out.push({
        enquiryId: e.id,
        recommendation: `Prepare final quotation and schedule a closing meeting with ${e.company} today — high conversion probability.`,
        priority: "CRITICAL",
        rationale: `HOT status with ${e.conversionProb}% conversion probability and lead score ${e.leadScore}.`,
      });
    }
    // Stagnant hot/warm lead
    else if (sinceFU >= 7 && (e.status === "HOT" || e.status === "WARM")) {
      out.push({
        enquiryId: e.id,
        recommendation: `Re-engage ${e.company} — ${sinceFU} days since last follow-up. Send WhatsApp + call within 24h.`,
        priority: "HIGH",
        rationale: `No follow-up for ${sinceFU} days on a ${e.status} lead risks pipeline leakage.`,
      });
    }
    // Big budget + qualified but no recent movement
    else if ((e.budget ?? 0) >= 500000 && e.status === "QUALIFIED") {
      out.push({
        enquiryId: e.id,
        recommendation: `Nurture ${e.company} — high-value opportunity (₹${e.budget?.toLocaleString("en-IN")}). Share technical brochure + case study.`,
        priority: "HIGH",
        rationale: `Budget ₹${e.budget?.toLocaleString("en-IN")} with qualified status; needs consultative push.`,
      });
    }
    // Cold lead revival
    else if (e.status === "COLD" && sinceFU >= 14) {
      out.push({
        enquiryId: e.id,
        recommendation: `Send reactivation campaign to ${e.company} (email + reference story). Mark LOST if no response in 7 days.`,
        priority: "LOW",
        rationale: `Cold for ${sinceFU} days; attempt one final revival before disqualifying.`,
      });
    }
    // New lead with no follow-up yet
    else if (e.status === "NEW" && sinceFU >= 2) {
      out.push({
        enquiryId: e.id,
        recommendation: `Make first contact with ${e.company} immediately — new enquiry has no logged follow-up.`,
        priority: "MEDIUM",
        rationale: `NEW lead untouched for ${sinceFU} days; first-call SLA is 24 hours.`,
      });
    }
  }
  // Sort by priority weight
  const weight: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  out.sort((a, b) => weight[b.priority] - weight[a.priority]);
  return out.slice(0, 10);
}

// ---------- POST handler ----------
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Accept both spec (`action`, `prompt`) and existing frontend (`question`)
  const action = (body.action as Action) || "recommendations";
  const prompt = (body.prompt as string) || (body.question as string) || "";

  try {
    // ---------- ASK ----------
    if (action === "ask") {
      if (!prompt.trim()) {
        return NextResponse.json({ error: "Missing 'prompt' or 'question'" }, { status: 400 });
      }
      // Build context from user's enquiries + recent follow-ups
      const enquiries = await db.enquiry.findMany({
        where: enquiryScope(user),
        take: 30,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, enquiryNumber: true, company: true, productInterested: true,
          status: true, leadScore: true, conversionProb: true, budget: true,
          city: true, state: true, source: true, lastFollowUpDate: true, orderValue: true,
        },
      });
      const enquiryIds = enquiries.map((e) => e.id);
      const followUps = enquiryIds.length
        ? await db.followUp.findMany({
            where: { enquiryId: { in: enquiryIds } },
            take: 30,
            orderBy: { createdAt: "desc" },
            select: { enquiryId: true, method: true, status: true, notes: true, createdAt: true },
          })
        : [];

      // Compact context blob for the LLM
      const context = {
        user: { name: user.name, role: user.role },
        enquiries: enquiries.map((e) => ({
          n: e.enquiryNumber, c: e.company, p: e.productInterested,
          s: e.status, ls: e.leadScore, cp: e.conversionProb,
          b: e.budget, city: e.city, state: e.state, src: e.source,
        })),
        recentFollowUps: followUps.map((f) => ({
          n: f.enquiryId.slice(-4), m: f.method, s: f.status, note: (f.notes || "").slice(0, 80),
        })),
      };

      const systemPrompt =
        "You are MSIH AI Sales Assistant. Answer concisely based on the user's CRM data. " +
        "Be specific, actionable, and reference actual enquiries/products where possible. " +
        "If data is insufficient, say so briefly. Max 4 sentences.";
      const userPrompt = `CRM CONTEXT (JSON):\n${JSON.stringify(context).slice(0, 6000)}\n\nQUESTION: ${prompt}`;

      const llmAnswer = await callLLM(systemPrompt, userPrompt);

      // Fallback: simple deterministic answer summarising the pipeline
      if (!llmAnswer) {
        const converted = enquiries.filter((e) => e.status === "CONVERTED").length;
        const hot = enquiries.filter((e) => e.status === "HOT").length;
        const pipelineValue = enquiries
          .filter((e) => ["HOT", "WARM", "QUALIFIED"].includes(e.status))
          .reduce((s, e) => s + (e.budget || 0), 0);
        const answer =
          `Based on your CRM data: you have ${enquiries.length} enquiries (${hot} hot, ${converted} converted). ` +
          `Active pipeline value is approximately ₹${pipelineValue.toLocaleString("en-IN")}. ` +
          (hot > 0
            ? `Focus on closing the ${hot} hot leads first — they represent the highest near-term revenue opportunity.`
            : `No hot leads currently — concentrate on warming up your WARM/QUALIFIED leads through targeted follow-ups.`);
        return NextResponse.json({ answer, source: "fallback" });
      }
      return NextResponse.json({ answer: llmAnswer, source: "llm" });
    }

    // ---------- STAGNANT ----------
    if (action === "stagnant") {
      const enquiries = await db.enquiry.findMany({
        where: { ...enquiryScope(user), status: { notIn: ["CONVERTED", "LOST"] } },
        include: {
          followUps: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
          assignedExecutive: { select: { name: true } },
        },
        orderBy: { updatedAt: "asc" },
        take: 50,
      });
      const stagnant = enquiries.filter((e) => {
        const lastFU = e.followUps[0]?.date ?? e.lastFollowUpDate ?? null;
        return daysSince(lastFU) >= 7;
      });
      return NextResponse.json({
        count: stagnant.length,
        enquiries: stagnant.map((e) => ({
          id: e.id,
          enquiryNumber: e.enquiryNumber,
          company: e.company,
          contactPerson: e.contactPerson,
          productInterested: e.productInterested,
          status: e.status,
          assignedTo: e.assignedExecutive?.name || null,
          daysSinceFollowUp: daysSince(e.followUps[0]?.date ?? e.lastFollowUpDate ?? null),
        })),
      });
    }

    // ---------- DUPLICATES ----------
    if (action === "duplicates") {
      const enquiries = await db.enquiry.findMany({
        where: enquiryScope(user),
        select: {
          id: true, enquiryNumber: true, company: true, contactPerson: true,
          mobile: true, email: true, productInterested: true, status: true, createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      });

      // Group by mobile, email, and normalised company
      const groups = new Map<string, typeof enquiries>();
      const normCompany = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);

      for (const e of enquiries) {
        const keys: string[] = [];
        if (e.mobile) keys.push(`mobile:${e.mobile.replace(/\D/g, "").slice(-10)}`);
        if (e.email) keys.push(`email:${e.email.toLowerCase().trim()}`);
        if (e.company) keys.push(`company:${normCompany(e.company)}`);
        for (const k of keys) {
          const arr = groups.get(k) || [];
          arr.push(e);
          groups.set(k, arr);
        }
      }

      const duplicates = [];
      const seenIds = new Set<string>();
      for (const [, arr] of groups) {
        if (arr.length < 2) continue;
        const ids = arr.map((e) => e.id).sort().join("|");
        if (seenIds.has(ids)) continue;
        seenIds.add(ids);
        duplicates.push({
          matchOn: arr.length > 1 ? "mobile/email/company" : "field",
          count: arr.length,
          enquiries: arr,
        });
      }

      return NextResponse.json({ count: duplicates.length, duplicates });
    }

    // ---------- RECOMMENDATIONS / INSIGHTS ----------
    // `insights` is the existing frontend action name; treat it as alias.
    const enquiries = await db.enquiry.findMany({
      where: { ...enquiryScope(user), status: { in: ["NEW", "HOT", "WARM", "QUALIFIED", "COLD"] } },
      select: {
        id: true, enquiryNumber: true, company: true, contactPerson: true,
        productInterested: true, status: true, leadScore: true, conversionProb: true,
        budget: true, city: true, state: true, source: true,
        lastFollowUpDate: true, nextFollowUpDate: true, updatedAt: true,
      },
      orderBy: { leadScore: "desc" },
      take: 40,
    });

    const ruleRecs = ruleBasedRecommendations(enquiries);

    // Try LLM for richer narrative recommendations; fall back to rule-based
    const systemPrompt =
      "You are MSIH AI Sales Assistant. Given a list of active sales enquiries, " +
      "produce next-best-action recommendations. Respond ONLY with a JSON array. " +
      "Each item: {enquiryId, recommendation (1 sentence), priority (LOW|MEDIUM|HIGH|CRITICAL), rationale (1 sentence)}. " +
      "Max 8 items. No markdown, no commentary.";
    const userPrompt = `ENQUIRIES (JSON):\n${JSON.stringify(enquiries).slice(0, 6000)}`;

    const llmRaw = await callLLM(systemPrompt, userPrompt);
    let recommendations = ruleRecs;
    let source: "llm" | "rules" = "rules";

    if (llmRaw) {
      try {
        // Strip any stray markdown fences
        const cleaned = llmRaw.replace(/^```(?:json)?|```$/gim, "").trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Validate shape
          recommendations = parsed
            .filter((r: any) => r && typeof r.enquiryId === "string")
            .slice(0, 10)
            .map((r: any) => ({
              enquiryId: r.enquiryId,
              recommendation: String(r.recommendation || "").slice(0, 300),
              priority: ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(r.priority)
                ? r.priority
                : "MEDIUM",
              rationale: String(r.rationale || "").slice(0, 300),
            }));
          source = "llm";
        }
      } catch {
        // JSON parse failed — keep rule-based recs
      }
    }

    return NextResponse.json({
      count: recommendations.length,
      recommendations,
      source,
      context: {
        totalEnquiries: enquiries.length,
        hot: enquiries.filter((e) => e.status === "HOT").length,
        warm: enquiries.filter((e) => e.status === "WARM").length,
        stagnant: enquiries.filter((e) => daysSince(e.lastFollowUpDate) >= 7).length,
      },
    });
  } catch (err: any) {
    console.error("[ai-assistant] error:", err);
    return NextResponse.json(
      { error: "AI assistant failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
