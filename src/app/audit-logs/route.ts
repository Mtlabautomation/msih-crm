import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const entity = searchParams.get("entity");
  const action = searchParams.get("action");
  const userId = searchParams.get("userId");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");

  const where: Prisma.AuditLogWhereInput = {};
  if (entity && entity !== "all") where.entity = entity;
  if (action && action !== "all") where.action = action;
  if (userId) where.userId = userId;

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.auditLog.count({ where }),
  ]);

  return NextResponse.json({ logs, total, page, totalPages: Math.ceil(total / limit) });
}
