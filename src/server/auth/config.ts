import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db/client';
import { env } from '../env';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Auth.js (NextAuth v5) config. Credentials forces a JWT session, so the token
 * deliberately carries ONLY a stable userId (+ an active-org HINT). It is never
 * trusted for authorization — getPrincipal() re-derives roles/membership/org
 * status from the DB on every request, so revocation is instant (A11).
 */
export const authConfig = {
  secret: env.AUTH_SECRET,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        // users is a GLOBAL, RLS-exempt table — base client is correct here.
        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
        if (!user || !user.passwordHash || user.deletedAt) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user?.id) token.userId = user.id;
      // Org switch via useSession().update({ activeOrgId }). Stored as a HINT only;
      // getPrincipal() re-validates the user actually has an ACTIVE membership there.
      if (trigger === 'update' && session && typeof session === 'object' && 'activeOrgId' in session) {
        const next = (session as { activeOrgId?: unknown }).activeOrgId;
        if (typeof next === 'string') token.activeOrgId = next;
      }
      return token;
    },
    session({ session, token }) {
      if (typeof token.userId === 'string') session.user.id = token.userId;
      session.activeOrgId = typeof token.activeOrgId === 'string' ? token.activeOrgId : undefined;
      return session;
    },
  },
} satisfies NextAuthConfig;
