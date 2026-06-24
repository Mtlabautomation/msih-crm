import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const where: Prisma.DeletionRequestWhereInput = {};
  if (status && status !== "all") where.status = status;
  // Executives see only their own requests
  if (user.role === "EXECUTIVE") where.requestedById = user.id;

  const requests = await db.deletionRequest.findMany({
    where,
    include: {
      requestedBy: { select: { id: true, name: true, role: true } },
      approvedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ requests });
}

export async function POST(req: NextRequest) {
  // Approve or reject a deletion request
  const user = await getSessionUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const { id, action, adminNote } = body; // action: APPROVE | REJECT

  const req2 = await db.deletionRequest.findUnique({ where: { id } });
  if (!req2 || req2.status !== "PENDING") {
    return NextResponse.json({ error: "Request not found or already processed" }, { status: 400 });
  }

  if (action === "APPROVE") {
    // Perform the deletion
    if (req2.entityType === "ENQUIRY") {
      const backup = await db.enquiry.findUnique({
        where: { id: req2.entityId },
        include: { followUps: true, quotations: true, activities: true, tasks: true },
      });
      await db.enquiry.delete({ where: { id: req2.entityId } }).catch(() => {});
      await db.deletionRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedById: user.id,
          approvedAt: new Date(),
          adminNote,
          backupData: JSON.stringify(backup),
        },
      });
    }
    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "APPROVE",
      entity: req2.entityType as any,
      entityId: req2.entityId,
      description: `Approved deletion of ${req2.entityLabel}. Backup retained. Note: ${adminNote || "—"}`,
    });
  } else {
    await db.deletionRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        approvedById: user.id,
        approvedAt: new Date(),
        adminNote,
      },
    });
    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "REJECT",
      entity: req2.entityType as any,
      entityId: req2.entityId,
      description: `Rejected deletion request for ${req2.entityLabel}. Note: ${adminNote || "—"}`,
    });
  }

  return NextResponse.json({ success: true });
}
