import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { audit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

// DELETE /api/keys/:id — soft revoke; the row stays for the audit trail.
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const key = await prisma.apiKey
    .update({ where: { id }, data: { revokedAt: new Date() } })
    .catch(() => null);
  if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await audit(auth.user, "apikey.revoke", { type: "ApiKey", id }, {
    label: key.label,
  });
  return NextResponse.json({ ok: true });
}
