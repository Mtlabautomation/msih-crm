import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const bucket = searchParams.get("bucket"); // today | tomorrow | overdue | all
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endToday = new Date(startToday.getTime() + 86400000);
  const endTomorrow = new Date(startToday.getTime() + 2 * 86400000);

  const baseWhere: Prisma.FollowUpWhereInput = {};
  if (user.role === "EXECUTIVE") baseWhere.createdBy = user.id;

  let where = baseWhere;
  if (bucket === "today") {
    where = { ...baseWhere, completed: false, nextFollowUpDate: { gte: startToday, lt: endToday } };
  } else if (bucket === "tomorrow") {
    where = { ...baseWhere, completed: false, nextFollowUpDate: { gte: endToday, lt: endTomorrow } };
  } else if (bucket === "overdue") {
    where = { ...baseWhere, completed: false, nextFollowUpDate: { lt: startToday } };
  } else if (bucket === "completed") {
    where = { ...baseWhere, completed: true };
  }

  const followUps = await db.followUp.findMany({
    where,
    include: {
      enquiry: {
        select: {
          id: true, enquiryNumber: true, company: true, contactPerson: true,
          mobile: true, productInterested: true, status: true, leadScore: true,
        },
      },
      user: { select: { id: true, name: true } },
    },
    orderBy: { nextFollowUpDate: "asc" },
  });

  return NextResponse.json({ followUps });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();

  const followUp = await db.followUp.create({
    data: {
      enquiryId: body.enquiryId,
      date: new Date(),
      nextFollowUpDate: body.nextFollowUpDate ? new Date(body.nextFollowUpDate) : null,
      method: body.method || "CALL",
      status: body.status || "WARM",
      notes: body.notes,
      outcome: body.outcome || null,
      completed: body.completed ?? false,
      createdBy: user.id,
    },
    include: { enquiry: true },
  });

  // Update enquiry's last/next follow-up + status
  await db.enquiry.update({
    where: { id: body.enquiryId },
    data: {
      lastFollowUpDate: new Date(),
      nextFollowUpDate: body.nextFollowUpDate ? new Date(body.nextFollowUpDate) : null,
      status: body.enquiryStatus || followUp.enquiry.status,
    },
  });

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "CREATE",
    entity: "FOLLOWUP",
    entityId: followUp.id,
    description: `Added follow-up for ${followUp.enquiry.enquiryNumber} (${followUp.enquiry.company}) — ${body.method}, status: ${body.status}`,
  });

  return NextResponse.json({ followUp });
}
