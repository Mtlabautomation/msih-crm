import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const enquiry = await db.enquiry.findUnique({
    where: { id },
    include: {
      product: true,
      assignedExecutive: true,
      creator: true,
      customer: true,
      followUps: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { date: "desc" },
      },
      quotations: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { date: "desc" },
      },
      activities: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      transfers: {
        include: {
          fromUser: { select: { id: true, name: true } },
          toUser: { select: { id: true, name: true } },
          approver: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!enquiry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // RBAC: executive can only view own
  if (user.role === "EXECUTIVE" && enquiry.assignedTo !== user.id && enquiry.createdBy !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ enquiry });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const existing = await db.enquiry.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // RBAC
  if (user.role === "EXECUTIVE") {
    if (existing.assignedTo !== user.id && existing.createdBy !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Executive cannot reassign or change orderValue after approval
    if (body.assignedTo && body.assignedTo !== existing.assignedTo) {
      return NextResponse.json({ error: "Only managers/admins can reassign leads" }, { status: 403 });
    }
  }

  // Track key changes
  const changes: Record<string, { from: any; to: any }> = {};
  for (const key of ["status", "assignedTo", "budget", "orderValue", "leadScore", "nextFollowUpDate"]) {
    if (body[key] !== undefined && JSON.stringify(body[key]) !== JSON.stringify((existing as any)[key])) {
      changes[key] = { from: (existing as any)[key], to: body[key] };
    }
  }

  const enquiry = await db.enquiry.update({
    where: { id },
    data: {
      ...body,
      date: body.date ? new Date(body.date) : undefined,
      nextFollowUpDate: body.nextFollowUpDate ? new Date(body.nextFollowUpDate) : body.nextFollowUpDate === null ? null : undefined,
      convertedAt: body.status === "CONVERTED" && !existing.convertedAt ? new Date() : undefined,
      lastFollowUpDate: body.status ? new Date() : undefined,
    },
    include: { product: true, assignedExecutive: true },
  });

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "UPDATE",
    entity: "ENQUIRY",
    entityId: id,
    description: `Updated enquiry ${existing.enquiryNumber}${Object.keys(changes).length ? ` — changed: ${Object.keys(changes).join(", ")}` : ""}`,
    previousValue: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.from])),
    newValue: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.to])),
  });

  return NextResponse.json({ enquiry });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const reason = searchParams.get("reason") || "";

  const existing = await db.enquiry.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Admin/Super Admin: permanent delete
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
    const backup = await db.enquiry.findUnique({ where: { id }, include: { followUps: true, quotations: true } });
    await db.enquiry.delete({ where: { id } });
    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "DELETE",
      entity: "ENQUIRY",
      entityId: id,
      description: `Permanently deleted enquiry ${existing.enquiryNumber} (${existing.company}). Reason: ${reason}`,
      previousValue: backup,
    });
    return NextResponse.json({ success: true, deleted: true });
  }

  // Executive/Manager: request deletion
  if (!reason) {
    return NextResponse.json({ error: "Reason is required for deletion request" }, { status: 400 });
  }
  const req2 = await db.deletionRequest.create({
    data: {
      entityType: "ENQUIRY",
      entityId: id,
      entityLabel: `${existing.enquiryNumber} — ${existing.company}`,
      reason,
      requestedById: user.id,
      backupData: JSON.stringify(existing),
    },
  });
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "DELETE",
    entity: "ENQUIRY",
    entityId: id,
    description: `Requested deletion of enquiry ${existing.enquiryNumber}. Reason: ${reason}`,
  });
  return NextResponse.json({ success: true, deletionRequest: req2 });
}
