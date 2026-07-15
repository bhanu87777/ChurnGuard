import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// POST /api/register — bootstrap-only. The very first account becomes ADMIN;
// after that, new operators are invited by an admin via /settings/team.
export async function POST(req: Request) {
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

  const userCount = await prisma.user.count();
  if (userCount > 0) {
    return NextResponse.json(
      { error: "registration is invite-only — ask an admin to add you" },
      { status: 403 },
    );
  }

  const passwordHash = await bcrypt.hash(String(body.password), 10);
  const user = await prisma.user.create({
    data: {
      email: String(body.email),
      name: body.name ? String(body.name) : null,
      password: passwordHash,
      role: "ADMIN",
    },
  });
  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}
