import { prisma } from "./prisma";
import { scoreCustomer } from "./scoring";
import { getScoringWeights } from "./settings";
import { evaluateRulesOnScore } from "./rules";

// Score a single customer and persist both the current RiskScore (upsert) and a
// RiskScoreHistory snapshot (append) so we can chart risk over time.
export async function scoreAndSave(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { events: true, riskScore: true },
  });
  if (!customer) return null;

  // Previous verdict, captured before the upsert — alert rules fire on
  // transitions (band changes, threshold crossings), not levels.
  const prev = customer.riskScore
    ? { score: customer.riskScore.score, band: customer.riskScore.band }
    : null;

  const weights = await getScoringWeights();
  const result = await scoreCustomer(customer, weights);

  const [risk] = await prisma.$transaction([
    prisma.riskScore.upsert({
      where: { customerId },
      update: {
        score: result.score,
        band: result.band,
        reason: result.reason,
        action: result.action,
        model: result.model,
      },
      create: {
        customerId,
        score: result.score,
        band: result.band,
        reason: result.reason,
        action: result.action,
        model: result.model,
      },
    }),
    prisma.riskScoreHistory.create({
      data: { customerId, score: result.score, band: result.band },
    }),
  ]);

  // Alert evaluation is best-effort: a rule/notification failure must never
  // fail the scoring request itself.
  await evaluateRulesOnScore({
    customer,
    prev,
    next: { score: result.score, band: result.band },
  }).catch((err) => console.error("rule evaluation failed:", err));

  return risk;
}
