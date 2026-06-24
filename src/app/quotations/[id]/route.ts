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
  const existing = await db.quotation.findUnique({ where: { id }, include: { enquiry: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Revenue manipulation prevention: once accepted/approved, amount locked for executives
  if (
    body.amount !== undefined &&
    body.amount !== existing.amount &&
    user.role === "EXECUTIVE" &&
    (existing.status === "ACCEPTED" || existing.approvedBy)
  ) {
    return NextResponse.json({ error: "Cannot modify amount after approval. Requires manager approval." }, { status: 403 });
  }

  const data: any = { ...body };
  if (body.validUntil) data.validUntil = new Date(body.validUntil);
  if (body.items) data.items = JSON.stringify(body.items);
  if (body.status === "ACCEPTED" && !existing.approvedBy && (user.role === "MANAGER" || user.role === "ADMIN" || user.role === "SUPER_ADMIN")) {
    data.approvedBy = user.id;
    data.approvedAt = new Date();
    // mark enquiry converted
    await db.enquiry.update({
      where: { id: existing.enquiryId },
      data: { status: "CONVERTED", convertedAt: new Date(), orderValue: existing.amount },
    });
  }

  const quotation = await db.quotation.update({ where: { id }, data });
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "UPDATE",
    entity: "QUOTATION",
    entityId: id,
    description: `Updated quotation ${existing.number} — status: ${body.status || existing.status}`,
  });

  return NextResponse.json({ quotation });
}
