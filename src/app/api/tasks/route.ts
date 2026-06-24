import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { Prisma } from "@prisma/client";

// GET /api/tasks — list tasks
// EXECUTIVE sees tasks assigned to them; MANAGER/ADMIN see all (or filter by ?assignee=)
// ?status=pending|done|overdue supported
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // pending | done | overdue
  const assignee = searchParams.get("assignee");
  const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);
  const now = new Date();

  const where: Prisma.TaskWhereInput = {};
  if (user.role === "EXECUTIVE") where.assigneeId = user.id;
  else if (assignee && assignee !== "all") where.assigneeId = assignee;

  if (status === "done") {
    where.status = "DONE";
  } else if (status === "pending") {
    where.status = { in: ["OPEN", "IN_PROGRESS"] };
  } else if (status === "overdue") {
    where.status = { in: ["OPEN", "IN_PROGRESS"] };
    where.dueDate = { lt: now };
  }

  const tasks = await db.task.findMany({
    where,
    include: {
      assignee: { select: { id: true, name: true, role: true } },
      creator: { select: { id: true, name: true } },
      enquiry: { select: { id: true, enquiryNumber: true, company: true } },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take: limit,
  });

  return NextResponse.json({ tasks, total: tasks.length });
}

// POST /api/tasks — create a task
// Body: { title, description?, enquiryId?, assigneeId, dueDate, priority? }
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { title, description, enquiryId, assigneeId, dueDate, priority } = body;

    if (!title || !assigneeId) {
      return NextResponse.json({ error: "title and assigneeId are required" }, { status: 400 });
    }

    // Validate assignee exists
    const assignee = await db.user.findUnique({ where: { id: assigneeId } });
    if (!assignee) return NextResponse.json({ error: "Assignee not found" }, { status: 404 });

    const task = await db.task.create({
      data: {
        title,
        description: description || null,
        enquiryId: enquiryId || null,
        assigneeId,
        createdBy: user.id,
        priority: priority || "MEDIUM",
        status: "OPEN",
        dueDate: dueDate ? new Date(dueDate) : null,
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
      action: "CREATE",
      entity: "TASK",
      entityId: task.id,
      description: `Created task "${title}" assigned to ${assignee.name}${dueDate ? ` due ${new Date(dueDate).toDateString()}` : ""}`,
      newValue: { title, assigneeId, priority: task.priority, dueDate },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
