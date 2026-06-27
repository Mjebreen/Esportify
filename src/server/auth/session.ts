import { redirect } from 'next/navigation';
import type { Principal } from '../authz/types';
import { auth } from './index';
import { getPrincipal } from './principal';

/** Resolve the current request's Principal, or null if unauthenticated/no membership. */
export async function getCurrentPrincipal(): Promise<Principal | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return getPrincipal(session.user.id, session.activeOrgId);
}

/** For pages/layouts: resolve the Principal or bounce to /login. */
export async function requirePrincipal(): Promise<Principal> {
  const principal = await getCurrentPrincipal();
  if (!principal) redirect('/login');
  return principal;
}
