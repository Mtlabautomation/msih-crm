import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";

// GET /api/tasks/[id] — task with relations
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const task = await db.task.findUnique({
    where: { id },
    include: {
      assignee: { select: { id: true, name: true, role: true, email: true } },
      creator: { select: { id: true, name: true } },
      enquiry: { select: { id: true, enquiryNumber: true, company: true, status: true } },
    },
  });

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // RBAC: EXECUTIVE can only view tasks assigned to or created by them
  if (user.role === "EXECUTIVE" && task.assigneeId !== user.id && task.createdBy !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ task });
}

// PATCH /api/tasks/[id] — update fields (title, description, status, dueDate, priority)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const body = await req.json();
    const existing = await db.task.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // RBAC: EXECUTIVE can update only tasks assigned to them (and only status, not reassign)
    if (user.role === "EXECUTIVE") {
      if (existing.assigneeId !== user.id && existing.createdBy !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // Executive cannot change assigneeId or priority
      if (body.assigneeId && body.assigneeId !== existing.assigneeId) {
        return NextResponse.json({ error: "Only managers/admins can reassign tasks" }, { status: 403 });
      }
    }

    const changes: Record<string, { from: any; to: any }> = {};
    for (const key of ["title", "description", "status", "priority", "assigneeId"]) {
      if (body[key] !== undefined && JSON.stringify(body[key]) !== JSON.stringify((existing as any)[key])) {
        changes[key] = { from: (existing as any)[key], to: body[key] };
      }
    }
    if (body.dueDate !== undefined) {
      const newDue = body.dueDate ? new Date(body.dueDate).toISOString() : null;
      const oldDue = existing.dueDate ? existing.dueDate.toISOString() : null;
      if (newDue !== oldDue) changes.dueDate = { from: existing.dueDate, to: body.dueDate };
    }

    const task = await db.task.update({
      where: { id },
      data: {
        title: body.title ?? undefined,
        description: body.description ?? undefined,
        status: body.status ?? undefined,
        priority: body.priority ?? undefined,
        assigneeId: body.assigneeId ?? undefined,
        dueDate: body.dueDate !== undefined ? (body.dueDate ? new Date(body.dueDate) : null) : undefined,
        completedAt: body.status === "DONE" && !existing.completedAt ? new Date() : body.status && body.status !== "DONE" ? null : undefined,
      },
      include: {
        assignee: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
        enquiry: { select: { id: true, enquiryNumber: true, company: true } },
      },
    });

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "UPDATE",
      entity: "TASK",
      entityId: id,
      description: `Updated task "${existing.title}"${Object.keys(changes).length ? ` — changed: ${Object.keys(changes).join(", ")}` : ""}`,
      previousValue: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.from])),
      newValue: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.to])),
    });

    return NextResponse.json({ task });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

// DELETE /api/tasks/[id] — delete task (creator or ADMIN)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const existing = await db.task.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    if (!isAdmin && existing.createdBy !== user.id) {
      return NextResponse.json({ error: "Forbidden — only the creator or Admin can delete" }, { status: 403 });
    }

    await db.task.delete({ where: { id } });
    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "DELETE",
      entity: "TASK",
      entityId: id,
      description: `Deleted task "${existing.title}"`,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
