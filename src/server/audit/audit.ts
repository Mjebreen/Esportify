import type { AuditAction, Prisma } from '@prisma/client';
import type { TxClient } from '../db/tenant';
import { requireActiveOrgId } from '../db/tenant';

/**
 * Write-time redaction contract (A9). Because audit_logs is append-only and
 * immutable, a leaked secret can NEVER be corrected — so redaction happens here,
 * before persistence, as a tested invariant. Two layers:
 *   1. Per-entity field denylist.
 *   2. A global name-based denylist (defense in depth for any entity).
 */
const ENTITY_DENYLIST: Record<string, string[]> = {
  Player: ['dateOfBirth'],
  Salary: ['amount'],
  Invoice: ['amount'],
  Contract: ['salaryAmount', 'buyout'],
  FlightOption: ['price'],
};

// `amount`/`price` catch financial fields on any entity (Salary.amount, Invoice.amount,
// FlightOption.price) that the per-entity lists might miss.
const GLOBAL_DENY_PATTERN = /password|passwordhash|salary|amount|price|secret|token|ssn|passport|iban|buyout/i;

const REDACTED = '[REDACTED]' as const;

/** Normalize to JSON-safe values: Date -> ISO string, BigInt -> string. */
function jsonSafe(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value, (_key, val) => (typeof val === 'bigint' ? val.toString() : val)));
}

function redact(entity: string, snapshot: Record<string, unknown> | null | undefined): Prisma.InputJsonValue | undefined {
  if (!snapshot) return undefined;
  const denylist = new Set(ENTITY_DENYLIST[entity] ?? []);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(snapshot)) {
    out[key] = denylist.has(key) || GLOBAL_DENY_PATTERN.test(key) ? REDACTED : value;
  }
  return jsonSafe(out);
}

export interface AuditInput {
  actorUserId: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Append an immutable audit entry. MUST run inside the same org-bound tx as the
 * mutation it records, so the RLS WITH CHECK pins it to the active org and it
 * commits atomically with the change. app_runtime has no UPDATE/DELETE on this table.
 */
export async function writeAudit(tx: TxClient, input: AuditInput): Promise<void> {
  await tx.auditLog.create({
    data: {
      organizationId: requireActiveOrgId(),
      actorUserId: input.actorUserId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      subjectType: input.subjectType ?? null,
      subjectId: input.subjectId ?? null,
      before: redact(input.entity, input.before),
      after: redact(input.entity, input.after),
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

/** Exposed for the redaction unit test. */
export const __testing = { redact };
