import type { Prisma } from "@prisma/client";
import { CustomerStatus, Plan, RiskBand } from "@prisma/client";

// A segment is a saved dashboard filter, stored as JSON.
export interface SegmentDefinition {
  plans?: Plan[];
  bands?: RiskBand[];
  statuses?: CustomerStatus[];
  mrrMin?: number;
  mrrMax?: number;
  tagIds?: string[];
  inactiveDays?: number;
  query?: string;
}

function enumArray<T extends string>(
  raw: unknown,
  allowed: readonly T[],
): T[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const values = raw.filter((v): v is T => allowed.includes(v as T));
  return values.length > 0 ? values : undefined;
}

// Throws Error with a user-facing message on a bad shape.
export function validateSegmentDefinition(input: unknown): SegmentDefinition {
  if (!input || typeof input !== "object") {
    throw new Error("definition must be an object");
  }
  const raw = input as Record<string, unknown>;
  const out: SegmentDefinition = {};

  out.plans = enumArray(raw.plans, Object.values(Plan));
  out.bands = enumArray(raw.bands, Object.values(RiskBand));
  out.statuses = enumArray(raw.statuses, Object.values(CustomerStatus));

  for (const key of ["mrrMin", "mrrMax"] as const) {
    if (raw[key] !== undefined && raw[key] !== null) {
      const v = Number(raw[key]);
      if (!Number.isFinite(v) || v < 0)
        throw new Error(`${key} must be a non-negative number`);
      out[key] = v;
    }
  }
  if (raw.inactiveDays !== undefined && raw.inactiveDays !== null) {
    const v = Number(raw.inactiveDays);
    if (!Number.isInteger(v) || v < 1 || v > 365)
      throw new Error("inactiveDays must be an integer between 1 and 365");
    out.inactiveDays = v;
  }
  if (raw.tagIds !== undefined) {
    if (!Array.isArray(raw.tagIds)) throw new Error("tagIds must be an array");
    const ids = raw.tagIds.filter((t): t is string => typeof t === "string");
    if (ids.length > 0) out.tagIds = ids;
  }
  if (typeof raw.query === "string" && raw.query.trim() !== "") {
    out.query = raw.query.trim();
  }

  // Drop undefined keys so the stored JSON stays tidy.
  return JSON.parse(JSON.stringify(out)) as SegmentDefinition;
}

export function segmentToWhere(
  def: SegmentDefinition,
): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = {};
  if (def.plans) where.plan = { in: def.plans };
  if (def.statuses) where.status = { in: def.statuses };
  if (def.bands) where.riskScore = { band: { in: def.bands } };
  if (def.mrrMin !== undefined || def.mrrMax !== undefined) {
    where.mrr = {
      ...(def.mrrMin !== undefined ? { gte: def.mrrMin } : {}),
      ...(def.mrrMax !== undefined ? { lte: def.mrrMax } : {}),
    };
  }
  if (def.tagIds) where.tags = { some: { tagId: { in: def.tagIds } } };
  if (def.inactiveDays !== undefined) {
    const cutoff = new Date(Date.now() - def.inactiveDays * 24 * 60 * 60 * 1000);
    where.events = { none: { type: "LOGIN", occurredAt: { gte: cutoff } } };
  }
  if (def.query) {
    where.OR = [
      { name: { contains: def.query, mode: "insensitive" } },
      { company: { contains: def.query, mode: "insensitive" } },
    ];
  }
  return where;
}
