import type {
  ActivityEvent,
  AlertRule,
  Customer,
  RiskBand,
} from "@prisma/client";
import { ActivityType, Prisma, RuleConditionType } from "@prisma/client";
import { prisma } from "./prisma";
import { notifyAllUsers } from "./notifications";
import { alertEmailHtml, emailEnabled, sendEmail } from "./email";

// Rule condition semantics (all conditions also accept an optional minMrr filter):
//   BAND_BECOMES    { band }                  new band === band && prev band !== band
//   SCORE_CROSSES   { threshold, direction }  score crosses the threshold between prev and next
//   MRR_AT_LEAST    { minMrr }                band newly enters MEDIUM/HIGH for a customer worth >= minMrr
//   EVENT_OCCURS    { eventType }             an event of that type is ingested
//   INACTIVITY_DAYS { days }                  ACTIVE customer with no LOGIN within N days (daily sweep)

const BAND_RANK: Record<RiskBand, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

type RuleParams = {
  band?: RiskBand;
  threshold?: number;
  direction?: "ABOVE" | "BELOW";
  eventType?: ActivityType;
  days?: number;
  minMrr?: number;
};

// Validate params for a rule at write time. Throws Error with a user-facing
// message on bad shape.
export function validateRuleParams(
  type: RuleConditionType,
  raw: unknown,
): Prisma.InputJsonValue {
  const p = (raw ?? {}) as RuleParams;
  const out: RuleParams = {};

  if (p.minMrr !== undefined) {
    const v = Number(p.minMrr);
    if (!Number.isFinite(v) || v < 0) throw new Error("minMrr must be a non-negative number");
    out.minMrr = v;
  }

  switch (type) {
    case "BAND_BECOMES":
      if (!p.band || !["LOW", "MEDIUM", "HIGH"].includes(p.band))
        throw new Error("band must be LOW, MEDIUM, or HIGH");
      out.band = p.band;
      break;
    case "SCORE_CROSSES": {
      const t = Number(p.threshold);
      if (!Number.isFinite(t) || t < 0 || t > 100)
        throw new Error("threshold must be between 0 and 100");
      if (p.direction !== "ABOVE" && p.direction !== "BELOW")
        throw new Error("direction must be ABOVE or BELOW");
      out.threshold = t;
      out.direction = p.direction;
      break;
    }
    case "MRR_AT_LEAST": {
      const v = Number(p.minMrr);
      if (!Number.isFinite(v) || v <= 0)
        throw new Error("minMrr must be a positive number");
      out.minMrr = v;
      break;
    }
    case "EVENT_OCCURS":
      if (!p.eventType || !Object.values(ActivityType).includes(p.eventType))
        throw new Error(
          `eventType must be one of: ${Object.values(ActivityType).join(", ")}`,
        );
      out.eventType = p.eventType;
      break;
    case "INACTIVITY_DAYS": {
      const d = Number(p.days);
      if (!Number.isInteger(d) || d < 1 || d > 365)
        throw new Error("days must be an integer between 1 and 365");
      out.days = d;
      break;
    }
  }
  return out as Prisma.InputJsonValue;
}

async function fireRule(
  rule: AlertRule,
  customer: Customer,
  detail: string,
): Promise<boolean> {
  try {
    // Cooldown: don't re-alert about the same (rule, customer) inside the window.
    const since = new Date(Date.now() - rule.cooldownHours * 60 * 60 * 1000);
    const recent = await prisma.notification.findFirst({
      where: {
        ruleId: rule.id,
        customerId: customer.id,
        createdAt: { gte: since },
      },
      select: { id: true },
    });
    if (recent) return false;

    if (rule.notifyInApp) {
      await notifyAllUsers({
        title: rule.name,
        body: detail,
        type: "ALERT",
        ruleId: rule.id,
        customerId: customer.id,
      });
    }

    if (rule.notifyEmail && emailEnabled()) {
      const users = await prisma.user.findMany({
        where: { isActive: true },
        select: { email: true },
      });
      await sendEmail({
        to: users.map((u) => u.email),
        subject: `⚠️ ${rule.name} — ${customer.name}`,
        html: alertEmailHtml(rule, customer, detail),
      });
    }
    return true;
  } catch (err) {
    console.error(`alert rule "${rule.name}" failed to fire:`, err);
    return false;
  }
}

