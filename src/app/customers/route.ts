import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { Prisma } from "@prisma/client";

// GET /api/customers — list customers
// EXECUTIVE sees customers whose enquiries are assigned to them; MANAGER/ADMIN see all
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const skip = (page - 1) * limit;

  const where: Prisma.CustomerWhereInput = {};

  // RBAC: EXECUTIVE — customers linked to enquiries assigned to them
  if (user.role === "EXECUTIVE") {
    where.enquiries = { some: { assignedTo: user.id } };
  }

  if (search) {
    where.OR = [
      { company: { contains: search } },
      { contactPerson: { contains: search } },
      { mobile: { contains: search } },
      { city: { contains: search } },
      { email: { contains: search } },
      { gstin: { contains: search } },
    ];
  }

  const [customers, total] = await Promise.all([
    db.customer.findMany({
      where,
      include: {
        _count: { select: { enquiries: true, activities: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.customer.count({ where }),
  ]);

  return NextResponse.json({
    customers,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

// POST /api/customers — create a customer
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();

    if (!body.company || !body.contactPerson || !body.mobile) {
      return NextResponse.json({ error: "company, contactPerson and mobile are required" }, { status: 400 });
    }

    // Duplicate detection by mobile or email
    const dupWhere: Prisma.CustomerWhereInput[] = [{ mobile: body.mobile }];
    if (body.email) dupWhere.push({ email: body.email });
    if (body.gstin) dupWhere.push({ gstin: body.gstin });
    const existing = await db.customer.findFirst({ where: { OR: dupWhere } });
    if (existing) {
      return NextResponse.json({ error: "Customer with same mobile/email/gstin already exists", customer: existing }, { status: 409 });
    }

    const customer = await db.customer.create({
      data: {
        company: body.company,
        contactPerson: body.contactPerson,
        mobile: body.mobile,
        email: body.email || null,
        city: body.city || null,
        state: body.state || null,
        address: body.address || null,
        industry: body.industry || null,
        gstin: body.gstin || null,
        website: body.website || null,
        createdBy: user.id,
      },
      include: { _count: { select: { enquiries: true } } },
    });

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "CREATE",
      entity: "CUSTOMER",
      entityId: customer.id,
      description: `Created customer ${customer.company} (${customer.contactPerson}, ${customer.mobile})`,
      newValue: { company: customer.company, contactPerson: customer.contactPerson, mobile: customer.mobile },
    });

    return NextResponse.json({ customer }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
