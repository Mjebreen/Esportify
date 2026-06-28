'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { ACTIVE_ORG_COOKIE, getCurrentPrincipal } from '@/server/auth/session';
import { listUserOrganizations } from '@/server/auth/principal';

/** Switch the active organization. Validates the user actually belongs to it,
 * then sets the cookie that getCurrentPrincipal() reads on the next request. */
export async function switchOrg(orgId: string): Promise<{ ok: boolean }> {
  const principal = await getCurrentPrincipal();
  if (!principal) return { ok: false };

  const orgs = await listUserOrganizations(principal.userId);
  if (!orgs.some((o) => o.id === orgId)) return { ok: false };

  (await cookies()).set(ACTIVE_ORG_COOKIE, orgId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}
