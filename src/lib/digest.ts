import { prisma } from "./prisma";
import { notifyAllUsers } from "./notifications";
import {
  digestEmailHtml,
  emailEnabled,
  sendEmail,
  type WeeklyDigestData,
} from "./email";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const BAND_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const;

export async function buildWeeklyDigest(): Promise<WeeklyDigestData> {
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - WEEK_MS);

  // Band movement inside the window: earliest vs latest history snapshot per
  // customer. Also identifies accounts that newly entered HIGH.
  const history = await prisma.riskScoreHistory.findMany({
    where: { createdAt: { gte: windowStart } },
    orderBy: { createdAt: "asc" },
    include: { customer: { select: { id: true, name: true, mrr: true, status: true } } },
  });

  const perCustomer = new Map<
    string,
    { first: (typeof history)[number]; last: (typeof history)[number] }
  >();
  for (const h of history) {
    const entry = perCustomer.get(h.customerId);
    if (!entry) perCustomer.set(h.customerId, { first: h, last: h });
    else entry.last = h;
  }

  let improved = 0;
  let worsened = 0;
  const newHighRisk: WeeklyDigestData["newHighRisk"] = [];
  for (const { first, last } of perCustomer.values()) {
    if (first.id === last.id) continue;
    const delta = BAND_RANK[last.band] - BAND_RANK[first.band];
    if (delta < 0) improved++;
    if (delta > 0) worsened++;
    if (last.band === "HIGH" && first.band !== "HIGH") {
      newHighRisk.push({
        id: last.customer.id,
        name: last.customer.name,
        score: last.score,
        mrr: last.customer.mrr,
      });
    }
  }
  newHighRisk.sort((a, b) => b.mrr - a.mrr);

  const [mrrAtRiskAgg, openTasksOverdue, alertsFiredRows] = await Promise.all([
    prisma.customer.aggregate({
      _sum: { mrr: true },
      where: { status: "ACTIVE", riskScore: { band: "HIGH" } },
    }),
    prisma.task.count({
      where: { status: "OPEN", dueDate: { lt: windowEnd } },
    }),
    prisma.notification.findMany({
      where: { type: "ALERT", createdAt: { gte: windowStart }, ruleId: { not: null } },
      distinct: ["ruleId", "customerId"],
      select: { id: true },
    }),
  ]);

  return {
    windowStart,
    windowEnd,
    newHighRisk: newHighRisk.slice(0, 10),
    improved,
    worsened,
    mrrAtRisk: mrrAtRiskAgg._sum.mrr ?? 0,
    openTasksOverdue,
    alertsFired: alertsFiredRows.length,
  };
}

// Sends the digest by email (when configured) and always as an in-app
// notification, so the feature works without a Resend key.
export async function sendWeeklyDigest(): Promise<{
  sent: boolean;
  recipients: number;
}> {
  const data = await buildWeeklyDigest();

  const inAppBody =
    `MRR at risk: $${Math.round(data.mrrAtRisk)} · ` +
    `${data.newHighRisk.length} newly high-risk · ` +
    `${data.improved} improved / ${data.worsened} worsened · ` +
    `${data.openTasksOverdue} overdue interventions.`;
  const recipients = await notifyAllUsers({
    title: "Your weekly churn digest",
    body: inAppBody,
    type: "DIGEST",
  });

  let sent = false;
  if (emailEnabled()) {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { email: true },
    });
    sent = await sendEmail({
      to: users.map((u) => u.email),
      subject: "⚡ ChurnGuard — your weekly churn digest",
      html: digestEmailHtml(data),
    });
  }
  return { sent, recipients };
}
