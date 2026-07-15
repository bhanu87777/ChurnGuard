import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { getScoringWeights, saveScoringWeights } from "@/lib/settings";
import { DEFAULT_WEIGHTS } from "@/lib/scoring-weights";

// GET /api/settings/scoring — current heuristic weights (+ defaults for the UI).
export async function GET() {
  const auth = await requireRole("ANALYST");
  if (!auth.ok) return auth.response;

  const weights = await getScoringWeights();
  return NextResponse.json({ weights, defaults: DEFAULT_WEIGHTS });
}

// PUT /api/settings/scoring — replace the heuristic weights (admin only).
export async function PUT(req: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const before = await getScoringWeights();
  const weights = await saveScoringWeights(body, auth.user.id);

  await audit(auth.user, "settings.update", undefined, {
    key: "scoring.weights",
    before,
    after: weights,
  });
  return NextResponse.json({ weights });
}
