import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { audit } from "@/lib/audit";

// GET /api/tags — all tags with usage counts.
export async function GET() {
  const auth = await requireRole("VIEWER");
  if (!auth.ok) return auth.response;

  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { customers: true } } },
  });
  return NextResponse.json(tags);
}

// POST /api/tags — create a tag (idempotent on name).
export async function POST(req: Request) {
  const auth = await requireRole("ANALYST");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (name.length > 40) {
    return NextResponse.json({ error: "name is too long" }, { status: 400 });
  }

  const color =
    typeof body.color === "string" && /^#[0-9a-fA-F]{6}$/.test(body.color)
      ? body.color
      : undefined;

  const tag = await prisma.tag.upsert({
    where: { name },
    update: color ? { color } : {},
    create: { name, ...(color ? { color } : {}) },
  });

  await audit(auth.user, "tag.create", { type: "Tag", id: tag.id }, { name });
  return NextResponse.json(tag, { status: 201 });
}
