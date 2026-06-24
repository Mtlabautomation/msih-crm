import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const existing = await db.followUp.findUnique({ where: { id }, include: { enquiry: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Follow-up history is immutable (only completion can be toggled, notes appended via activity)
  const followUp = await db.followUp.update({
    where: { id },
    data: {
      completed: body.completed ?? existing.completed,
      outcome: body.outcome ?? existing.outcome,
      nextFollowUpDate: body.nextFollowUpDate ? new Date(body.nextFollowUpDate) : undefined,
    },
  });

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "UPDATE",
    entity: "FOLLOWUP",
    entityId: id,
    description: `Updated follow-up for ${existing.enquiry.enquiryNumber}`,
    previousValue: { completed: existing.completed, outcome: existing.outcome },
    newValue: { completed: followUp.completed, outcome: followUp.outcome },
  });

  return NextResponse.json({ followUp });
}
