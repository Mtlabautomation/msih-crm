import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";

// GET /api/customers/[id] — customer with enquiries + activities
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      enquiries: {
        include: {
          product: { select: { id: true, name: true } },
          assignedExecutive: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      activities: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // RBAC: EXECUTIVE can only view customers whose enquiries are assigned to them
  if (user.role === "EXECUTIVE") {
    const hasAssigned = customer.enquiries.some((e) => e.assignedTo === user.id);
    if (!hasAssigned && customer.createdBy !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.json({ customer });
}

// PATCH /api/customers/[id] — update customer fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const body = await req.json();
    const existing = await db.customer.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Track key changes
    const changes: Record<string, { from: any; to: any }> = {};
    for (const key of ["company", "contactPerson", "mobile", "email", "city", "state", "gstin", "industry", "website"]) {
      if (body[key] !== undefined && JSON.stringify(body[key]) !== JSON.stringify((existing as any)[key])) {
        changes[key] = { from: (existing as any)[key], to: body[key] };
      }
    }

    const customer = await db.customer.update({
      where: { id },
      data: {
        company: body.company ?? undefined,
        contactPerson: body.contactPerson ?? undefined,
        mobile: body.mobile ?? undefined,
        email: body.email ?? undefined,
        city: body.city ?? undefined,
        state: body.state ?? undefined,
        address: body.address ?? undefined,
        industry: body.industry ?? undefined,
        gstin: body.gstin ?? undefined,
        website: body.website ?? undefined,
      },
    });

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "UPDATE",
      entity: "CUSTOMER",
      entityId: id,
      description: `Updated customer ${existing.company}${Object.keys(changes).length ? ` — changed: ${Object.keys(changes).join(", ")}` : ""}`,
      previousValue: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.from])),
      newValue: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.to])),
    });

    return NextResponse.json({ customer });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

// DELETE /api/customers/[id] — deletion flow
// ADMIN: hard delete after backup; else: create DeletionRequest
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const reason = searchParams.get("reason") || "";

  const existing = await db.customer.findUnique({
    where: { id },
    include: { enquiries: { select: { id: true, enquiryNumber: true, company: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Admin/Super Admin: permanent delete
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
    const backup = await db.customer.findUnique({
      where: { id },
      include: { enquiries: true, activities: true },
    });
    await db.customer.delete({ where: { id } });
    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "DELETE",
      entity: "CUSTOMER",
      entityId: id,
      description: `Permanently deleted customer ${existing.company}. Reason: ${reason}`,
      previousValue: backup,
    });
    return NextResponse.json({ success: true, deleted: true });
  }

  // Executive/Manager: request deletion
  if (!reason) {
    return NextResponse.json({ error: "Reason is required for deletion request" }, { status: 400 });
  }
  const deletionRequest = await db.deletionRequest.create({
    data: {
      entityType: "CUSTOMER",
      entityId: id,
      entityLabel: `${existing.company} — ${existing.contactPerson}`,
      reason,
      requestedById: user.id,
      backupData: JSON.stringify(existing),
    },
  });
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "DELETE",
    entity: "CUSTOMER",
    entityId: id,
    description: `Requested deletion of customer ${existing.company}. Reason: ${reason}`,
  });
  return NextResponse.json({ success: true, deletionRequest });
}
