import { ZodError } from 'zod';
import { AuthorizationError, authorize } from './authz/gate';
import type { Action, GrantConstraints, Principal, Resource, Scope, ScopeWhere } from './authz/types';
import { withOrgTx, type TxClient } from './db/tenant';
import { getCurrentPrincipal, requirePrincipal } from './auth/session';

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

/** Context handed to every authorized handler: the org-bound tx + the scope WHERE. */
export interface AuthzContext {
  tx: TxClient;
  principal: Principal;
  scope: Scope;
  /** The row predicate the handler MUST apply (merge into every read/scoped write). */
  where: ScopeWhere;
  constraints: GrantConstraints | null;
}

/** Domain errors a handler may throw to produce a clean failure result. */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code = 'domain_error',
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

function toResult(err: unknown): { ok: false; error: string; code?: string } {
  if (err instanceof AuthorizationError) return { ok: false, error: 'Forbidden', code: err.reason };
  if (err instanceof DomainError) return { ok: false, error: err.message, code: err.code };
  if (err instanceof ZodError) {
    return { ok: false, error: err.issues.map((i) => i.message).join('; '), code: 'validation' };
  }
  console.error('[tenantAction] unexpected error', err);
  return { ok: false, error: 'Unexpected error', code: 'internal' };
}

/**
 * Wrap a MUTATION. Guarantees, in order: authenticated principal → authorize()
 * (module + phase + grant + scope) → org-bound RLS transaction → typed result.
 * A handler literally cannot run without the scope WHERE in hand.
 */
export function tenantAction<Input, Output>(
  resource: Resource,
  action: Action,
  handler: (ctx: AuthzContext, input: Input) => Promise<Output>,
): (input: Input) => Promise<ActionResult<Output>> {
  return async (input: Input) => {
    try {
      const principal = await getCurrentPrincipal();
      if (!principal) return { ok: false, error: 'Not authenticated', code: 'unauthenticated' };

      const decision = authorize(principal, action, resource);
      if (!decision.allowed) return { ok: false, error: 'Forbidden', code: decision.reason };

      const data = await withOrgTx(principal.organizationId, (tx) =>
        handler(
          { tx, principal, scope: decision.scope, where: decision.where, constraints: decision.constraints },
          input,
        ),
      );
      return { ok: true, data };
    } catch (err) {
      return toResult(err);
    }
  };
}

/**
 * Wrap a READ for server components/pages. Redirects to /login if unauthenticated,
 * throws AuthorizationError if denied, otherwise returns the loaded data. Reads run
 * inside the org-bound RLS transaction (A4: RLS-everywhere).
 */
export async function tenantLoad<Output>(
  resource: Resource,
  action: Action,
  loader: (ctx: AuthzContext) => Promise<Output>,
): Promise<Output> {
  const principal = await requirePrincipal();
  const decision = authorize(principal, action, resource);
  if (!decision.allowed) {
    throw new AuthorizationError(action, resource, decision.reason);
  }
  return withOrgTx(principal.organizationId, (tx) =>
    loader({ tx, principal, scope: decision.scope, where: decision.where, constraints: decision.constraints }),
  );
}
