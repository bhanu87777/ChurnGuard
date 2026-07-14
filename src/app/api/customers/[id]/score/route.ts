import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { scoreAndSave } from "@/lib/score-service";

type Params = { params: Promise<{ id: string }> };

// POST /api/customers/:id/score — (re)compute the AI churn-risk score and record
// a history snapshot.
export async function POST(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const risk = await scoreAndSave(id);
  if (!risk) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(risk);
}
