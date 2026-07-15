import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

// GET /api/customers/:id/notes — newest first, with author names.
export async function GET(_req: Request, { params }: Params) {
  const auth = await requireRole("VIEWER");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const notes = await prisma.note.findMany({
    where: { customerId: id },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json(notes);
}

// POST /api/customers/:id/notes — add a note.
export async function POST(req: Request, { params }: Params) {
  const auth = await requireRole("ANALYST");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const text = String(body?.body ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const note = await prisma.note.create({
    data: { customerId: id, authorId: auth.user.id, body: text },
    include: { author: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json(note, { status: 201 });
}
