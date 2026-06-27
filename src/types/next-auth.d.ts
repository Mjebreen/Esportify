import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
    };
    /** Active-org hint only — authorization is re-derived server-side per request. */
    activeOrgId?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    activeOrgId?: string;
  }
}
