import { PrismaClient } from "@prisma/client";
import { scoreAndSave } from "../src/lib/score-service";

// CLI: score every customer once (persists current score + a history snapshot).
// Handy right after seeding so the dashboard + trend chart have today's data.
// Run with: npm run db:score
const prisma = new PrismaClient();

async function main() {
  const customers = await prisma.customer.findMany({ select: { id: true, name: true } });
  console.log(`Scoring ${customers.length} customers…`);

  for (const c of customers) {
    const risk = await scoreAndSave(c.id);
    if (risk) {
      console.log(
        `  ${c.name.padEnd(16)} → ${risk.band} (${risk.score}) [${risk.model}]`,
      );
    }
  }
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
