import { NextResponse } from "next/server";
import { TaskOutcome, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/tasks/:id — update status/outcome/title/due date. Completing a
// task records when, and reopening clears outcome + completedAt.
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireRole("ANALYST");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const data: {
    title?: string;
    status?: TaskStatus;
    outcome?: TaskOutcome;
    dueDate?: Date | null;
    completedAt?: Date | null;
  } = {};

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) return NextResponse.json({ error: "invalid title" }, { status: 400 });
    data.title = title;
  }
  if (body.status !== undefined) {
    if (!Object.values(TaskStatus).includes(body.status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    data.status = body.status;
    if (body.status === "DONE") data.completedAt = new Date();
    else {
      data.completedAt = null;
      data.outcome = "PENDING";
    }
  }
  if (body.outcome !== undefined) {
    if (!Object.values(TaskOutcome).includes(body.outcome)) {
      return NextResponse.json({ error: "invalid outcome" }, { status: 400 });
    }
    data.outcome = body.outcome;
  }
  if (body.dueDate !== undefined) {
    data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  }

  const task = await prisma.task
    .update({
      where: { id },
      data,
      include: { assignee: { select: { id: true, name: true, email: true } } },
    })
    .catch(() => null);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(task);
}

// DELETE /api/tasks/:id
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireRole("ANALYST");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const task = await prisma.task.delete({ where: { id } }).catch(() => null);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
