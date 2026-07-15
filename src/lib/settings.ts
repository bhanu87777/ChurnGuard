import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import {
  DEFAULT_WEIGHTS,
  normalizeWeights,
  type ScoringWeights,
} from "./scoring-weights";

const SCORING_WEIGHTS_KEY = "scoring.weights";

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row ? (row.value as T) : fallback;
}

export async function setSetting(
  key: string,
  value: unknown,
  updatedById?: string,
): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value: value as Prisma.InputJsonValue, updatedById },
    create: { key, value: value as Prisma.InputJsonValue, updatedById },
  });
}

export async function getScoringWeights(): Promise<ScoringWeights> {
  try {
    const stored = await getSetting<unknown>(SCORING_WEIGHTS_KEY, null);
    return stored ? normalizeWeights(stored) : { ...DEFAULT_WEIGHTS };
  } catch {
    // Settings must never break scoring — fall back to defaults.
    return { ...DEFAULT_WEIGHTS };
  }
}

export async function saveScoringWeights(
  patch: unknown,
  updatedById: string,
): Promise<ScoringWeights> {
  const weights = normalizeWeights(patch);
  await setSetting(SCORING_WEIGHTS_KEY, weights, updatedById);
  return weights;
}
