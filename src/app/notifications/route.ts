import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { Prisma } from "@prisma/client";

// MSIH CRM V1.0 — Notifications endpoint (Task 9-b)
// Returns the most recent AuditLog events relevant to the current user.
// Developer: Manoj Dore

// GET /api/notifications — recent activity feed for the bell dropdown
// Query params:
//   - limit: number of items (default 25, max 50)
//   - recent: optional time window — "24h" limits to events from last 24 hours
// Role-based scoping:
//   - EXECUTIVE: only their own audit events (userId = currentUser.id)
//   - MANAGER / ADMIN / SUPER_ADMIN: all events
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const rawLimit = parseInt(searchParams.get("limit") || "25", 10);
  const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? rawLimit : 25, 50));
  const recent = searchParams.get("recent"); // "24h" → last 24 hours

  const where: Prisma.AuditLogWhereInput = {};

  // Role-based scoping — EXECUTIVE sees only their own activity
  if (user.role === "EXECUTIVE") {
    where.userId = user.id;
  }

  // Optional time window (e.g., managers/admins may request ?recent=24h)
  if (recent === "24h") {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    where.timestamp = { gte: since };
  }

  const logs = await db.auditLog.findMany({
    where,
    orderBy: { timestamp: "desc" },
    take: limit,
  });

  // Project to the response shape (camelCase createdAt as ISO string)
  const items = logs.map((l) => ({
    id: l.id,
    action: l.action,
    entity: l.entity,
    description: l.description,
    userName: l.userName,
    createdAt: l.timestamp.toISOString(),
  }));

  return NextResponse.json(items);
}

// POST /api/notifications — mark all read or single read
// Body: { action: 'mark-all-read' } OR { id, action: 'mark-read' }
// (Preserved from original route — operates on the Notification model,
//  used by future explicit-notification features.)
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { action, id } = body;

    if (action === "mark-all-read") {
      const result = await db.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true },
      });
      await logAudit({
        userId: user.id,
        userName: user.name,
        action: "UPDATE",
        entity: "NOTIFICATION",
        description: `Marked ${result.count} notifications as read`,
      });
      return NextResponse.json({ success: true, updated: result.count });
    }

    if (action === "mark-read" && id) {
      const result = await db.notification.updateMany({
        where: { id, userId: user.id },
        data: { read: true },
      });
      return NextResponse.json({ success: true, updated: result.count });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'mark-all-read' or { action: 'mark-read', id }" },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
