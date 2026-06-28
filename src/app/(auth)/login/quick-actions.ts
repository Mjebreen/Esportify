'use server';

import { AuthError } from 'next-auth';
import { signIn } from '@/server/auth';

// All seeded demo accounts share this password (see prisma/seed.ts).
const DEMO_PASSWORD = 'Passw0rd!';

/**
 * Testing convenience: sign in as a demo account by role, no password typing.
 * The real Credentials provider still does the auth — this just supplies the
 * known demo credentials. Restore the password form for production.
 */
export async function quickLogin(email: string): Promise<{ error?: string }> {
  try {
    await signIn('credentials', { email, password: DEMO_PASSWORD, redirectTo: '/dashboard' });
    return {};
  } catch (error) {
    // signIn throws a redirect on success; only AuthError means it failed.
    if (error instanceof AuthError) return { error: 'Account not found — run `npm run seed`.' };
    throw error;
  }
}
