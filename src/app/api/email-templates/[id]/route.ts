// MSIH CRM V1.0 — Email Template by ID
// GET = all roles; PATCH/DELETE = ADMIN/SUPER_ADMIN only.
// Developer: Manoj Dore — MIT License

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";

// GET /api/email-templates/[id] — single template with creator info
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const tpl = await db.emailTemplate.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, role: true } } },
  });
  if (!tpl) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ template: tpl });
}

// PATCH /api/email-templates/[id] — update (ADMIN/SUPER_ADMIN only)
// Body: { name?, subject?, body?, category?, variables?: string[] }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Forbidden — admin access required" },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const existing = await db.emailTemplate.findUnique({ where: { id } });
    if (!existing)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data: {
      name?: string;
      subject?: string;
      body?: string;
      category?: string;
      variables?: string;
    } = {};
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    if (body.name !== undefined && body.name !== existing.name) {
      data.name = body.name;
      changes.name = { from: existing.name, to: body.name };
    }
    if (body.subject !== undefined && body.subject !== existing.subject) {
      data.subject = body.subject;
      changes.subject = { from: existing.subject, to: body.subject };
    }
    if (body.category !== undefined && body.category !== existing.category) {
      data.category = body.category;
      changes.category = { from: existing.category, to: body.category };
    }
    if (body.body !== undefined && body.body !== existing.body) {
      data.body = body.body;
      changes.body = { from: existing.body, to: body.body };
    }

    // Variables: explicit array overrides; else re-detect when body changes
    if (body.variables !== undefined) {
      const varsArr = Array.isArray(body.variables)
        ? body.variables
            .filter((v: unknown): v is string => typeof v === "string")
            .map((v: string) => v.trim())
            .filter(Boolean)
        : [];
      const finalVars =
        varsArr.length > 0
          ? varsArr
          : Array.from(
              new Set(
                (String(body.body ?? existing.body).match(/\{\{(\w+)\}\}/g) || [])
                  .map((m: string) => m.slice(2, -2))
              )
            );
      data.variables = JSON.stringify(finalVars);
      changes.variables = { from: existing.variables, to: data.variables };
    } else if (body.body !== undefined) {
      const finalVars = Array.from(
        new Set(
          (String(body.body).match(/\{\{(\w+)\}\}/g) || []).map((m: string) =>
            m.slice(2, -2)
          )
        )
      );
      data.variables = JSON.stringify(finalVars);
      changes.variables = { from: existing.variables, to: data.variables };
    }

    const tpl = await db.emailTemplate.update({
      where: { id },
      data,
      include: { user: { select: { id: true, name: true, role: true } } },
    });

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "UPDATE",
      entity: "EMAIL_TEMPLATE",
      entityId: id,
      description: `Updated email template "${existing.name}"${
        Object.keys(changes).length
          ? ` — changed: ${Object.keys(changes).join(", ")}`
          : ""
      }`,
      previousValue: Object.fromEntries(
        Object.entries(changes).map(([k, v]) => [k, v.from])
      ),
      newValue: Object.fromEntries(
        Object.entries(changes).map(([k, v]) => [k, v.to])
      ),
    });

    return NextResponse.json({ template: tpl });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json(
        { error: "A template with this name already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: e.message || "Failed to update template" },
      { status: 500 }
    );
  }
}

// DELETE /api/email-templates/[id] — delete (ADMIN/SUPER_ADMIN only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Forbidden — admin access required" },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const existing = await db.emailTemplate.findUnique({ where: { id } });
    if (!existing)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.emailTemplate.delete({ where: { id } });

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "DELETE",
      entity: "EMAIL_TEMPLATE",
      entityId: id,
      description: `Deleted email template "${existing.name}"`,
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Failed to delete template" },
      { status: 500 }
    );
  }
}
