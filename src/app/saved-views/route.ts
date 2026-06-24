// MSIH CRM V1.0 — Saved Views API
// Persist per-user filter presets for any entity (enquiries, followups, etc.).
// Developer: Manoj Dore — MIT License

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";

// GET /api/saved-views?entity=ENQUIRY
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const entity = searchParams.get("entity");

  const where: any = { userId: user.id };
  if (entity) where.entity = entity;

  const views = await db.savedView.findMany({
    where,
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ views });
}

// POST /api/saved-views — create a saved view
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, entity, filters, isDefault } = body;

    if (!name || !entity) {
      return NextResponse.json({ error: "name and entity are required" }, { status: 400 });
    }

    // If setting as default, unset other defaults for same entity+user
    if (isDefault) {
      await db.savedView.updateMany({
        where: { userId: user.id, entity, isDefault: true },
        data: { isDefault: false },
      });
    }

    const view = await db.savedView.create({
      data: {
        userId: user.id,
        name,
        entity,
        filters: JSON.stringify(filters || {}),
        isDefault: !!isDefault,
      },
    });

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "CREATE",
      entity: "SAVED_VIEW",
      entityId: view.id,
      description: `Saved view "${name}" for ${entity}`,
    });

    return NextResponse.json({ view });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
