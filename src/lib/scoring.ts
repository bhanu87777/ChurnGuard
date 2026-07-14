import Anthropic from "@anthropic-ai/sdk";
import type { ActivityEvent, Customer } from "@prisma/client";

// The Claude model used for scoring. Sonnet gives strong reasoning at low cost;
// override with SCORING_MODEL in .env if you like.
const MODEL = process.env.SCORING_MODEL || "claude-sonnet-5";

// The Gemini model used when GEMINI_API_KEY is set (free tier via Google AI
// Studio). "gemini-flash-latest" tracks the current free flash model.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

export type RiskBand = "LOW" | "MEDIUM" | "HIGH";

export interface RiskResult {
  score: number; // 0 (safe) - 100 (about to churn)
  band: RiskBand;
  reason: string;
  action: string;
  model: string; // "heuristic" or the Claude model id
}

// --- Feature extraction -----------------------------------------------------
// Turn raw activity events into the handful of signals that actually predict
// churn. This is the "explainable" part an interviewer will ask you about.
export interface Features {
  daysSinceSignup: number;
  daysSinceLastLogin: number | null;
  logins30d: number;
  featureUses30d: number;
  supportTickets30d: number;
  failedPayments30d: number;
  latestNps: number | null;
  mrr: number;
  plan: string;
}

const DAY = 1000 * 60 * 60 * 24;

export function extractFeatures(
  customer: Customer & { events: ActivityEvent[] },
  now: number = Date.now(),
): Features {
  const events = customer.events;
  const within = (e: ActivityEvent, days: number) =>
    now - new Date(e.occurredAt).getTime() <= days * DAY;

  const logins = events.filter((e) => e.type === "LOGIN");
  const lastLogin = logins.reduce<number | null>((acc, e) => {
    const t = new Date(e.occurredAt).getTime();
    return acc === null || t > acc ? t : acc;
  }, null);

  const npsEvents = events
    .filter((e) => e.type === "NPS_RESPONSE")
    .sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );
  const latestNps =
    npsEvents.length > 0 && npsEvents[0].metadata
      ? Number((npsEvents[0].metadata as { score?: number }).score ?? NaN)
      : null;

  return {
    daysSinceSignup: Math.floor(
      (now - new Date(customer.signupDate).getTime()) / DAY,
    ),
    daysSinceLastLogin:
      lastLogin === null ? null : Math.floor((now - lastLogin) / DAY),
    logins30d: logins.filter((e) => within(e, 30)).length,
    featureUses30d: events.filter((e) => e.type === "FEATURE_USE" && within(e, 30))
      .length,
    supportTickets30d: events.filter(
      (e) => e.type === "SUPPORT_TICKET" && within(e, 30),
    ).length,
    failedPayments30d: events.filter(
      (e) => e.type === "PAYMENT_FAILED" && within(e, 30),
    ).length,
    latestNps: latestNps !== null && !Number.isNaN(latestNps) ? latestNps : null,
    mrr: customer.mrr,
    plan: customer.plan,
  };
}

function bandFor(score: number): RiskBand {
  if (score >= 66) return "HIGH";
  if (score >= 33) return "MEDIUM";
  return "LOW";
}

// --- Heuristic scorer (fallback, no API key needed) -------------------------
export function heuristicScore(f: Features): RiskResult {
  let score = 0;
  const reasons: string[] = [];

  if (f.daysSinceLastLogin === null) {
    score += 40;
    reasons.push("has never logged in");
  } else if (f.daysSinceLastLogin > 30) {
    score += 35;
    reasons.push(`no login in ${f.daysSinceLastLogin} days`);
  } else if (f.daysSinceLastLogin > 14) {
    score += 20;
    reasons.push(`last login was ${f.daysSinceLastLogin} days ago`);
  }

  if (f.logins30d === 0) {
    score += 15;
    reasons.push("zero logins in the last 30 days");
  } else if (f.logins30d < 3) {
    score += 8;
    reasons.push("very low login frequency");
  }

  if (f.featureUses30d === 0) {
    score += 12;
    reasons.push("no core-feature usage recently");
  }

  score += Math.min(f.failedPayments30d * 15, 30);
  if (f.failedPayments30d > 0)
    reasons.push(`${f.failedPayments30d} failed payment(s)`);

  score += Math.min(f.supportTickets30d * 6, 18);
  if (f.supportTickets30d >= 2)
    reasons.push(`${f.supportTickets30d} support tickets`);

  if (f.latestNps !== null && f.latestNps <= 6) {
    score += 15;
    reasons.push(`low NPS (${f.latestNps})`);
  }

  score = Math.max(0, Math.min(100, score));
  const band = bandFor(score);
  const reason =
    reasons.length > 0
      ? `Customer ${reasons.join(", ")}.`
      : "Healthy engagement across logins, features, and billing.";
  const action =
    band === "HIGH"
      ? "Have a CSM reach out personally within 24h and offer a check-in call."
      : band === "MEDIUM"
        ? "Send a re-engagement email highlighting an unused key feature."
        : "No action needed — keep nurturing.";

  return { score, band, reason, action, model: "heuristic" };
}

