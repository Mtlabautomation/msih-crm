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
  const assignedTo = searchParams.get("assignedTo");
  const source = searchParams.get("source");
  const productId = searchParams.get("productId");
  const state = searchParams.get("state");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const minBudget = searchParams.get("minBudget");
  const maxBudget = searchParams.get("maxBudget");
  const minLeadScore = searchParams.get("minLeadScore");
  const maxLeadScore = searchParams.get("maxLeadScore");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const where: Prisma.EnquiryWhereInput = {};

  // RBAC
  if (user.role === "EXECUTIVE") {
    where.assignedTo = user.id;
  } else if (assignedTo && assignedTo !== "all") {
    where.assignedTo = assignedTo;
  }

  if (status && status !== "all") where.status = status;
  if (source && source !== "all") where.source = source;
  if (productId && productId !== "all") where.productId = productId;
  if (state && state !== "all") where.state = state;

  // Date range filter on enquiry.date (createdAt-like)
  if (dateFrom || dateTo) {
    const range: Prisma.DateTimeFilter = {};
    if (dateFrom) range.gte = new Date(dateFrom);
    if (dateTo) {
      // inclusive: add a full day so dateTo covers the entire end date
      const end = new Date(dateTo);
      end.setUTCHours(23, 59, 59, 999);
      range.lte = end;
    }
    where.date = range;
  }

  // Budget range filter
  if (minBudget || maxBudget) {
    const range: Prisma.FloatFilter = {};
    if (minBudget) range.gte = parseFloat(minBudget);
    if (maxBudget) range.lte = parseFloat(maxBudget);
    where.budget = range;
  }

  // Lead score range filter
  if (minLeadScore || maxLeadScore) {
    const range: Prisma.IntFilter = {};
    if (minLeadScore) range.gte = parseInt(minLeadScore);
    if (maxLeadScore) range.lte = parseInt(maxLeadScore);
    where.leadScore = range;
  }

  if (search) {
    where.OR = [
      { company: { contains: search } },
      { contactPerson: { contains: search } },
      { mobile: { contains: search } },
      { email: { contains: search } },
      { enquiryNumber: { contains: search } },
      { productInterested: { contains: search } },
    ];
  }

  const [enquiries, total] = await Promise.all([
    db.enquiry.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, category: true } },
        assignedExecutive: { select: { id: true, name: true } },
        _count: { select: { followUps: true, quotations: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.enquiry.count({ where }),
  ]);

  return NextResponse.json({
    enquiries,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Duplicate detection (mobile, email, company)
  const dupChecks: Prisma.EnquiryWhereInput[] = [{ mobile: body.mobile }];
  if (body.email) dupChecks.push({ email: body.email });
  if (body.company) dupChecks.push({ company: body.company });
  const duplicates = await db.enquiry.findMany({
    where: { OR: dupChecks },
    take: 1,
  });

  // Generate enquiry number
  const count = await db.enquiry.count();
  const enquiryNumber = `ENQ-${new Date().getFullYear()}-${String(1001 + count)}`;

  // Find or create customer
  let customerId = body.customerId;
  if (!customerId) {
    const existing = await db.customer.findFirst({
      where: { OR: [{ mobile: body.mobile }, ...(body.email ? [{ email: body.email }] : [])] },
    });
    if (existing) {
      customerId = existing.id;
    } else {
      const cust = await db.customer.create({
        data: {
          company: body.company,
          contactPerson: body.contactPerson,
          mobile: body.mobile,
          email: body.email || null,
          city: body.city || null,
          state: body.state || null,
          industry: body.industry || null,
          createdBy: user.id,
        },
      });
      customerId = cust.id;
    }
  }

  const enquiry = await db.enquiry.create({
    data: {
      enquiryNumber,
      date: body.date ? new Date(body.date) : new Date(),
      source: body.source || "WEBSITE",
      customerId,
      company: body.company,
      contactPerson: body.contactPerson,
      mobile: body.mobile,
      email: body.email || null,
      productInterested: body.productInterested,
      productId: body.productId || null,
      budget: body.budget ? parseFloat(body.budget) : null,
      city: body.city || null,
      state: body.state || null,
      specification: body.specification || null,
      remarks: body.remarks || null,
      assignedTo: body.assignedTo || user.id,
      createdBy: user.id,
      status: "NEW",
      leadScore: Math.floor(Math.random() * 40) + 20, // initial score
      conversionProb: Math.floor(Math.random() * 30) + 10,
      nextFollowUpDate: body.nextFollowUpDate ? new Date(body.nextFollowUpDate) : null,
    },
    include: { product: true, assignedExecutive: true },
  });

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "CREATE",
    entity: "ENQUIRY",
    entityId: enquiry.id,
    description: `Created enquiry ${enquiryNumber} for ${body.company} (${body.productInterested})`,
    newValue: { company: body.company, product: body.productInterested, assignedTo: body.assignedTo },
  });

  return NextResponse.json({ enquiry, duplicate: duplicates.length > 0 });
}
