import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { Prisma } from "@prisma/client";

// GET /api/activities — list activities
// EXECUTIVE sees own; MANAGER/ADMIN see all
// ?entity=enquiry&entityId=... filter supported
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const entity = searchParams.get("entity"); // enquiry | customer
  const entityId = searchParams.get("entityId");
  const userId = searchParams.get("userId");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

  const where: Prisma.ActivityWhereInput = {};
  if (user.role === "EXECUTIVE") where.userId = user.id;
  else if (userId) where.userId = userId;

  if (entity === "enquiry" && entityId) where.enquiryId = entityId;
  if (entity === "customer" && entityId) where.customerId = entityId;

  const activities = await db.activity.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, role: true } },
      enquiry: { select: { id: true, enquiryNumber: true, company: true } },
      customer: { select: { id: true, company: true, contactPerson: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ activities, total: activities.length });
}

// POST /api/activities — create activity for current user
// Body: { type, entity, entityId, description, metadata? }
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { type, entity, entityId, description, metadata } = body;

    if (!type || !description) {
      return NextResponse.json({ error: "type and description are required" }, { status: 400 });
    }

    // Map entity → enquiryId / customerId
    const enquiryId = entity === "enquiry" && entityId ? entityId : null;
    const customerId = entity === "customer" && entityId ? entityId : null;

    // metadata is appended to content as JSON if provided (no dedicated column in schema)
    const content = metadata
      ? `${description}\n[metadata: ${JSON.stringify(metadata)}]`
      : description;

    const activity = await db.activity.create({
      data: {
        type,
        enquiryId,
        customerId,
        userId: user.id,
        content,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "CREATE",
      entity: "ACTIVITY",
      entityId: activity.id,
      description: `Logged activity (${type})${enquiryId ? ` on enquiry` : ""}${customerId ? ` on customer` : ""}: ${description}`,
      newValue: { type, entity, entityId, description },
    });

    return NextResponse.json({ activity }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
