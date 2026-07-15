import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { generateKey } from "@/lib/api-keys";

// GET /api/keys — list keys (never the secret; prefix only).
export async function GET() {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;

  const keys = await prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      label: true,
      prefix: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
      createdBy: { select: { email: true } },
    },
  });
  return NextResponse.json(keys);
}

// POST /api/keys — create a key. The plaintext is returned ONCE, here.
export async function POST(req: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const label = String(body?.label ?? "").trim();
  if (!label || label.length > 60) {
    return NextResponse.json(
      { error: "label is required (max 60 chars)" },
      { status: 400 },
    );
  }

  const { plaintext, hash, prefix } = generateKey();
  const key = await prisma.apiKey.create({
    data: { label, keyHash: hash, prefix, createdById: auth.user.id },
  });

  await audit(auth.user, "apikey.create", { type: "ApiKey", id: key.id }, {
    label,
  });
  return NextResponse.json(
    { id: key.id, label: key.label, prefix: key.prefix, plaintext },
    { status: 201 },
  );
}
