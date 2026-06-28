import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Principal } from '../authz/types';
import { auth } from './index';
import { getPrincipal } from './principal';

/** Cookie holding the user's active org. getPrincipal() re-validates membership,
 * so a forged value harmlessly falls back to the user's primary org. */
export const ACTIVE_ORG_COOKIE = 'active_org';

/** Resolve the current request's Principal, or null if unauthenticated/no membership. */
export async function getCurrentPrincipal(): Promise<Principal | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const requested = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value ?? session.activeOrgId;
  return getPrincipal(session.user.id, requested);
}

/** For pages/layouts: resolve the Principal or bounce to /login. */
export async function requirePrincipal(): Promise<Principal> {
  const principal = await getCurrentPrincipal();
  if (!principal) redirect('/login');
  return principal;
}