function passesMrrFilter(rule: AlertRule, customer: Customer): boolean {
  const p = (rule.params ?? {}) as RuleParams;
  return p.minMrr === undefined || customer.mrr >= p.minMrr;
}

// Called after every (re)score with the previous and new verdicts.
export async function evaluateRulesOnScore(input: {
  customer: Customer;
  prev: { score: number; band: RiskBand } | null;
  next: { score: number; band: RiskBand };
}): Promise<void> {
  const { customer, prev, next } = input;
  const rules = await prisma.alertRule.findMany({
    where: {
      enabled: true,
      conditionType: {
        in: ["BAND_BECOMES", "SCORE_CROSSES", "MRR_AT_LEAST"],
      },
    },
  });

  for (const rule of rules) {
    if (!passesMrrFilter(rule, customer)) continue;
    const p = (rule.params ?? {}) as RuleParams;

    let fires = false;
    let detail = "";

    switch (rule.conditionType) {
      case "BAND_BECOMES":
        fires = next.band === p.band && prev?.band !== p.band;
        detail = `${customer.name} moved into the ${next.band} risk band (score ${next.score}/100${prev ? `, was ${prev.band} ${prev.score}` : ""}).`;
        break;
      case "SCORE_CROSSES": {
        const t = p.threshold ?? 0;
        fires =
          p.direction === "ABOVE"
            ? next.score >= t && (prev === null || prev.score < t)
            : next.score <= t && (prev === null || prev.score > t);
        detail = `${customer.name}'s risk score crossed ${p.direction === "ABOVE" ? "above" : "below"} ${t} (now ${next.score}/100).`;
        break;
      }
      case "MRR_AT_LEAST": {
        // Edge-triggered: fires when a high-value account newly leaves LOW.
        const nowAtRisk = BAND_RANK[next.band] >= BAND_RANK.MEDIUM;
        const wasAtRisk = prev !== null && BAND_RANK[prev.band] >= BAND_RANK.MEDIUM;
        fires = customer.mrr >= (p.minMrr ?? 0) && nowAtRisk && !wasAtRisk;
        detail = `High-value account ${customer.name} ($${Math.round(customer.mrr)}/mo) is now ${next.band} risk (score ${next.score}/100).`;
        break;
      }
    }

    if (fires) await fireRule(rule, customer, detail);
  }
}

// Called after an activity event is ingested (in-app form or /api/ingest).
export async function evaluateRulesOnEvent(
  customer: Customer,
  event: ActivityEvent,
): Promise<void> {
  const rules = await prisma.alertRule.findMany({
    where: { enabled: true, conditionType: "EVENT_OCCURS" },
  });

  for (const rule of rules) {
    const p = (rule.params ?? {}) as RuleParams;
    if (p.eventType !== event.type) continue;
    if (!passesMrrFilter(rule, customer)) continue;
    const label = event.type.replaceAll("_", " ").toLowerCase();
    await fireRule(
      rule,
      customer,
      `${customer.name} (${customer.company ?? "n/a"}) had a ${label} event.`,
    );
  }
}

// Daily cron: alert on ACTIVE customers with no LOGIN inside each rule's window.
export async function runInactivitySweep(): Promise<{
  evaluated: number;
  fired: number;
}> {
  const rules = await prisma.alertRule.findMany({
    where: { enabled: true, conditionType: "INACTIVITY_DAYS" },
  });

  let evaluated = 0;
  let fired = 0;
  for (const rule of rules) {
    const p = (rule.params ?? {}) as RuleParams;
    const days = p.days ?? 30;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const customers = await prisma.customer.findMany({
      where: {
        status: "ACTIVE",
        events: { none: { type: "LOGIN", occurredAt: { gte: cutoff } } },
      },
    });

    for (const customer of customers) {
      if (!passesMrrFilter(rule, customer)) continue;
      evaluated++;
      const ok = await fireRule(
        rule,
        customer,
        `${customer.name} has not logged in for over ${days} days.`,
      );
      if (ok) fired++;
    }
  }
  return { evaluated, fired };
}
