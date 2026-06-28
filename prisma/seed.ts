import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/server/db/client';
import { withOrgTx } from '../src/server/db/tenant';
import { addMember, provisionOrganization } from '../src/server/provisioning/provision';

const DEMO_PASSWORD = 'Passw0rd!';
const SLUG = 'twisminds';

async function main() {
  console.log('▶ Seeding demo organization…');

  let provisioned;
  try {
    provisioned = await provisionOrganization({
      orgName: 'Twisted Minds',
      slug: SLUG,
      country: 'SA',
      defaultLocale: 'en',
      defaultDir: 'ltr',
      adminEmail: 'superadmin@twisminds.gg',
      adminName: 'Sara (Super Admin)',
      adminPassword: DEMO_PASSWORD,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      console.error(`\n✖ Demo org "${SLUG}" already exists. Run \`npm run db:reset\` then \`npm run seed\` to reseed.\n`);
      process.exit(1);
    }
    throw err;
  }

  const { organizationId, roleIdBySystemRole, departmentIdByType } = provisioned;

  await withOrgTx(organizationId, async (tx) => {
    // Game titles.
    const titles = await Promise.all(
      [
        { slug: 'valorant', name: 'Valorant' },
        { slug: 'overwatch', name: 'Overwatch' },
        { slug: 'rocket-league', name: 'Rocket League' },
      ].map((g) => tx.gameTitle.create({ data: { organizationId, slug: g.slug, name: g.name } })),
    );
    const valorant = titles[0]!;

    // One user per remaining role.
    const memberSpecs = [
      { sys: 'IT', email: 'it@twisminds.gg', name: 'Omar (IT)', dept: 'IT' },
      { sys: 'LEADERSHIP', email: 'leadership@twisminds.gg', name: 'Noura (Leadership)', dept: 'ESPORTS' },
      { sys: 'MANAGER', email: 'manager@twisminds.gg', name: 'Khalid (Manager)', dept: 'MANAGEMENT' },
      { sys: 'PLAYER', email: 'player@twisminds.gg', name: 'Faisal (Player)', dept: 'ESPORTS' },
      { sys: 'MARCOM', email: 'marcom@twisminds.gg', name: 'Lina (Marcom)', dept: 'MARCOM' },
      { sys: 'AVIATION', email: 'aviation@twisminds.gg', name: 'Tariq (Aviation)', dept: 'AVIATION' },
      { sys: 'MERCH', email: 'merch@twisminds.gg', name: 'Huda (Merch)', dept: 'MERCH' },
      { sys: 'FINANCE', email: 'finance@twisminds.gg', name: 'Sami (Finance)', dept: 'FINANCE' },
    ] as const;

    const userIdBySys = new Map<string, string>();
    for (const m of memberSpecs) {
      const userId = await addMember(tx, {
        organizationId,
        email: m.email,
        name: m.name,
        password: DEMO_PASSWORD,
        roleId: roleIdBySystemRole.get(m.sys)!,
        departmentId: departmentIdByType.get(m.dept),
        isPrimary: true,
      });
      userIdBySys.set(m.sys, userId);
    }

    // Manager profile (linked to the manager user) + a Valorant roster they own.
    const manager = await tx.manager.create({
      data: {
        organizationId,
        userId: userIdBySys.get('MANAGER')!,
        firstName: 'Khalid',
        lastName: 'Al-Otaibi',
        email: 'manager@twisminds.gg',
      },
    });
    const roster = await tx.roster.create({
      data: { organizationId, name: 'Twisted Minds Valorant', gameTitleId: valorant.id, managerId: manager.id },
    });

    // Player profile (linked to the player user) on the manager's roster + bench players.
    const faisal = await tx.player.create({
      data: {
        organizationId,
        rosterId: roster.id,
        userId: userIdBySys.get('PLAYER')!,
        firstName: 'Faisal',
        lastName: 'Al-Harbi',
        inGameName: 'TM1',
        jerseyNumber: 7,
      },
    });
    await tx.player.createMany({
      data: [
        { organizationId, rosterId: roster.id, firstName: 'Yousef', lastName: 'N.', inGameName: 'TM2', jerseyNumber: 8 },
        { organizationId, rosterId: roster.id, firstName: 'Mido', lastName: 'K.', inGameName: 'TM3', jerseyNumber: 9 },
      ],
    });

    // ── Phase 2–4 demo content ────────────────────────────────────────────────
    const now = new Date();
    const months = (m: number) => new Date(now.getFullYear(), now.getMonth() + m, now.getDate());
    const pid = faisal.id;

    await tx.tournament.create({
      data: { organizationId, gameTitleId: valorant.id, rosterId: roster.id, name: 'Gamers8 Qualifier', status: 'UPCOMING', startDate: months(1) },
    });
    await tx.contract.create({
      data: { organizationId, playerId: pid, status: 'ACTIVE', startDate: months(-6), endDate: months(2), salaryAmount: 15000, currency: 'SAR', buyout: 200000, prizeSplitPct: 10 },
    });
    await tx.salary.create({ data: { organizationId, playerId: pid, amount: 15000, currency: 'SAR', effectiveFrom: months(-6) } });
    await tx.attendance.create({ data: { organizationId, playerId: pid, type: 'TARDINESS', date: months(0), minutesLate: 15, reason: 'Traffic' } });
    await tx.performanceRecord.create({ data: { organizationId, playerId: pid, matchDate: months(0), opponent: 'Team Vitality', metric: 'ACS', value: 245 } });
    await tx.schedule.create({ data: { organizationId, rosterId: roster.id, type: 'SCRIM', title: 'Scrim vs Twisted Minds Academy', startAt: months(0) } });
    await tx.bootcamp.create({ data: { organizationId, name: 'Istanbul Bootcamp', location: 'Istanbul', startDate: months(1) } });
    await tx.trip.create({ data: { organizationId, playerId: pid, purpose: 'Bootcamp travel', origin: 'Riyadh', destination: 'Istanbul', departAt: months(1), status: 'BOOKED' } });
    // A player-submitted invoice awaiting the manager's approval (demoes the workflow).
    await tx.invoice.create({ data: { organizationId, playerId: pid, number: 'INV-1001', amount: 5000, currency: 'SAR', status: 'SUBMITTED', issuedAt: months(0), dueAt: months(1), createdById: userIdBySys.get('PLAYER')! } });
    await tx.merchSizeProfile.create({ data: { organizationId, playerId: pid, jerseySize: 'L', jacketSize: 'L', shoeSize: '43' } });
    await tx.jerseyEntitlement.create({ data: { organizationId, playerId: pid, season: '2026', allocated: 3, claimed: 1 } });

    await tx.request.create({
      data: {
        organizationId,
        type: 'TECHNICAL_SERVICE',
        title: 'New 240Hz monitor for TM1',
        description: 'Current monitor flickers during scrims.',
        priority: 'HIGH',
        status: 'NEW',
        requesterUserId: userIdBySys.get('PLAYER')!,
        targetDepartmentId: departmentIdByType.get('IT'),
        dueDate: months(1),
      },
    });
    await tx.task.create({
      data: {
        organizationId,
        title: 'Renew Faisal contract before expiry',
        description: 'Contract ends in ~2 months — open renewal talks.',
        priority: 'HIGH',
        status: 'TODO',
        creatorUserId: provisioned.adminUserId,
        assigneeUserId: userIdBySys.get('MANAGER')!,
        dueDate: months(1),
      },
    });
  });

  // ── Second org (demonstrates the org switcher + cross-tenant isolation) ──────
  const nova = await provisionOrganization({
    orgName: 'Nova Esports',
    slug: 'nova',
    country: 'SA',
    adminEmail: 'owner@nova.gg',
    adminName: 'Nova Owner',
    adminPassword: DEMO_PASSWORD,
  });
  await withOrgTx(nova.organizationId, async (tx) => {
    // The Twisted Minds super admin is ALSO a (non-primary) Super Admin of Nova,
    // so they can switch between the two orgs and see fully isolated data.
    await addMember(tx, {
      organizationId: nova.organizationId,
      email: 'superadmin@twisminds.gg',
      name: 'Sara (Super Admin)',
      password: DEMO_PASSWORD,
      roleId: nova.roleIdBySystemRole.get('SUPER_ADMIN')!,
      isPrimary: false,
    });
    await tx.gameTitle.create({ data: { organizationId: nova.organizationId, slug: 'lol', name: 'League of Legends' } });
  });

  console.log('\n✔ Seed complete. Demo org "Twisted Minds" (slug: twisminds).');
  console.log('  + second org "Nova Esports" — superadmin@twisminds.gg belongs to both (try the org switcher).');
  console.log(`  All accounts share password: ${DEMO_PASSWORD}\n`);
  for (const email of [
    'superadmin@twisminds.gg (SUPER_ADMIN)',
    'it@twisminds.gg (IT)',
    'leadership@twisminds.gg (LEADERSHIP)',
    'manager@twisminds.gg (MANAGER)',
    'player@twisminds.gg (PLAYER)',
    'marcom@twisminds.gg (MARCOM)',
    'aviation@twisminds.gg (AVIATION)',
    'merch@twisminds.gg (MERCH)',
  ]) {
    console.log(`  • ${email}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
