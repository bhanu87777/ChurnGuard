import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { audit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/tags/:id — rename / recolor.
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireRole("ANALYST");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: { name?: string; color?: string } = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name || name.length > 40) {
      return NextResponse.json({ error: "invalid name" }, { status: 400 });
    }
    data.name = name;
  }
  if (body.color !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(String(body.color))) {
      return NextResponse.json({ error: "invalid color" }, { status: 400 });
    }
    data.color = String(body.color);
  }

  const tag = await prisma.tag
    .update({ where: { id }, data })
    .catch(() => null);
  if (!tag) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await audit(auth.user, "tag.update", { type: "Tag", id });
  return NextResponse.json(tag);
}

// DELETE /api/tags/:id — remove the tag everywhere (join rows cascade).
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireRole("ANALYST");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const tag = await prisma.tag.delete({ where: { id } }).catch(() => null);
  if (!tag) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await audit(auth.user, "tag.delete", { type: "Tag", id }, { name: tag.name });
  return NextResponse.json({ ok: true });
}
