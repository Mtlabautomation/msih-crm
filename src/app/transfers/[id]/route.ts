import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";

// PATCH /api/transfers/[id] — approve or reject a PENDING transfer
// Body: { action: 'approve'|'reject', note? }
// Only MANAGER/ADMIN can approve/reject
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const isManagerOrAbove = user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "MANAGER";
  if (!isManagerOrAbove) {
    return NextResponse.json({ error: "Forbidden — only Manager/Admin can approve transfers" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { action, note } = body;
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
    }

    const transfer = await db.leadTransfer.findUnique({
      where: { id },
      include: {
        enquiry: { select: { id: true, enquiryNumber: true, company: true } },
        fromUser: { select: { id: true, name: true } },
        toUser: { select: { id: true, name: true } },
      },
    });
    if (!transfer) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (transfer.status !== "PENDING") {
      return NextResponse.json({ error: `Transfer already ${transfer.status.toLowerCase()}` }, { status: 400 });
    }

    if (action === "approve") {
      // Update transfer + reassign enquiry
      const [updated] = await db.$transaction([
        db.leadTransfer.update({
          where: { id },
          data: { status: "COMPLETED", approverId: user.id },
        }),
        db.enquiry.update({
          where: { id: transfer.enquiryId },
          data: { assignedTo: transfer.toUserId },
        }),
      ]);
      await logAudit({
        userId: user.id,
        userName: user.name,
        action: "APPROVE",
        entity: "ENQUIRY",
        entityId: transfer.enquiryId,
        description: `Approved transfer of enquiry ${transfer.enquiry.enquiryNumber} from ${transfer.fromUser.name} to ${transfer.toUser.name}. Note: ${note || "none"}`,
        newValue: { transferId: updated.id, fromUserId: transfer.fromUserId, toUserId: transfer.toUserId },
      });
      return NextResponse.json({ transfer: updated });
    } else {
      const updated = await db.leadTransfer.update({
        where: { id },
        data: { status: "REJECTED", approverId: user.id },
      });
      await logAudit({
        userId: user.id,
        userName: user.name,
        action: "REJECT",
        entity: "ENQUIRY",
        entityId: transfer.enquiryId,
        description: `Rejected transfer of enquiry ${transfer.enquiry.enquiryNumber} from ${transfer.fromUser.name} to ${transfer.toUser.name}. Note: ${note || "none"}`,
      });
      return NextResponse.json({ transfer: updated });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

// DELETE /api/transfers/[id] — cancel a PENDING transfer (only requester or ADMIN)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const transfer = await db.leadTransfer.findUnique({
      where: { id },
      include: { enquiry: { select: { enquiryNumber: true, company: true } } },
    });
    if (!transfer) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (transfer.status !== "PENDING") {
      return NextResponse.json({ error: "Only PENDING transfers can be cancelled" }, { status: 400 });
    }

    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    if (!isAdmin && transfer.fromUserId !== user.id) {
      return NextResponse.json({ error: "Forbidden — only the requester or Admin can cancel" }, { status: 403 });
    }

    await db.leadTransfer.delete({ where: { id } });
    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "DELETE",
      entity: "ENQUIRY",
      entityId: transfer.enquiryId,
      description: `Cancelled pending transfer of enquiry ${transfer.enquiry.enquiryNumber}`,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
