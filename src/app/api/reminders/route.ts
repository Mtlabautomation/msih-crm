import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { Prisma } from "@prisma/client";

// GET /api/reminders — list reminders
// EXECUTIVE sees only their own; MANAGER/ADMIN/SUPER_ADMIN see all.
// Filters: ?status=QUEUED|SENT|FAILED|CANCELLED  ?channel=WHATSAPP|SMS|EMAIL  ?overdue=1
// Ordered by scheduledAt desc; includes user, enquiry, customer relations.
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const channel = searchParams.get("channel");
  const overdue = searchParams.get("overdue") === "1";
  const limit = Math.min(parseInt(searchParams.get("limit") || "200"), 500);
  const now = new Date();

  const where: Prisma.ReminderQueueWhereInput = {};

  // RBAC: EXECUTIVE only sees reminders they created
  if (user.role === "EXECUTIVE") where.createdBy = user.id;

  if (status) where.status = status;
  if (channel) where.channel = channel;
  if (overdue) {
    where.status = "QUEUED";
    where.scheduledAt = { lt: now };
  }

  const reminders = await db.reminderQueue.findMany({
    where,
    include: {
      user: { select: { id: true, name: true } },
      enquiry: { select: { id: true, enquiryNumber: true, company: true } },
      customer: { select: { id: true, company: true, contactPerson: true } },
    },
    orderBy: { scheduledAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ reminders, total: reminders.length });
}

// POST /api/reminders — create a reminder (all authenticated roles)
// Body: { channel?, recipient, recipientName?, message, enquiryId?, customerId?, scheduledAt? }
// Defaults: channel=WHATSAPP, scheduledAt=now. Logs audit (entity=REMINDER, action=CREATE).
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      channel,
      recipient,
      recipientName,
      message,
      enquiryId,
      customerId,
      scheduledAt,
    } = body;

    if (!recipient || !message) {
      return NextResponse.json(
        { error: "recipient and message are required" },
        { status: 400 }
      );
    }

    const finalChannel = channel || "WHATSAPP";
    if (!["WHATSAPP", "SMS", "EMAIL"].includes(finalChannel)) {
      return NextResponse.json(
        { error: "channel must be WHATSAPP, SMS, or EMAIL" },
        { status: 400 }
      );
    }

    // Validate optional relations if provided
    if (enquiryId) {
      const enq = await db.enquiry.findUnique({ where: { id: enquiryId } });
      if (!enq) return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
    }
    if (customerId) {
      const cust = await db.customer.findUnique({ where: { id: customerId } });
      if (!cust) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const reminder = await db.reminderQueue.create({
      data: {
        channel: finalChannel,
        recipient: String(recipient).trim(),
        recipientName: recipientName ? String(recipientName).trim() : null,
        message: String(message),
        enquiryId: enquiryId || null,
        customerId: customerId || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
        status: "QUEUED",
        attemptCount: 0,
        createdBy: user.id,
      },
      include: {
        user: { select: { id: true, name: true } },
        enquiry: { select: { id: true, enquiryNumber: true, company: true } },
        customer: { select: { id: true, company: true, contactPerson: true } },
      },
    });

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "CREATE",
      entity: "REMINDER",
      entityId: reminder.id,
      description: `Queued ${finalChannel} reminder to ${recipient}${
        recipientName ? ` (${recipientName})` : ""
      }${scheduledAt ? ` for ${new Date(scheduledAt).toLocaleString("en-IN")}` : ""}`,
      newValue: {
        channel: finalChannel,
        recipient,
        recipientName: recipientName || null,
        enquiryId: enquiryId || null,
        customerId: customerId || null,
        scheduledAt: reminder.scheduledAt,
      },
    });

    return NextResponse.json({ reminder }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
