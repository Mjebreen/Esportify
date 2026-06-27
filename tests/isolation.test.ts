import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/server/db/client';
import { withOrgTx } from '@/server/db/tenant';
import { provisionOrganization } from '@/server/provisioning/provision';

// Probe the test DB. If unreachable (no TEST_DATABASE_URL / no Postgres), skip the
// whole suite rather than fail — but if it IS reachable it must be migrated +
// secured (npm run db:setup against the test DB) and connected as app_runtime.
let dbAvailable = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbAvailable = true;
} catch {
  dbAvailable = false;
}

const suite = dbAvailable ? describe : describe.skip;

suite('cross-tenant isolation (RLS + composite FK + audit)', () => {
  const suffix = Date.now().toString(36);
  let orgA = '';
  let orgB = '';
  let playerA = '';
  let playerB = '';
  let gameTitleB = '';

  async function setupOrg(tag: string): Promise<{ orgId: string; playerId: string; gameTitleId: string }> {
    const { organizationId } = await provisionOrganization({
      orgName: `Org ${tag} ${suffix}`,
      slug: `iso-${tag}-${suffix}`,
      adminEmail: `admin-${tag}-${suffix}@example.com`,
      adminName: `Admin ${tag}`,
      adminPassword: 'Passw0rd!',
    });
    return withOrgTx(organizationId, async (tx) => {
      const gt = await tx.gameTitle.create({ data: { organizationId, slug: `val-${suffix}`, name: 'Valorant' } });
      const roster = await tx.roster.create({ data: { organizationId, name: 'R', gameTitleId: gt.id } });
      const player = await tx.player.create({
        data: { organizationId, rosterId: roster.id, firstName: 'P', lastName: tag, inGameName: `ign-${tag}-${suffix}` },
      });
      return { orgId: organizationId, playerId: player.id, gameTitleId: gt.id };
    });
  }

  beforeAll(async () => {
    const a = await setupOrg('a');
    const b = await setupOrg('b');
    orgA = a.orgId;
    orgB = b.orgId;
    playerA = a.playerId;
    playerB = b.playerId;
    gameTitleB = b.gameTitleId;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('lists only the active org’s players', async () => {
    const players = await withOrgTx(orgA, (tx) => tx.player.findMany());
    expect(players).toHaveLength(1);
    expect(players[0]?.id).toBe(playerA);
  });

  it('cannot read another org’s player by id', async () => {
    const leaked = await withOrgTx(orgA, (tx) => tx.player.findUnique({ where: { id: playerB } }));
    expect(leaked).toBeNull();
  });

  it('rejects a forged organizationId on insert (RLS WITH CHECK)', async () => {
    await expect(
      withOrgTx(orgA, (tx) =>
        tx.player.create({
          data: { organizationId: orgB, firstName: 'X', lastName: 'Y', inGameName: `forge-${suffix}` },
        }),
      ),
    ).rejects.toThrow();
  });

  it('does not leak other-org rows through a nested include traversal', async () => {
    const rosters = await withOrgTx(orgA, (tx) => tx.roster.findMany({ include: { players: true } }));
    for (const roster of rosters) {
      for (const player of roster.players) {
        expect(player.organizationId).toBe(orgA);
      }
    }
  });

  it('rejects a cross-tenant FK edge via connect (composite FK guard)', async () => {
    await expect(
      withOrgTx(orgA, (tx) =>
        tx.roster.create({ data: { organizationId: orgA, name: 'X', gameTitleId: gameTitleB } }),
      ),
    ).rejects.toThrow();
  });

  it('isolates the audit log across tenants', async () => {
    const aSeesB = await withOrgTx(orgA, (tx) => tx.auditLog.findMany({ where: { organizationId: orgB } }));
    expect(aSeesB).toHaveLength(0);
    const aOwn = await withOrgTx(orgA, (tx) => tx.auditLog.count());
    expect(aOwn).toBeGreaterThan(0);
  });

  it('forbids tampering with audit rows (append-only)', async () => {
    const row = await withOrgTx(orgA, (tx) => tx.auditLog.findFirst());
    expect(row).not.toBeNull();
    await expect(
      withOrgTx(orgA, (tx) => tx.auditLog.update({ where: { id: row!.id }, data: { entity: 'tampered' } })),
    ).rejects.toThrow();
  });
});
