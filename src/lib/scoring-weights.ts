// Tunable weights for the transparent heuristic scorer. Dependency-free so
// scoring.ts stays pure and importable from CLI scripts (prisma/score-all.ts).
// The AI scorers are unaffected by these — they reason over raw features.

export interface ScoringWeights {
  neverLoggedIn: number;
  inactiveOver30d: number;
  inactiveOver14d: number;
  zeroLogins30d: number;
  lowLoginFrequency: number;
  noFeatureUse: number;
  failedPaymentEach: number;
  failedPaymentCap: number;
  ticketEach: number;
  ticketCap: number;
  lowNps: number;
  bandHighFrom: number;
  bandMediumFrom: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  neverLoggedIn: 40,
  inactiveOver30d: 35,
  inactiveOver14d: 20,
  zeroLogins30d: 15,
  lowLoginFrequency: 8,
  noFeatureUse: 12,
  failedPaymentEach: 15,
  failedPaymentCap: 30,
  ticketEach: 6,
  ticketCap: 18,
  lowNps: 15,
  bandHighFrom: 66,
  bandMediumFrom: 33,
};

// Human-readable metadata for the settings UI.
export const WEIGHT_META: Record<
  keyof ScoringWeights,
  { label: string; description: string; max: number }
> = {
  neverLoggedIn: {
    label: "Never logged in",
    description: "Added when the customer has no login events at all.",
    max: 60,
  },
  inactiveOver30d: {
    label: "Inactive 30+ days",
    description: "Added when the last login is more than 30 days ago.",
    max: 60,
  },
  inactiveOver14d: {
    label: "Inactive 14+ days",
    description: "Added when the last login is more than 14 days ago.",
    max: 40,
  },
  zeroLogins30d: {
    label: "Zero logins (30d)",
    description: "Added when there were no logins in the last 30 days.",
    max: 30,
  },
  lowLoginFrequency: {
    label: "Low login frequency",
    description: "Added when there were fewer than 3 logins in the last 30 days.",
    max: 20,
  },
  noFeatureUse: {
    label: "No feature usage (30d)",
    description: "Added when no core feature was used in the last 30 days.",
    max: 30,
  },
  failedPaymentEach: {
    label: "Per failed payment",
    description: "Added for each failed payment in the last 30 days.",
    max: 30,
  },
  failedPaymentCap: {
    label: "Failed-payment cap",
    description: "Maximum total points from failed payments.",
    max: 60,
  },
  ticketEach: {
    label: "Per support ticket",
    description: "Added for each support ticket in the last 30 days.",
    max: 20,
  },
  ticketCap: {
    label: "Support-ticket cap",
    description: "Maximum total points from support tickets.",
    max: 40,
  },
  lowNps: {
    label: "Low NPS (≤ 6)",
    description: "Added when the latest NPS response is 6 or below.",
    max: 30,
  },
  bandHighFrom: {
    label: "HIGH band threshold",
    description: "Scores at or above this value are labeled HIGH risk.",
    max: 100,
  },
  bandMediumFrom: {
    label: "MEDIUM band threshold",
    description: "Scores at or above this value are labeled MEDIUM risk.",
    max: 100,
  },
};

// Merge a stored/partial value over the defaults, clamping to sane ranges and
// keeping the band thresholds ordered.
export function normalizeWeights(input: unknown): ScoringWeights {
  const patch = (input ?? {}) as Partial<Record<keyof ScoringWeights, unknown>>;
  const out = { ...DEFAULT_WEIGHTS };
  for (const key of Object.keys(DEFAULT_WEIGHTS) as (keyof ScoringWeights)[]) {
    const raw = Number(patch[key]);
    if (Number.isFinite(raw)) {
      out[key] = Math.max(0, Math.min(WEIGHT_META[key].max, Math.round(raw)));
    }
  }
  if (out.bandMediumFrom >= out.bandHighFrom) {
    out.bandMediumFrom = DEFAULT_WEIGHTS.bandMediumFrom;
    out.bandHighFrom = DEFAULT_WEIGHTS.bandHighFrom;
  }
  return out;
}
