import { NextResponse } from "next/server";
import { sendWeeklyDigest } from "@/lib/digest";

// GET /api/cron/digest — Monday-morning weekly digest (Vercel Cron).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendWeeklyDigest();
  return NextResponse.json(result);
}
