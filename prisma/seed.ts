import {
  PrismaClient,
  Plan,
  ActivityType,
  Prisma,
  Role,
  CustomerStatus,
  RuleConditionType,
  TaskStatus,
  TaskOutcome,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DAY = 1000 * 60 * 60 * 24;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

type EventSpec = {
  type: ActivityType;
  daysAgo: number;
  metadata?: Prisma.InputJsonValue;
};

interface CustomerSpec {
  name: string;
  email: string;
  company: string;
  plan: Plan;
  mrr: number;
  signupDaysAgo: number;
  status?: CustomerStatus;
  churnedDaysAgo?: number;
  // Approximate current risk (0-100) used only to synthesize a believable
  // 6-week history trend so the trend chart looks alive on first load.
  targetRisk: number;
  tags?: string[];
  events: EventSpec[];
}

function bandFor(score: number) {
  if (score >= 66) return "HIGH" as const;
  if (score >= 33) return "MEDIUM" as const;
  return "LOW" as const;
}

// 6 weekly snapshots drifting from a starting point toward the target risk.
function historyPoints(target: number) {
  const start = Math.max(3, target - 40);
  return Array.from({ length: 6 }, (_, i) => {
    const t = i / 5;
    const score = Math.round(start + (target - start) * t);
    // Weeks 6→1 ago; today's point comes from the real scorer (db:score).
    return {
      score,
      band: bandFor(score),
      createdAt: daysAgo((6 - i) * 7),
    };
  });
}

// Build a spread of customers: some healthy, some drifting, some clearly at risk.
function makeCustomers(): CustomerSpec[] {
  const specs: CustomerSpec[] = [];

  // Healthy, high-value account.
  specs.push({
    name: "Aarti Nair",
    email: "aarti@brightloop.io",
    company: "BrightLoop",
    plan: Plan.ENTERPRISE,
    mrr: 1200,
    signupDaysAgo: 400,
    targetRisk: 8,
    tags: ["VIP"],
    events: [
      ...Array.from({ length: 20 }, (_, i) => ({
        type: ActivityType.LOGIN,
        daysAgo: i,
      })),
      ...Array.from({ length: 12 }, (_, i) => ({
        type: ActivityType.FEATURE_USE,
        daysAgo: i * 2,
        metadata: { feature: "reports" },
      })),
      { type: ActivityType.PAYMENT, daysAgo: 5, metadata: { amount: 1200 } },
      { type: ActivityType.NPS_RESPONSE, daysAgo: 10, metadata: { score: 9 } },
    ],
  });

  // Silent drifter: was active, now gone quiet (classic churn signal).
  specs.push({
    name: "Tom Becker",
    email: "tom@nordwave.co",
    company: "Nordwave",
    plan: Plan.PRO,
    mrr: 400,
    signupDaysAgo: 220,
    targetRisk: 77,
    tags: ["At-Risk Watch"],
    events: [
      ...Array.from({ length: 8 }, (_, i) => ({
        type: ActivityType.LOGIN,
        daysAgo: 45 + i * 3,
      })),
      { type: ActivityType.FEATURE_USE, daysAgo: 48, metadata: { feature: "api" } },
      { type: ActivityType.PAYMENT, daysAgo: 12, metadata: { amount: 400 } },
      { type: ActivityType.NPS_RESPONSE, daysAgo: 60, metadata: { score: 6 } },
    ],
  });

  // Billing trouble + frustration.
  specs.push({
    name: "Priya Shah",
    email: "priya@quantscale.ai",
    company: "QuantScale",
    plan: Plan.PRO,
    mrr: 600,
    signupDaysAgo: 150,
    targetRisk: 95,
    tags: ["At-Risk Watch"],
    events: [
      { type: ActivityType.LOGIN, daysAgo: 20 },
      { type: ActivityType.LOGIN, daysAgo: 28 },
      { type: ActivityType.PAYMENT_FAILED, daysAgo: 8, metadata: { amount: 600 } },
      { type: ActivityType.PAYMENT_FAILED, daysAgo: 3, metadata: { amount: 600 } },
      {
        type: ActivityType.SUPPORT_TICKET,
        daysAgo: 5,
        metadata: { priority: "high", topic: "billing" },
      },
      {
        type: ActivityType.SUPPORT_TICKET,
        daysAgo: 2,
        metadata: { priority: "high", topic: "billing" },
      },
      { type: ActivityType.NPS_RESPONSE, daysAgo: 4, metadata: { score: 3 } },
    ],
  });

  // Brand new, engaged trial — low risk despite short history.
  specs.push({
    name: "Diego Alvarez",
    email: "diego@fern.studio",
    company: "Fern Studio",
    plan: Plan.STARTER,
    mrr: 49,
    signupDaysAgo: 12,
    targetRisk: 6,
    tags: ["Onboarding"],
    events: [
      ...Array.from({ length: 6 }, (_, i) => ({
        type: ActivityType.LOGIN,
        daysAgo: i,
      })),
      { type: ActivityType.FEATURE_USE, daysAgo: 1, metadata: { feature: "onboarding" } },
      { type: ActivityType.FEATURE_USE, daysAgo: 2, metadata: { feature: "reports" } },
    ],
  });

  // Free plan, ghosted after signup.
  specs.push({
    name: "Lena Fischer",
    email: "lena@mistgrid.dev",
    company: "MistGrid",
    plan: Plan.FREE,
    mrr: 0,
    signupDaysAgo: 90,
    targetRisk: 62,
    events: [{ type: ActivityType.LOGIN, daysAgo: 89 }],
  });

  // Steady mid-market, mild dip.
  specs.push({
    name: "Kwame Mensah",
    email: "kwame@harborstack.com",
    company: "HarborStack",
    plan: Plan.PRO,
    mrr: 350,
    signupDaysAgo: 310,
    targetRisk: 15,
    events: [
      ...Array.from({ length: 5 }, (_, i) => ({
        type: ActivityType.LOGIN,
        daysAgo: 10 + i * 4,
      })),
      { type: ActivityType.FEATURE_USE, daysAgo: 11, metadata: { feature: "exports" } },
      { type: ActivityType.PAYMENT, daysAgo: 9, metadata: { amount: 350 } },
      { type: ActivityType.SUPPORT_TICKET, daysAgo: 15, metadata: { priority: "low" } },
      { type: ActivityType.NPS_RESPONSE, daysAgo: 30, metadata: { score: 8 } },
    ],
  });

  // High value going dark — the scary one.
  specs.push({
    name: "Sofia Rossi",
    email: "sofia@vantatech.com",
    company: "Vanta Tech",
    plan: Plan.ENTERPRISE,
    mrr: 2000,
    signupDaysAgo: 500,
    targetRisk: 78,
    tags: ["VIP", "At-Risk Watch"],
    events: [
      { type: ActivityType.LOGIN, daysAgo: 41 },
      { type: ActivityType.PAYMENT, daysAgo: 20, metadata: { amount: 2000 } },
      {
        type: ActivityType.SUPPORT_TICKET,
        daysAgo: 38,
        metadata: { priority: "high", topic: "integration" },
      },
      { type: ActivityType.NPS_RESPONSE, daysAgo: 40, metadata: { score: 5 } },
    ],
  });

  // Healthy starter.
  specs.push({
    name: "Ravi Kumar",
    email: "ravi@pixelforge.in",
    company: "PixelForge",
    plan: Plan.STARTER,
    mrr: 49,
    signupDaysAgo: 75,
    targetRisk: 5,
    events: [
      ...Array.from({ length: 10 }, (_, i) => ({
        type: ActivityType.LOGIN,
        daysAgo: i * 2,
      })),
      { type: ActivityType.FEATURE_USE, daysAgo: 3, metadata: { feature: "reports" } },
      { type: ActivityType.PAYMENT, daysAgo: 7, metadata: { amount: 49 } },
    ],
  });

  // Already churned — gives churn-rate & cohort analytics real data points.
  specs.push({
    name: "Mia Chen",
    email: "mia@driftlabs.co",
    company: "Drift Labs",
    plan: Plan.STARTER,
    mrr: 0,
    signupDaysAgo: 260,
    status: CustomerStatus.CHURNED,
    churnedDaysAgo: 45,
    targetRisk: 92,
    events: [
      ...Array.from({ length: 4 }, (_, i) => ({
        type: ActivityType.LOGIN,
        daysAgo: 120 + i * 10,
      })),
      { type: ActivityType.PAYMENT_FAILED, daysAgo: 70, metadata: { amount: 49 } },
      { type: ActivityType.NPS_RESPONSE, daysAgo: 80, metadata: { score: 2 } },
    ],
  });

  specs.push({
    name: "Oliver Grant",
    email: "oliver@peakmetrics.io",
    company: "Peak Metrics",
    plan: Plan.PRO,
    mrr: 0,
    signupDaysAgo: 380,
    status: CustomerStatus.CHURNED,
    churnedDaysAgo: 100,
    targetRisk: 88,
    events: [
      ...Array.from({ length: 6 }, (_, i) => ({
        type: ActivityType.LOGIN,
        daysAgo: 160 + i * 8,
      })),
      {
        type: ActivityType.SUPPORT_TICKET,
        daysAgo: 130,
        metadata: { priority: "high", topic: "pricing" },
      },
      { type: ActivityType.NPS_RESPONSE, daysAgo: 140, metadata: { score: 4 } },
    ],
  });

  return specs;
}

async function seedUser(
  email: string,
  name: string,
  role: Role,
  passwordHash: string,
) {
  return prisma.user.upsert({
    where: { email },
    update: { role, isActive: true },
    create: { email, name, password: passwordHash, role },
  });
}

async function main() {
  console.log("Seeding ChurnGuard…");

  // Demo logins — one per role.
  const passwordHash = await bcrypt.hash("demo1234", 10);
  const demo = await seedUser(
    "demo@churnguard.app",
    "Demo Operator",
    Role.ADMIN,
    passwordHash,
  );
  await seedUser(
    "analyst@churnguard.app",
    "Demo Analyst",
    Role.ANALYST,
    passwordHash,
  );
  await seedUser(
    "viewer@churnguard.app",
    "Demo Viewer",
    Role.VIEWER,
    passwordHash,
  );

  // Wipe existing demo data so re-seeding is idempotent (FK-safe order).
  // AppSetting is intentionally kept — operator-tuned scoring weights survive re-seeds.
  await prisma.notification.deleteMany();
  await prisma.task.deleteMany();
  await prisma.note.deleteMany();
  await prisma.customerTag.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.segment.deleteMany();
  await prisma.alertRule.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.riskScoreHistory.deleteMany();
  await prisma.riskScore.deleteMany();
  await prisma.activityEvent.deleteMany();
  await prisma.customer.deleteMany();

  const tags = await Promise.all(
    [
      { name: "VIP", color: "#a855f7" },
      { name: "Onboarding", color: "#38bdf8" },
      { name: "At-Risk Watch", color: "#f59e0b" },
    ].map((t) => prisma.tag.create({ data: t })),
  );
  const tagIdByName = new Map(tags.map((t) => [t.name, t.id]));

  const customersByEmail = new Map<string, string>();
  for (const spec of makeCustomers()) {
    const customer = await prisma.customer.create({
      data: {
        name: spec.name,
        email: spec.email,
        company: spec.company,
        plan: spec.plan,
        mrr: spec.mrr,
        signupDate: daysAgo(spec.signupDaysAgo),
        status: spec.status ?? CustomerStatus.ACTIVE,
        churnedAt:
          spec.churnedDaysAgo !== undefined ? daysAgo(spec.churnedDaysAgo) : null,
        events: {
          create: spec.events.map((e) => ({
            type: e.type,
            occurredAt: daysAgo(e.daysAgo),
            metadata: e.metadata ?? undefined,
          })),
        },
        riskHistory: {
          create: historyPoints(spec.targetRisk),
        },
        tags: {
          create: (spec.tags ?? [])
            .map((name) => tagIdByName.get(name))
            .filter((id): id is string => Boolean(id))
            .map((tagId) => ({ tagId })),
        },
      },
    });
    customersByEmail.set(spec.email, customer.id);
  }

  // Context on the risky accounts, so notes & interventions demo well.
  const priyaId = customersByEmail.get("priya@quantscale.ai")!;
  const sofiaId = customersByEmail.get("sofia@vantatech.com")!;
  await prisma.note.createMany({
    data: [
      {
        customerId: priyaId,
        authorId: demo.id,
        body: "Card on file expired — billing has already emailed twice. Waiting on their finance team.",
        createdAt: daysAgo(2),
      },
      {
        customerId: sofiaId,
        authorId: demo.id,
        body: "Champion (Marco) left the company in May. New stakeholder hasn't been onboarded yet.",
        createdAt: daysAgo(10),
      },
    ],
  });
  await prisma.task.createMany({
    data: [
      {
        customerId: priyaId,
        title: "Call finance contact about failed payments",
        status: TaskStatus.OPEN,
        outcome: TaskOutcome.PENDING,
        dueDate: daysAgo(-2),
        assigneeId: demo.id,
        createdById: demo.id,
      },
      {
        customerId: sofiaId,
        title: "Schedule exec check-in with new stakeholder",
        status: TaskStatus.OPEN,
        outcome: TaskOutcome.PENDING,
        dueDate: daysAgo(-5),
        assigneeId: demo.id,
        createdById: demo.id,
      },
    ],
  });

  // Two starter alert rules so the notification bell has something to catch.
  await prisma.alertRule.createMany({
    data: [
      {
        name: "Payment failed",
        conditionType: RuleConditionType.EVENT_OCCURS,
        params: { eventType: "PAYMENT_FAILED" },
        notifyInApp: true,
        createdById: demo.id,
      },
      {
        name: "Account became high risk",
        conditionType: RuleConditionType.BAND_BECOMES,
        params: { band: "HIGH" },
        notifyInApp: true,
        createdById: demo.id,
      },
    ],
  });

  const count = await prisma.customer.count();
  console.log(`Seeded ${count} customers, 3 users, 3 tags, 2 alert rules.`);
  console.log("Logins (password demo1234):");
  console.log("  admin:   demo@churnguard.app");
  console.log("  analyst: analyst@churnguard.app");
  console.log("  viewer:  viewer@churnguard.app");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
