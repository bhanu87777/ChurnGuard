import { RiskBand } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { csvResponse, toCsv } from "@/lib/csv";

// GET /api/export/customers?band=HIGH&q=acme&tag=<tagId> — CSV matching the
// dashboard's current filters.
export async function GET(req: Request) {
  const auth = await requireRole("ANALYST");
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const band = url.searchParams.get("band");
  const q = url.searchParams.get("q");
  const tag = url.searchParams.get("tag");

  const customers = await prisma.customer.findMany({
    where: {
      ...(band && Object.values(RiskBand).includes(band as RiskBand)
        ? { riskScore: { band: band as RiskBand } }
        : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { company: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(tag ? { tags: { some: { tagId: tag } } } : {}),
    },
    include: { riskScore: true, tags: { include: { tag: true } } },
    orderBy: { name: "asc" },
  });

  const csv = toCsv(
    [
      "name",
      "email",
      "company",
      "plan",
      "mrr",
      "status",
      "signupDate",
      "churnedAt",
      "riskScore",
      "riskBand",
      "tags",
    ],
    customers.map((c) => [
      c.name,
      c.email,
      c.company,
      c.plan,
      c.mrr,
      c.status,
      c.signupDate,
      c.churnedAt,
      c.riskScore?.score ?? null,
      c.riskScore?.band ?? null,
      c.tags.map((t) => t.tag.name).join("; "),
    ]),
  );

  const date = new Date().toISOString().slice(0, 10);
  return csvResponse(`churnguard-customers-${date}.csv`, csv);
}
