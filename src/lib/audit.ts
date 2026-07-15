import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export type AuditAction =
  | "auth.login"
  | "customer.create"
  | "customer.update"
  | "customer.delete"
  | "customer.rescore"
  | "customer.score_all"
  | "event.create"
  | "event.ingest"
  | "settings.update"
  | "user.create"
  | "user.update"
  | "profile.update"
  | "rule.create"
  | "rule.update"
  | "rule.delete"
  | "tag.create"
  | "tag.update"
  | "tag.delete"
  | "segment.create"
  | "segment.update"
  | "segment.delete"
  | "apikey.create"
  | "apikey.revoke"
  | "import.customers"
  | "import.events";

// Best-effort audit trail. Never throws and never blocks the response path —
// a failed audit write must not fail the action it describes.
export async function audit(
  actor: { id: string; email: string } | null,
  action: AuditAction,
  target?: { type: string; id: string },
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? null,
        action,
        targetType: target?.type ?? null,
        targetId: target?.id ?? null,
        metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    console.error(`audit(${action}) failed:`, err);
  }
}
