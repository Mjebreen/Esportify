'use server';

import { signOut } from './index';

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: '/login' });
}
