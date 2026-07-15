import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { audit } from "@/lib/audit";

// GET /api/users — list the team.
export async function GET() {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
  return NextResponse.json(users);
}

// POST /api/users — invite (create) a teammate with a temporary password.
export async function POST(req: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return NextResponse.json(
      { error: "email and password are required" },
      { status: 400 },
    );
  }
  if (String(body.password).length < 6) {
    return NextResponse.json(
      { error: "password must be at least 6 characters" },
      { status: 400 },
    );
  }
  const role: Role = Object.values(Role).includes(body.role)
    ? body.role
    : "ANALYST";

  const existing = await prisma.user.findUnique({
    where: { email: String(body.email) },
  });
  if (existing) {
    return NextResponse.json(
      { error: "an account with that email already exists" },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(String(body.password), 10);
  const user = await prisma.user.create({
    data: {
      email: String(body.email),
      name: body.name ? String(body.name) : null,
      password: passwordHash,
      role,
    },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });

  await audit(auth.user, "user.create", { type: "User", id: user.id }, {
    email: user.email,
    role: user.role,
  });
  return NextResponse.json(user, { status: 201 });
}
