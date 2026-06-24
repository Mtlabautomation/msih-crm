import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";

// GET /api/reminders/[id] — single reminder with relations
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const reminder = await db.reminderQueue.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, role: true } },
      enquiry: { select: { id: true, enquiryNumber: true, company: true, status: true } },
      customer: { select: { id: true, company: true, contactPerson: true, mobile: true, email: true } },
    },
  });

  if (!reminder) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // RBAC: EXECUTIVE can only view reminders they created
  if (user.role === "EXECUTIVE" && reminder.createdBy !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ reminder });
}

// PATCH /api/reminders/[id] — update status
// Body: { status, errorMessage?, attemptCount? }
//   SENT     → set sentAt=now, increment attemptCount
//   FAILED   → increment attemptCount, store errorMessage
//   CANCELLED → only creator or ADMIN+
// RBAC: creator can update their own; ADMIN+ can update any.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const body = await req.json();
    const { status, errorMessage, attemptCount } = body;

    if (!status || !["QUEUED", "SENT", "FAILED", "CANCELLED"].includes(status)) {
      return NextResponse.json(
        { error: "status must be QUEUED, SENT, FAILED, or CANCELLED" },
        { status: 400 }
      );
    }

    const existing = await db.reminderQueue.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    // RBAC: only creator (or ADMIN+) may update
    if (!isAdmin && existing.createdBy !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // CANCELLED restricted to creator or ADMIN+ (creator already allowed above; nothing further needed,
    // but explicit guard kept for clarity)
    if (status === "CANCELLED" && !isAdmin && existing.createdBy !== user.id) {
      return NextResponse.json(
        { error: "Only the creator or an Admin can cancel a reminder" },
        { status: 403 }
      );
    }

    // Build update data based on target status
    const data: any = { status };
    if (status === "SENT") {
      data.sentAt = new Date();
      data.attemptCount = (existing.attemptCount || 0) + 1;
      data.errorMessage = null;
    } else if (status === "FAILED") {
      data.attemptCount = (existing.attemptCount || 0) + 1;
      data.errorMessage = errorMessage || existing.errorMessage || "Delivery failed";
      data.sentAt = existing.sentAt; // preserve any prior sentAt
    } else if (status === "QUEUED") {
      // Retry: reset to QUEUED, clear error, allow optional attemptCount override
      data.sentAt = null;
      data.errorMessage = null;
      if (typeof attemptCount === "number") data.attemptCount = attemptCount;
    } else if (status === "CANCELLED") {
      data.errorMessage = null;
    }

    const reminder = await db.reminderQueue.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, name: true } },
        enquiry: { select: { id: true, enquiryNumber: true, company: true } },
        customer: { select: { id: true, company: true, contactPerson: true } },
      },
    });

    const prevSummary = {
      status: existing.status,
      attemptCount: existing.attemptCount,
      sentAt: existing.sentAt,
      errorMessage: existing.errorMessage,
    };
    const newSummary = {
      status: reminder.status,
      attemptCount: reminder.attemptCount,
      sentAt: reminder.sentAt,
      errorMessage: reminder.errorMessage,
    };

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "UPDATE",
      entity: "REMINDER",
      entityId: id,
      description: `Reminder to ${existing.recipient} status: ${existing.status} → ${status}${
        status === "FAILED" && errorMessage ? ` — ${errorMessage}` : ""
      }`,
      previousValue: prevSummary,
      newValue: newSummary,
    });

    return NextResponse.json({ reminder });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

// DELETE /api/reminders/[id] — ADMIN+ only (hard delete with audit log)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  if (!isAdmin) {
    return NextResponse.json(
      { error: "Forbidden — only Admins can delete reminders" },
      { status: 403 }
    );
  }

  try {
    const existing = await db.reminderQueue.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.reminderQueue.delete({ where: { id } });

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "DELETE",
      entity: "REMINDER",
      entityId: id,
      description: `Deleted ${existing.channel} reminder to ${existing.recipient}${
        existing.recipientName ? ` (${existing.recipientName})` : ""
      }`,
      previousValue: {
        channel: existing.channel,
        recipient: existing.recipient,
        recipientName: existing.recipientName,
        message: existing.message,
        status: existing.status,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
