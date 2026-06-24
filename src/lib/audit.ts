// MSIH CRM V1.0 — Audit Log Helper
// Immutable audit trail for every mutation

import { db } from "@/lib/db";
import { headers } from "next/headers";

export interface AuditContext {
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId?: string;
  description: string;
  previousValue?: any;
  newValue?: any;
}

export async function logAudit(ctx: AuditContext) {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0] ||
    h.get("x-real-ip") ||
    "unknown";
  const userAgent = h.get("user-agent") || "unknown";

  await db.auditLog.create({
    data: {
      userId: ctx.userId,
      userName: ctx.userName,
      action: ctx.action,
      entity: ctx.entity,
      entityId: ctx.entityId,
      description: ctx.description,
      previousValue: ctx.previousValue ? JSON.stringify(ctx.previousValue) : null,
      newValue: ctx.newValue ? JSON.stringify(ctx.newValue) : null,
      ipAddress: ip,
      userAgent,
    },
  });
}
