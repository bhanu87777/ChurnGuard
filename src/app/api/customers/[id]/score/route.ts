import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { scoreAndSave } from "@/lib/score-service";

type Params = { params: Promise<{ id: string }> };

// POST /api/customers/:id/score — (re)compute the AI churn-risk score and record
// a history snapshot.
export async function POST(_req: Request, { params }: Params) {
  const auth = await requireRole("ANALYST");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const risk = await scoreAndSave(id);
  if (!risk) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await audit(auth.user, "customer.rescore", { type: "Customer", id }, {
    score: risk.score,
    band: risk.band,
  });
  return NextResponse.json(risk);
}
