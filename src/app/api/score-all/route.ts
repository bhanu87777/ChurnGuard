import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { scoreAndSave } from "@/lib/score-service";

// POST /api/score-all — recompute risk for every active customer.
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const customers = await prisma.customer.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });

  let scored = 0;
  for (const { id } of customers) {
    await scoreAndSave(id);
    scored++;
  }
  return NextResponse.json({ scored });
}
