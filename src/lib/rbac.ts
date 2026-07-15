import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { getSession } from "./session";

export const ROLE_RANK: Record<Role, number> = {
  VIEWER: 0,
  ANALYST: 1,
  ADMIN: 2,
};

export interface AuthedUser {
  id: string;
  email: string;
  role: Role;
}

export type AuthResult =
  | { ok: true; user: AuthedUser }
  | { ok: false; response: NextResponse };

// Route-handler guard: `const auth = await requireRole("ANALYST");
// if (!auth.ok) return auth.response;`
export async function requireRole(min: Role): Promise<AuthResult> {
  const session = await getSession();
  const role = session?.user?.role ?? null;
  if (!session?.user?.id || role === null) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (ROLE_RANK[role] < ROLE_RANK[min]) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Requires ${min.toLowerCase()} access` },
        { status: 403 },
      ),
    };
  }
  return {
    ok: true,
    user: { id: session.user.id, email: session.user.email ?? "", role },
  };
}

export function canMutate(role: Role | null): boolean {
  return role !== null && ROLE_RANK[role] >= ROLE_RANK.ANALYST;
}

export function isAdmin(role: Role | null): boolean {
  return role === "ADMIN";
}
