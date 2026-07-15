import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { csvResponse, toCsv } from "@/lib/csv";

// GET /api/export/events?customerId=... — activity events as CSV.
export async function GET(req: Request) {
  const auth = await requireRole("ANALYST");
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const customerId = url.searchParams.get("customerId");

  const events = await prisma.activityEvent.findMany({
    where: customerId ? { customerId } : {},
    include: { customer: { select: { email: true, name: true } } },
    orderBy: { occurredAt: "desc" },
    take: 10_000,
  });

  const csv = toCsv(
    ["customerEmail", "customerName", "type", "occurredAt", "metadata"],
    events.map((e) => [
      e.customer.email,
      e.customer.name,
      e.type,
      e.occurredAt,
      e.metadata != null ? JSON.stringify(e.metadata) : null,
    ]),
  );

  const date = new Date().toISOString().slice(0, 10);
  return csvResponse(`churnguard-events-${date}.csv`, csv);
}
