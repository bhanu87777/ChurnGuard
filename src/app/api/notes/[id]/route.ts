import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/notes/:id — edit own note (admins can edit any).
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireRole("ANALYST");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const note = await prisma.note.findUnique({ where: { id } });
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (note.authorId !== auth.user.id && auth.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Not your note" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const text = String(body?.body ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const updated = await prisma.note.update({
    where: { id },
    data: { body: text },
    include: { author: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json(updated);
}

// DELETE /api/notes/:id — delete own note (admins can delete any).
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireRole("ANALYST");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const note = await prisma.note.findUnique({ where: { id } });
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (note.authorId !== auth.user.id && auth.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Not your note" }, { status: 403 });
  }

  await prisma.note.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
