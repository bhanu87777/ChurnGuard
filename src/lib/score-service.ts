import { prisma } from "./prisma";
import { scoreCustomer } from "./scoring";

// Score a single customer and persist both the current RiskScore (upsert) and a
// RiskScoreHistory snapshot (append) so we can chart risk over time.
export async function scoreAndSave(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { events: true },
  });
  if (!customer) return null;

  const result = await scoreCustomer(customer);

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

  return risk;
}
