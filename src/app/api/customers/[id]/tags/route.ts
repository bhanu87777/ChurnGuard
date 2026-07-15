import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

// PUT /api/customers/:id/tags — replace the customer's tag set: { tagIds: string[] }.
export async function PUT(req: Request, { params }: Params) {
  const auth = await requireRole("ANALYST");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.tagIds)) {
    return NextResponse.json({ error: "tagIds array required" }, { status: 400 });
  }
  const tagIds: string[] = [...new Set(
    body.tagIds.filter((t: unknown): t is string => typeof t === "string"),
  )] as string[];

  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.customerTag.deleteMany({ where: { customerId: id } }),
    prisma.customerTag.createMany({
      data: tagIds.map((tagId) => ({ customerId: id, tagId })),
      skipDuplicates: true,
    }),
  ]);

  const tags = await prisma.customerTag.findMany({
    where: { customerId: id },
    include: { tag: true },
  });
  return NextResponse.json(tags.map((t) => t.tag));
}
