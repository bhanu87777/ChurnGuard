import { PrismaClient, Plan, ActivityType, Prisma } from "@prisma/client";
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
  // Approximate current risk (0-100) used only to synthesize a believable
  // 6-week history trend so the trend chart looks alive on first load.
  targetRisk: number;
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

  return specs;
}

async function main() {
  console.log("Seeding ChurnGuard…");

  // Demo login.
  const passwordHash = await bcrypt.hash("demo1234", 10);
  await prisma.user.upsert({
    where: { email: "demo@churnguard.app" },
    update: {},
    create: {
      email: "demo@churnguard.app",
      name: "Demo Operator",
      password: passwordHash,
    },
  });

  // Wipe existing demo customers so re-seeding is idempotent.
  await prisma.riskScore.deleteMany();
  await prisma.activityEvent.deleteMany();
  await prisma.customer.deleteMany();

  for (const spec of makeCustomers()) {
    await prisma.customer.create({
      data: {
        name: spec.name,
        email: spec.email,
        company: spec.company,
        plan: spec.plan,
        mrr: spec.mrr,
        signupDate: daysAgo(spec.signupDaysAgo),
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
      },
    });
  }

  const count = await prisma.customer.count();
  console.log(`Seeded ${count} customers.`);
  console.log("Login: demo@churnguard.app / demo1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