// The instruction + feature dump both AI scorers reason over. One copy so
// Claude and Gemini receive byte-for-byte identical input.
function scoringPrompt(
  customer: Customer & { events: ActivityEvent[] },
  f: Features,
): string {
  return `You are a churn-risk analyst for a B2B SaaS product. Assess this customer's risk of cancelling in the next 30 days based on their engagement features.

Customer: ${customer.name} (${customer.company ?? "n/a"}), plan ${f.plan}, $${f.mrr}/mo MRR.
Features (last 30 days unless noted):
- Days since signup: ${f.daysSinceSignup}
- Days since last login: ${f.daysSinceLastLogin ?? "never logged in"}
- Logins (30d): ${f.logins30d}
- Core feature uses (30d): ${f.featureUses30d}
- Support tickets (30d): ${f.supportTickets30d}
- Failed payments (30d): ${f.failedPayments30d}
- Latest NPS (0-10): ${f.latestNps ?? "none"}

Weigh inactivity, failed payments, and low NPS most heavily. Higher MRR customers deserve more urgent, personal actions.`;
}

// --- Claude-powered scorer --------------------------------------------------
async function claudeScore(
  customer: Customer & { events: ActivityEvent[] },
  features: Features,
): Promise<RiskResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      tools: [
        {
          name: "report_churn_risk",
          description:
            "Report the churn risk assessment for a SaaS customer based on their engagement features.",
          input_schema: {
            type: "object",
            properties: {
              score: {
                type: "integer",
                description: "Churn risk from 0 (safe) to 100 (about to churn).",
              },
              band: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
              reason: {
                type: "string",
                description:
                  "One or two sentences explaining the score in plain English for a customer-success rep.",
              },
              action: {
                type: "string",
                description:
                  "A single concrete retention action the team should take next.",
              },
            },
            required: ["score", "band", "reason", "action"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "report_churn_risk" },
      messages: [{ role: "user", content: scoringPrompt(customer, features) }],
    });

    const toolUse = message.content.find((c) => c.type === "tool_use");
    if (toolUse && toolUse.type === "tool_use") {
      const input = toolUse.input as {
        score: number;
        band: RiskBand;
        reason: string;
        action: string;
      };
      const score = Math.max(0, Math.min(100, Math.round(input.score)));
      return {
        score,
        band: input.band ?? bandFor(score),
        reason: input.reason,
        action: input.action,
        model: MODEL,
      };
    }
    return null;
  } catch (err) {
    console.error("Claude scoring failed:", err);
    return null;
  }
}

// --- Gemini-powered scorer (free tier via Google AI Studio) -----------------
// Uses the REST API directly so no extra npm dependency is required. Get a free
// key (no credit card) at https://aistudio.google.com/apikey.
async function geminiScore(
  customer: Customer & { events: ActivityEvent[] },
  features: Features,
): Promise<RiskResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const responseSchema = {
    type: "object",
    properties: {
      score: { type: "integer" },
      band: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
      reason: { type: "string" },
      action: { type: "string" },
    },
    required: ["score", "band", "reason", "action"],
  };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: scoringPrompt(customer, features) }] }],
          generationConfig: { responseMimeType: "application/json", responseSchema, maxOutputTokens: 2048 },
        }),
      },
    );
    if (!res.ok) {
      console.error("Gemini scoring failed:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const input = JSON.parse(text) as {
      score: number;
      band: RiskBand;
      reason: string;
      action: string;
    };
    const score = Math.max(0, Math.min(100, Math.round(input.score)));
    return {
      score,
      band: input.band ?? bandFor(score),
      reason: input.reason,
      action: input.action,
      model: GEMINI_MODEL,
    };
  } catch (err) {
    console.error("Gemini scoring failed:", err);
    return null;
  }
}

// Public entry point: try Claude, then Gemini, then the transparent heuristic
// so the app always works end-to-end even with no key configured.
export async function scoreCustomer(
  customer: Customer & { events: ActivityEvent[] },
): Promise<RiskResult> {
  const features = extractFeatures(customer);
  return (
    (await claudeScore(customer, features)) ??
    (await geminiScore(customer, features)) ??
    heuristicScore(features)
  );
}
