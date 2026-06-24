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
  const search = searchParams.get("search");

  const where: Prisma.QuotationWhereInput = {};
  if (user.role === "EXECUTIVE") where.createdBy = user.id;
  if (status && status !== "all") where.status = status;
  if (search) {
    where.OR = [
      { number: { contains: search } },
      { enquiry: { company: { contains: search } } },
      { enquiry: { contactPerson: { contains: search } } },
    ];
  }

  const quotations = await db.quotation.findMany({
    where,
    include: {
      enquiry: { select: { id: true, enquiryNumber: true, company: true, contactPerson: true, productInterested: true } },
      user: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ quotations });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();

  const count = await db.quotation.count();
  const number = `QT-${new Date().getFullYear()}-${String(5001 + count)}`;

  const quotation = await db.quotation.create({
    data: {
      enquiryId: body.enquiryId,
      number,
      date: new Date(),
      amount: parseFloat(body.amount),
      status: body.status || "DRAFT",
      validUntil: body.validUntil ? new Date(body.validUntil) : new Date(Date.now() + 30 * 86400000),
      items: body.items ? JSON.stringify(body.items) : null,
      notes: body.notes || null,
      createdBy: user.id,
    },
    include: { enquiry: true },
  });

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "CREATE",
    entity: "QUOTATION",
    entityId: quotation.id,
    description: `Created quotation ${number} for ${quotation.enquiry.company} — ₹${body.amount}`,
  });

  return NextResponse.json({ quotation });
}
