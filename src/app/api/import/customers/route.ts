import { NextResponse } from "next/server";
import { CustomerStatus, Plan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { parseCsv } from "@/lib/csv";

const MAX_ROWS = 2000;

// POST /api/import/customers — body is raw CSV text with a header row:
//   name,email,company,plan,mrr[,signupDate][,status]
// Upserts by email. Responds { imported, updated, errors: [{line, message}] }.
export async function POST(req: Request) {
  const auth = await requireRole("ANALYST");
  if (!auth.ok) return auth.response;

  const text = await req.text();
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return NextResponse.json(
      { error: "CSV must have a header row and at least one data row" },
      { status: 400 },
    );
  }
  if (rows.length - 1 > MAX_ROWS) {
    return NextResponse.json(
      { error: `too many rows — max ${MAX_ROWS} per import` },
      { status: 400 },
    );
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  if (col("name") === -1 || col("email") === -1) {
    return NextResponse.json(
      { error: "header must include at least: name,email" },
      { status: 400 },
    );
  }

  let imported = 0;
  let updated = 0;
  const errors: { line: number; message: string }[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const line = i + 1;
    const get = (name: string) => {
      const idx = col(name);
      return idx === -1 ? "" : (row[idx] ?? "").trim();
    };

    const name = get("name");
    const email = get("email");
    if (!name || !email) {
      errors.push({ line, message: "name and email are required" });
      continue;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ line, message: `invalid email "${email}"` });
      continue;
    }

    const planRaw = get("plan").toUpperCase();
    const plan = Object.values(Plan).includes(planRaw as Plan)
      ? (planRaw as Plan)
      : Plan.FREE;
    if (planRaw && plan !== planRaw) {
      errors.push({ line, message: `unknown plan "${planRaw}"` });
      continue;
    }

    const mrrRaw = get("mrr");
    const mrr = mrrRaw === "" ? 0 : Number(mrrRaw);
    if (!Number.isFinite(mrr) || mrr < 0) {
      errors.push({ line, message: `invalid mrr "${mrrRaw}"` });
      continue;
    }

    const signupRaw = get("signupdate");
    const signupDate = signupRaw ? new Date(signupRaw) : undefined;
    if (signupDate && Number.isNaN(signupDate.getTime())) {
      errors.push({ line, message: `invalid signupDate "${signupRaw}"` });
      continue;
    }

    const statusRaw = get("status").toUpperCase();
    const status = statusRaw
      ? Object.values(CustomerStatus).includes(statusRaw as CustomerStatus)
        ? (statusRaw as CustomerStatus)
        : null
      : CustomerStatus.ACTIVE;
    if (status === null) {
      errors.push({ line, message: `invalid status "${statusRaw}"` });
      continue;
    }

    try {
      const existing = await prisma.customer.findUnique({ where: { email } });
      await prisma.customer.upsert({
        where: { email },
        update: {
          name,
          company: get("company") || null,
          plan,
          mrr,
          status,
          ...(status === "CHURNED" && existing?.status === "ACTIVE"
            ? { churnedAt: new Date() }
            : {}),
          ...(status === "ACTIVE" ? { churnedAt: null } : {}),
        },
        create: {
          name,
          email,
          company: get("company") || null,
          plan,
          mrr,
          status,
          ...(signupDate ? { signupDate } : {}),
          ...(status === "CHURNED" ? { churnedAt: new Date() } : {}),
        },
      });
      if (existing) updated++;
      else imported++;
    } catch {
      errors.push({ line, message: "database error for this row" });
    }
  }

  await audit(auth.user, "import.customers", undefined, {
    imported,
    updated,
    errors: errors.length,
  });
  return NextResponse.json({ imported, updated, errors });
}
