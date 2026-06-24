import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";

// PATCH /api/notifications/[id] — set read=true|false
// Body: { read: true|false }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const body = await req.json();
    if (typeof body.read !== "boolean") {
      return NextResponse.json({ error: "read (boolean) is required" }, { status: 400 });
    }

    // Ensure notification belongs to current user
    const existing = await db.notification.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const notification = await db.notification.update({
      where: { id },
      data: { read: body.read },
    });

    return NextResponse.json({ notification });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

// DELETE /api/notifications/[id] — delete notification (owner only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const existing = await db.notification.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.notification.delete({ where: { id } });
    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "DELETE",
      entity: "NOTIFICATION",
      entityId: id,
      description: `Deleted notification "${existing.title}"`,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
