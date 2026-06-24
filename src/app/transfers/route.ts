import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { Prisma } from "@prisma/client";

// GET /api/transfers — list lead transfers
// EXECUTIVE sees transfers initiated OR received by them; MANAGER/ADMIN see all
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const enquiryId = searchParams.get("enquiryId");

  const where: Prisma.LeadTransferWhereInput = {};
  if (user.role === "EXECUTIVE") {
    where.OR = [{ fromUserId: user.id }, { toUserId: user.id }];
  }
  if (status && status !== "all") where.status = status;
  if (enquiryId) where.enquiryId = enquiryId;

  const transfers = await db.leadTransfer.findMany({
    where,
    include: {
      enquiry: {
        select: {
          id: true, enquiryNumber: true, company: true, contactPerson: true,
          mobile: true, productInterested: true, status: true, assignedTo: true,
        },
      },
      fromUser: { select: { id: true, name: true, role: true } },
      toUser: { select: { id: true, name: true, role: true } },
      approver: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ transfers, total: transfers.length });
}

// POST /api/transfers — create a new lead transfer request
// Body: { enquiryId, toUserId, reason }
// EXECUTIVE transferring own lead → PENDING (needs manager approval)
// MANAGER/ADMIN creating transfer → auto-approved (COMPLETED), enquiry reassigned
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { enquiryId, toUserId, reason } = body;

    if (!enquiryId || !toUserId || !reason) {
      return NextResponse.json({ error: "enquiryId, toUserId, and reason are required" }, { status: 400 });
    }

    // Validate enquiry exists
    const enquiry = await db.enquiry.findUnique({ where: { id: enquiryId } });
    if (!enquiry) return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });

    // Validate target user exists and is active
    const toUser = await db.user.findUnique({ where: { id: toUserId } });
    if (!toUser) return NextResponse.json({ error: "Target user not found" }, { status: 404 });

    // RBAC: EXECUTIVE can only transfer own assigned leads
    const isManagerOrAbove = user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "MANAGER";
    if (!isManagerOrAbove && enquiry.assignedTo !== user.id) {
      return NextResponse.json({ error: "You can only transfer leads assigned to you" }, { status: 403 });
    }
    if (toUserId === enquiry.assignedTo) {
      return NextResponse.json({ error: "Lead is already assigned to this user" }, { status: 400 });
    }

    const autoApprove = isManagerOrAbove;
    const transfer = await db.leadTransfer.create({
      data: {
        enquiryId,
        fromUserId: enquiry.assignedTo,
        toUserId,
        reason,
        status: autoApprove ? "COMPLETED" : "PENDING",
        approverId: autoApprove ? user.id : null,
      },
      include: {
        enquiry: { select: { id: true, enquiryNumber: true, company: true } },
        fromUser: { select: { id: true, name: true } },
        toUser: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
      },
    });

    // If auto-approved, reassign the enquiry immediately
    if (autoApprove) {
      await db.enquiry.update({
        where: { id: enquiryId },
        data: { assignedTo: toUserId },
      });
    }

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "TRANSFER",
      entity: "ENQUIRY",
      entityId: enquiryId,
      description: `${autoApprove ? "Transferred" : "Requested transfer of"} enquiry ${enquiry.enquiryNumber} from ${transfer.fromUser.name} to ${transfer.toUser.name}. Reason: ${reason}`,
      newValue: { fromUserId: transfer.fromUserId, toUserId, status: transfer.status, reason },
    });

    return NextResponse.json({ transfer }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
