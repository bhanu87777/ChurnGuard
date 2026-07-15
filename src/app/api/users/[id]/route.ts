import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { audit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

// Would this change leave the team without any active admin?
async function wouldRemoveLastAdmin(
  userId: string,
  next: { role?: Role; isActive?: boolean },
): Promise<boolean> {
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.role !== "ADMIN" || !target.isActive) return false;
  const losesAdmin =
    (next.role !== undefined && next.role !== "ADMIN") ||
    (next.isActive !== undefined && !next.isActive);
  if (!losesAdmin) return false;
  const otherAdmins = await prisma.user.count({
    where: { role: "ADMIN", isActive: true, NOT: { id: userId } },
  });
  return otherAdmins === 0;
}

// PATCH /api/users/:id — update role, name, active flag, or reset password.
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const data: {
    name?: string | null;
    role?: Role;
    isActive?: boolean;
    password?: string;
  } = {};

  if (body.name !== undefined) data.name = body.name ? String(body.name) : null;
  if (body.role !== undefined) {
    if (!Object.values(Role).includes(body.role)) {
      return NextResponse.json({ error: "invalid role" }, { status: 400 });
    }
    data.role = body.role;
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.password !== undefined) {
    if (String(body.password).length < 6) {
      return NextResponse.json(
        { error: "password must be at least 6 characters" },
        { status: 400 },
      );
    }
    data.password = await bcrypt.hash(String(body.password), 10);
  }

  if (await wouldRemoveLastAdmin(id, data)) {
    return NextResponse.json(
      { error: "cannot remove the last active admin" },
      { status: 400 },
    );
  }

  const user = await prisma.user
    .update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, isActive: true },
    })
    .catch(() => null);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await audit(auth.user, "user.update", { type: "User", id }, {
    changed: Object.keys(data).map((k) => (k === "password" ? "password" : k)),
    role: data.role,
    isActive: data.isActive,
  });
  return NextResponse.json(user);
}
