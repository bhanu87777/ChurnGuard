import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { audit } from "./audit";

// How long a JWT may trust its cached role before re-checking the DB. Bounds
// the staleness of role changes / deactivations without a DB hit per request.
const ROLE_RECHECK_MS = 5 * 60 * 1000;

// JWT-based credentials auth. We verify email + password against the User table
// (bcrypt hash) and carry the user id + role inside the signed JWT session.
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user || !user.isActive) return null;
        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role?: Role }).role ?? null;
        token.roleCheckedAt = Date.now();
        return token;
      }
      // Periodically refresh the role so promotions/demotions/deactivations
      // take effect without forcing a re-login.
      const checkedAt = token.roleCheckedAt ?? 0;
      if (Date.now() - checkedAt > ROLE_RECHECK_MS && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, isActive: true },
        });
        token.role = dbUser && dbUser.isActive ? dbUser.role : null;
        token.roleCheckedAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as Role | null) ?? null;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      await audit(
        { id: user.id, email: user.email ?? "" },
        "auth.login",
      );
    },
  },
  secret: process.env.AUTH_SECRET,
};
