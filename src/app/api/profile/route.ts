import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { audit } from "@/lib/audit";

// PATCH /api/profile — update own name and/or change own password.
export async function PATCH(req: Request) {
  const auth = await requireRole("VIEWER");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const data: { name?: string | null; password?: string } = {};
  const changed: string[] = [];

  if (body.name !== undefined) {
    data.name = body.name ? String(body.name) : null;
    changed.push("name");
  }

  if (body.newPassword !== undefined) {
    if (String(body.newPassword).length < 6) {
      return NextResponse.json(
        { error: "new password must be at least 6 characters" },
        { status: 400 },
      );
    }
    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const valid = await bcrypt.compare(
      String(body.currentPassword ?? ""),
      user.password,
    );
    if (!valid) {
      return NextResponse.json(
        { error: "current password is incorrect" },
        { status: 400 },
      );
    }
    data.password = await bcrypt.hash(String(body.newPassword), 10);
    changed.push("password");
  }

  if (changed.length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: auth.user.id },
    data,
    select: { id: true, email: true, name: true, role: true },
  });

  await audit(auth.user, "profile.update", { type: "User", id: auth.user.id }, {
    changed,
  });
  return NextResponse.json(user);
}
