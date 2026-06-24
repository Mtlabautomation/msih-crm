import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";

// MSIH CRM V1.0 — Bulk Reassign Enquiries
// RBAC: Only MANAGER / ADMIN / SUPER_ADMIN can reassign.
// Accepts { enquiryIds: string[], assignedTo: string } and atomically reassigns
// all matching enquiries to the target executive, with per-row audit logs.

const ALLOWED_ROLES = new Set(["MANAGER", "ADMIN", "SUPER_ADMIN"]);

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!ALLOWED_ROLES.has(user.role)) {
    return NextResponse.json(
      { error: "Forbidden — only managers and admins can reassign enquiries" },
      { status: 403 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const enquiryIds: unknown = body?.enquiryIds;
  const assignedTo: unknown = body?.assignedTo;

  // Validate enquiryIds
  if (
    !Array.isArray(enquiryIds) ||
    enquiryIds.length === 0 ||
    !enquiryIds.every((id) => typeof id === "string" && id.trim().length > 0)
  ) {
    return NextResponse.json(
      { error: "enquiryIds must be a non-empty array of strings" },
      { status: 400 }
    );
  }

  // Validate assignedTo
  if (typeof assignedTo !== "string" || assignedTo.trim().length === 0) {
    return NextResponse.json(
      { error: "assignedTo must be a valid user id" },
      { status: 400 }
    );
  }

  // Verify the target user exists and is active
  const targetUser = await db.user.findUnique({
    where: { id: assignedTo },
    select: { id: true, name: true, active: true, role: true },
  });
  if (!targetUser) {
    return NextResponse.json(
      { error: "Target user not found" },
      { status: 404 }
    );
  }
  if (!targetUser.active) {
    return NextResponse.json(
      { error: `Cannot reassign to inactive user (${targetUser.name})` },
      { status: 400 }
    );
  }

  // De-duplicate enquiry IDs to avoid double-processing
  const uniqueIds = Array.from(new Set(enquiryIds as string[]));

  // Fetch current state of all selected enquiries (for audit + name lookup)
  const existing = await db.enquiry.findMany({
    where: { id: { in: uniqueIds } },
    select: {
      id: true,
      enquiryNumber: true,
      company: true,
      assignedTo: true,
      assignedExecutive: { select: { id: true, name: true } },
    },
  });

  // Detect any IDs that don't exist
  const foundIds = new Set(existing.map((e) => e.id));
  const missing = uniqueIds.filter((id) => !foundIds.has(id));

  // Filter to enquiries that actually need a change (skip ones already assigned to target)
  const toUpdate = existing.filter((e) => e.assignedTo !== assignedTo);

  if (toUpdate.length === 0) {
    return NextResponse.json({
      updated: 0,
      skipped: existing.length,
      errors: missing.map((id) => ({ id, error: "Not found" })),
      message: existing.length > 0
        ? "All selected enquiries are already assigned to this executive"
        : "No enquiries to reassign",
      targetUser: { id: targetUser.id, name: targetUser.name },
    });
  }

  const targetName = targetUser.name;

  // Run all updates in a single transaction so the operation is atomic.
  // If any single update fails, the entire reassign is rolled back.
  try {
    await db.$transaction(
      toUpdate.map((e) =>
        db.enquiry.update({
          where: { id: e.id },
          data: { assignedTo },
        })
      )
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Bulk reassign failed" },
      { status: 500 }
    );
  }

  // After the transaction commits successfully, write audit logs in parallel.
  // Per task spec: action="TRANSFER", entity="Enquiry", per-row audit entries.
  // We don't fail the request if an audit log write fails — the data mutation
  // already succeeded, and the audit trail is best-effort.
  const auditResults = await Promise.allSettled(
    toUpdate.map((e) =>
      logAudit({
        userId: user.id,
        userName: user.name,
        action: "TRANSFER",
        entity: "Enquiry",
        entityId: e.id,
        description: `Bulk reassigned enquiry ${e.enquiryNumber} (${e.company}) from ${e.assignedExecutive?.name || "Unassigned"} to ${targetName}`,
        previousValue: {
          assignedTo: e.assignedTo,
          assignedToName: e.assignedExecutive?.name || "Unassigned",
        },
        newValue: { assignedTo, assignedToName: targetName },
      })
    )
  );
  const auditFailures = auditResults.filter((r) => r.status === "rejected").length;

  const errors = missing.map((id) => ({ id, error: "Not found" }));

  return NextResponse.json({
    updated: toUpdate.length,
    skipped: existing.length - toUpdate.length,
    errors,
    targetUser: { id: targetUser.id, name: targetUser.name },
    auditFailures: auditFailures > 0 ? auditFailures : undefined,
  });
}
