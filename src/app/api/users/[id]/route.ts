import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  // Only admin/superadmin can edit other users; user can edit own profile (limited)
  const isSelf = user.id === id;
  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  if (!isSelf && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: any = {
    name: body.name,
    phone: body.phone,
    designation: body.designation,
    city: body.city,
    state: body.state,
  };
  if (isAdmin) {
    data.role = body.role;
    data.active = body.active;
    data.employeeId = body.employeeId;
  }
  if (body.password) {
    data.password = await bcrypt.hash(body.password, 10);
  }

  const updated = await db.user.update({ where: { id }, data });
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "UPDATE",
    entity: "USER",
    entityId: id,
    description: `Updated user ${existing.name}${body.password ? " (password reset)" : ""}`,
  });

  return NextResponse.json({ user: { ...updated, password: undefined } });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  // Soft-disable instead of hard delete
  const existing = await db.user.findUnique({ where: { id } });
  await db.user.update({ where: { id }, data: { active: false } });
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "DELETE",
    entity: "USER",
    entityId: id,
    description: `Disabled user ${existing?.name} (${existing?.email})`,
  });
  return NextResponse.json({ success: true });
}
