// MSIH CRM V1.0 — Email Templates API
// CRUD for reusable email templates with variable substitution.
// Read = all roles; Create = ADMIN/SUPER_ADMIN only.
// Developer: Manoj Dore — MIT License

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { Prisma } from "@prisma/client";

// GET /api/email-templates — list templates (all roles can read)
// Supports ?category= filter. Ordered by category asc, then updatedAt desc.
// Includes creator (user) name via relation.
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  const where: Prisma.EmailTemplateWhereInput = {};
  if (category && category !== "all") where.category = category;

  const templates = await db.emailTemplate.findMany({
    where,
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: [{ category: "asc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json({ templates, total: templates.length });
}

// POST /api/email-templates — create a template (ADMIN/SUPER_ADMIN only)
// Body: { name, subject, body, category?, variables?: string[] }
// `variables` is a string[] stored as JSON. Auto-detects {{var}} placeholders when omitted.
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Forbidden — admin access required" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { name, subject, body: templateBody, category, variables } = body;

    if (!name || !subject || !templateBody) {
      return NextResponse.json(
        { error: "name, subject and body are required" },
        { status: 400 }
      );
    }

    // Coerce variables to string[] (store as JSON string)
    let finalVars: string[] = [];
    if (Array.isArray(variables)) {
      finalVars = variables
        .filter((v: unknown): v is string => typeof v === "string")
        .map((v: string) => v.trim())
        .filter(Boolean);
    }
    if (finalVars.length === 0) {
      // Auto-detect {{var}} placeholders from body
      const detected = Array.from(
        new Set(
          (String(templateBody).match(/\{\{(\w+)\}\}/g) || []).map(
            (m: string) => m.slice(2, -2)
          )
        )
      );
      finalVars = detected;
    }

    const tpl = await db.emailTemplate.create({
      data: {
        name,
        subject,
        body: templateBody,
        category: category || "GENERAL",
        variables: JSON.stringify(finalVars),
        createdBy: user.id,
      },
      include: { user: { select: { id: true, name: true, role: true } } },
    });

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "CREATE",
      entity: "EMAIL_TEMPLATE",
      entityId: tpl.id,
      description: `Created email template "${name}" (${category || "GENERAL"})`,
      newValue: {
        name,
        subject,
        category: category || "GENERAL",
        variables: finalVars,
      },
    });

    return NextResponse.json({ template: tpl }, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json(
        { error: "A template with this name already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: e.message || "Failed to create template" },
      { status: 500 }
    );
  }
}
