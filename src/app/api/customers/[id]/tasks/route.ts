import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

// GET /api/customers/:id/tasks — open first, then recently completed.
export async function GET(_req: Request, { params }: Params) {
  const auth = await requireRole("VIEWER");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const tasks = await prisma.task.findMany({
    where: { customerId: id },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { assignee: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json(tasks);
}

// POST /api/customers/:id/tasks — create an intervention task.
export async function POST(req: Request, { params }: Params) {
  const auth = await requireRole("ANALYST");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const title = String(body?.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const task = await prisma.task.create({
    data: {
      customerId: id,
      title,
      description: body.description ? String(body.description) : null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      assigneeId: body.assigneeId ? String(body.assigneeId) : auth.user.id,
      createdById: auth.user.id,
    },
    include: { assignee: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json(task, { status: 201 });
}
