import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";

// DELETE /api/activities/[id] — hard delete activity
// Only ADMIN or the activity creator (userId) can delete
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const activity = await db.activity.findUnique({ where: { id } });
    if (!activity) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    if (!isAdmin && activity.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden — only the creator or Admin can delete" }, { status: 403 });
    }

    await db.activity.delete({ where: { id } });
    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "DELETE",
      entity: "ACTIVITY",
      entityId: id,
      description: `Deleted activity (${activity.type}): ${activity.content.slice(0, 80)}`,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
