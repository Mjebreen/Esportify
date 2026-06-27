'use server';

import { AuthError } from 'next-auth';
import { signIn } from '@/server/auth';

export interface LoginState {
  error?: boolean;
}

export async function authenticate(_prev: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn('credentials', {
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
      redirectTo: '/dashboard',
    });
    return {};
  } catch (error) {
    // signIn throws a redirect on success — only AuthError means bad credentials.
    if (error instanceof AuthError) return { error: true };
    throw error;
  }
}
