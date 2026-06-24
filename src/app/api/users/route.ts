import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await db.user.findMany({
    select: {
      id: true, email: true, name: true, role: true, phone: true,
      employeeId: true, designation: true, city: true, state: true,
      active: true, createdAt: true,
      _count: { select: { enquiries: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const pwd = await bcrypt.hash(body.password || "admin@123", 10);

  const newUser = await db.user.create({
    data: {
      email: body.email.toLowerCase(),
      name: body.name,
      password: pwd,
      role: body.role || "EXECUTIVE",
      phone: body.phone || null,
      employeeId: body.employeeId || null,
      designation: body.designation || null,
      city: body.city || null,
      state: body.state || null,
    },
  });

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "CREATE",
    entity: "USER",
    entityId: newUser.id,
    description: `Created user ${newUser.name} (${newUser.email}) with role ${newUser.role}`,
  });

  return NextResponse.json({
    user: { ...newUser, password: undefined },
  });
}
