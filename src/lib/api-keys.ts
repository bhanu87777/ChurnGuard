import { createHash, randomBytes } from "node:crypto";
import type { ApiKey } from "@prisma/client";
import { prisma } from "./prisma";

// Only the sha256 hash of a key is stored; the plaintext is returned exactly
// once at creation time.

export function hashKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export function generateKey(): {
  plaintext: string;
  hash: string;
  prefix: string;
} {
  const plaintext = `cg_${randomBytes(24).toString("hex")}`;
  return {
    plaintext,
    hash: hashKey(plaintext),
    prefix: plaintext.slice(0, 11),
  };
}

// Authenticate a public-API request via the X-Api-Key header. Returns the key
// row, or null when missing/unknown/revoked.
export async function authenticateApiKey(req: Request): Promise<ApiKey | null> {
  const header = req.headers.get("x-api-key");
  if (!header) return null;

  const key = await prisma.apiKey.findUnique({
    where: { keyHash: hashKey(header.trim()) },
  });
  if (!key || key.revokedAt) return null;

  // Track usage without a write per request: only bump when >60s stale.
  const stale =
    !key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > 60_000;
  if (stale) {
    prisma.apiKey
      .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
  }
  return key;
}
