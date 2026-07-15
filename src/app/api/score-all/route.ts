import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { scoreAndSave } from "@/lib/score-service";

// POST /api/score-all — recompute risk for every active customer.
export async function POST() {
  const auth = await requireRole("ANALYST");
  if (!auth.ok) return auth.response;

  const customers = await prisma.customer.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });

  let scored = 0;
  for (const { id } of customers) {
    await scoreAndSave(id);
    scored++;
  }

  await audit(auth.user, "customer.score_all", undefined, { scored });
  return NextResponse.json({ scored });
}
