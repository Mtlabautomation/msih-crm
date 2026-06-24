import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";

// PATCH: approve or reject a deletion request
// body: { approve: boolean, adminNote?: string }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden — only Admin can approve deletions" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();

  const request = await db.deletionRequest.findUnique({ where: { id } });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (request.status !== "PENDING") {
    return NextResponse.json({ error: `Request already ${request.status.toLowerCase()}` }, { status: 400 });
  }

  await db.deletionRequest.update({
    where: { id },
    data: {
      status: body.approve ? "APPROVED" : "REJECTED",
      approvedById: user.id,
      approvedAt: new Date(),
      adminNote: body.adminNote || null,
    },
  });

  if (body.approve) {
    // Execute the deletion based on entity type
    const label = request.entityLabel;
    try {
      if (request.entityType === "ENQUIRY") {
        await db.enquiry.delete({ where: { id: request.entityId } });
      } else if (request.entityType === "FOLLOWUP") {
        await db.followUp.delete({ where: { id: request.entityId } });
      } else if (request.entityType === "QUOTATION") {
        await db.quotation.delete({ where: { id: request.entityId } });
      } else if (request.entityType === "CUSTOMER") {
        await db.customer.delete({ where: { id: request.entityId } });
      }
    } catch {
      // entity may already be gone; ignore
    }
    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "DELETE",
      entity: request.entityType,
      entityId: request.entityId,
      description: `Approved & executed deletion of ${label}. Backup retained. Note: ${body.adminNote || "none"}`,
      previousValue: request.backupData ? JSON.parse(request.backupData) : null,
    });
  } else {
    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "REJECT",
      entity: request.entityType,
      entityId: request.entityId,
      description: `Rejected deletion request for ${label}. Note: ${body.adminNote || "none"}`,
    });
  }

  return NextResponse.json({ success: true, approved: body.approve });
}
