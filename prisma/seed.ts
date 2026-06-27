import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/server/db/client';
import { withOrgTx } from '../src/server/db/tenant';
import { addMember, provisionOrganization } from '../src/server/provisioning/provision';

const DEMO_PASSWORD = 'Passw0rd!';
const SLUG = 'falcons';

async function main() {
  console.log('▶ Seeding demo organization…');

  let provisioned;
  try {
    provisioned = await provisionOrganization({
      orgName: 'Falcons Esports',
      slug: SLUG,
      country: 'SA',
      defaultLocale: 'en',
      defaultDir: 'ltr',
      adminEmail: 'superadmin@falcons.gg',
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
      { sys: 'IT', email: 'it@falcons.gg', name: 'Omar (IT)', dept: 'IT' },
      { sys: 'LEADERSHIP', email: 'leadership@falcons.gg', name: 'Noura (Leadership)', dept: 'ESPORTS' },
      { sys: 'MANAGER', email: 'manager@falcons.gg', name: 'Khalid (Manager)', dept: 'MANAGEMENT' },
      { sys: 'PLAYER', email: 'player@falcons.gg', name: 'Faisal (Player)', dept: 'ESPORTS' },
      { sys: 'MARCOM', email: 'marcom@falcons.gg', name: 'Lina (Marcom)', dept: 'MARCOM' },
      { sys: 'AVIATION', email: 'aviation@falcons.gg', name: 'Tariq (Aviation)', dept: 'AVIATION' },
      { sys: 'MERCH', email: 'merch@falcons.gg', name: 'Huda (Merch)', dept: 'MERCH' },
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
        email: 'manager@falcons.gg',
      },
    });
    const roster = await tx.roster.create({
      data: { organizationId, name: 'Falcons Valorant', gameTitleId: valorant.id, managerId: manager.id },
    });

    // Player profile (linked to the player user) on the manager's roster + bench players.
    await tx.player.create({
      data: {
        organizationId,
        rosterId: roster.id,
        userId: userIdBySys.get('PLAYER')!,
        firstName: 'Faisal',
        lastName: 'Al-Harbi',
        inGameName: 'Falcon1',
        jerseyNumber: 7,
      },
    });
    await tx.player.createMany({
      data: [
        { organizationId, rosterId: roster.id, firstName: 'Yousef', lastName: 'N.', inGameName: 'Falcon2', jerseyNumber: 8 },
        { organizationId, rosterId: roster.id, firstName: 'Mido', lastName: 'K.', inGameName: 'Falcon3', jerseyNumber: 9 },
      ],
    });
  });

  console.log('\n✔ Seed complete. Demo org "Falcons Esports" (slug: falcons).');
  console.log(`  All accounts share password: ${DEMO_PASSWORD}\n`);
  for (const email of [
    'superadmin@falcons.gg (SUPER_ADMIN)',
    'it@falcons.gg (IT)',
    'leadership@falcons.gg (LEADERSHIP)',
    'manager@falcons.gg (MANAGER)',
    'player@falcons.gg (PLAYER)',
    'marcom@falcons.gg (MARCOM)',
    'aviation@falcons.gg (AVIATION)',
    'merch@falcons.gg (MERCH)',
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
