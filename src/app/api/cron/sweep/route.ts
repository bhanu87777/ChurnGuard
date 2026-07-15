import { NextResponse } from "next/server";
import { runInactivitySweep } from "@/lib/rules";

// GET /api/cron/sweep — daily inactivity-rule evaluation (Vercel Cron).
// Vercel sends "Authorization: Bearer <CRON_SECRET>" automatically when the
// env var is set.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runInactivitySweep();
  return NextResponse.json(result);
}
