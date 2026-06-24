// MSIH CRM V1.0 — Saved View by ID
// Developer: Manoj Dore — MIT License

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const existing = await db.savedView.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.userId !== user.id && user.role === "EXECUTIVE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data: any = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.filters !== undefined) data.filters = JSON.stringify(body.filters);
  if (body.isDefault !== undefined) {
    if (body.isDefault) {
      await db.savedView.updateMany({
        where: { userId: existing.userId, entity: existing.entity, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }
    data.isDefault = body.isDefault;
  }

  const view = await db.savedView.update({ where: { id }, data });
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "UPDATE",
    entity: "SAVED_VIEW",
    entityId: id,
    description: `Updated saved view "${existing.name}"`,
  });
  return NextResponse.json({ view });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await db.savedView.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.userId !== user.id && user.role === "EXECUTIVE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.savedView.delete({ where: { id } });
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "DELETE",
    entity: "SAVED_VIEW",
    entityId: id,
    description: `Deleted saved view "${existing.name}"`,
  });
  return NextResponse.json({ ok: true });
}
