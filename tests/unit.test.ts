import { describe, expect, it } from 'vitest';
import type { MediaAsset } from '@prisma/client';
import { authorize, holdsGrant } from '@/server/authz/gate';
import type { EffectiveGrant, Principal } from '@/server/authz/types';
import { __testing as audit } from '@/server/audit/audit';
import { __testing as media } from '@/server/storage/media';

function grant(partial: Partial<EffectiveGrant> & Pick<EffectiveGrant, 'resource' | 'action' | 'scope'>): EffectiveGrant {
  return { effect: 'ALLOW', phase: 1, constraints: null, ...partial };
}

function principal(overrides: Partial<Principal> = {}): Principal {
  return {
    userId: 'u1',
    organizationId: 'o1',
    isPlatformStaff: false,
    roleHints: [],
    grants: [],
    enabledModules: new Set(['CORE']),
    managerId: null,
    playerId: null,
    managedRosterIds: [],
    departmentIds: [],
    ...overrides,
  };
}

describe('authorize() gate', () => {
  it('resolves a manager to roster scope with a manager-bound WHERE', () => {
    const p = principal({ managerId: 'm1', grants: [grant({ resource: 'player', action: 'read', scope: 'roster' })] });
    const d = authorize(p, 'read', 'player');
    expect(d.allowed).toBe(true);
    if (d.allowed) expect(d.where).toEqual({ roster: { managerId: 'm1' } });
  });

  it('honors the self-edit field allowlist for a player (own scope)', () => {
    const p = principal({
      playerId: 'p1',
      grants: [grant({ resource: 'player', action: 'update', scope: 'own', constraints: { fields: ['firstName'] } })],
    });
    const d = authorize(p, 'update', 'player');
    expect(d.allowed).toBe(true);
    if (d.allowed) {
      expect(d.where).toEqual({ userId: 'u1' });
      expect(d.constraints?.fields).toContain('firstName');
    }
    // No delete grant → denied.
    expect(authorize(p, 'delete', 'player').allowed).toBe(false);
  });

  it('denies when the resource module is disabled for the tenant', () => {
    const p = principal({ enabledModules: new Set(), grants: [grant({ resource: 'player', action: 'read', scope: 'organization' })] });
    const d = authorize(p, 'read', 'player');
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toBe('module_disabled:CORE');
  });

  it('treats a beyond-deployed-phase grant as inert', () => {
    const p = principal({ grants: [grant({ resource: 'player', action: 'read', scope: 'organization', phase: 99 })] });
    expect(authorize(p, 'read', 'player').allowed).toBe(false);
  });

  it('returns a never-match WHERE when roster scope has no managerId', () => {
    const p = principal({ managerId: null, grants: [grant({ resource: 'player', action: 'read', scope: 'roster' })] });
    const d = authorize(p, 'read', 'player');
    expect(d.allowed).toBe(true);
    if (d.allowed) expect(d.where).toEqual({ id: { in: [] } });
  });

  it('picks the broadest scope on multi-role union', () => {
    const p = principal({
      managerId: 'm1',
      grants: [
        grant({ resource: 'player', action: 'read', scope: 'roster' }),
        grant({ resource: 'player', action: 'read', scope: 'organization' }),
      ],
    });
    const d = authorize(p, 'read', 'player');
    expect(d.allowed).toBe(true);
    if (d.allowed) expect(d.scope).toBe('organization');
  });
});

describe('holdsGrant() anti-amplification', () => {
  it('lets an org-manage admin grant a narrower capability', () => {
    const admin = principal({ grants: [grant({ resource: 'player', action: 'manage', scope: 'organization' })] });
    expect(holdsGrant(admin, 'player', 'update', 'own')).toBe(true);
  });
  it('forbids a manager from granting matrix edits it does not hold', () => {
    const manager = principal({ grants: [grant({ resource: 'player', action: 'read', scope: 'roster' })] });
    expect(holdsGrant(manager, 'rolePermission', 'manage', 'organization')).toBe(false);
  });
});

describe('audit redaction (write-time)', () => {
  it('redacts per-entity and global-sensitive fields, JSON-normalizes dates', () => {
    const out = audit.redact('Player', {
      firstName: 'Faisal',
      dateOfBirth: new Date('2000-01-01T00:00:00.000Z'),
      phone: '+9665',
      salary: 99999,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }) as Record<string, unknown>;
    expect(out.firstName).toBe('Faisal');
    expect(out.dateOfBirth).toBe('[REDACTED]'); // entity denylist
    expect(out.salary).toBe('[REDACTED]'); // global pattern
    expect(out.phone).toBe('+9665');
    expect(out.createdAt).toBe('2026-01-01T00:00:00.000Z'); // Date -> ISO
  });
});

describe('media visibility policy', () => {
  const base: MediaAsset = {
    id: 'a1',
    organizationId: 'o1',
    s3Key: 'org/o1/player/p1/photo.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 1024n,
    status: 'READY',
    ownerType: 'PLAYER',
    ownerId: 'p1',
    rosterId: null,
    visibility: 'PRIVATE',
    tags: [],
    uploadedById: null,
    createdAt: new Date('2026-01-01'),
    deletedAt: null,
  };

  it('lets a player read their OWN private asset', () => {
    const player = principal({ playerId: 'p1' });
    expect(media.canReadAsset(player, base)).toBe(true);
  });

  it('blocks a non-org-scope user from a RESTRICTED asset', () => {
    const player = principal({ playerId: 'p1', grants: [grant({ resource: 'mediaAsset', action: 'read', scope: 'own' })] });
    expect(media.canReadAsset(player, { ...base, visibility: 'RESTRICTED', ownerId: 'someone-else' })).toBe(false);
  });

  it('lets an org-scope reader (leadership/admin) read a RESTRICTED asset', () => {
    const admin = principal({ grants: [grant({ resource: 'mediaAsset', action: 'read', scope: 'organization' })] });
    expect(media.canReadAsset(admin, { ...base, visibility: 'RESTRICTED' })).toBe(true);
  });

  it('never serves a non-READY asset', () => {
    const admin = principal({ grants: [grant({ resource: 'mediaAsset', action: 'read', scope: 'organization' })] });
    expect(media.canReadAsset(admin, { ...base, status: 'PENDING' })).toBe(false);
  });
});
