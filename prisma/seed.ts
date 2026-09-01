import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/server/db/client';
import { withOrgTx } from '../src/server/db/tenant';
import { addMember, provisionOrganization } from '../src/server/provisioning/provision';

const DEMO_PASSWORD = 'Passw0rd!';
const SLUG = 'twisminds';

// ── date helpers (seed runs at real time — fine, not a workflow script) ──────
const DAY = 86_400_000;
const now = new Date();
const days = (n: number) => new Date(now.getTime() + n * DAY);
const months = (m: number) => new Date(now.getFullYear(), now.getMonth() + m, Math.min(now.getDate(), 28));
const iso = (d: Date) => d.toISOString();
const period = (m: number) => {
  const d = months(m);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const J = (v: unknown) => v as unknown as Prisma.InputJsonValue;

async function main() {
  console.log('▶ Seeding Twisted Minds demo organization…');

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
      console.error(`\n✖ Demo org "${SLUG}" already exists. Run \`npm run db:reset\` (then it reseeds) to start clean.\n`);
      process.exit(1);
    }
    throw err;
  }

  const { organizationId, roleIdBySystemRole, departmentIdByType, adminUserId } = provisioned;
  const orgId = organizationId;

  await withOrgTx(orgId, async (tx) => {
    // ── Game titles ──────────────────────────────────────────────────────────
    const titleSpecs = [
      { slug: 'valorant', name: 'Valorant' },
      { slug: 'cs2', name: 'Counter-Strike 2' },
      { slug: 'rocket-league', name: 'Rocket League' },
      { slug: 'pubg', name: 'PUBG Mobile' },
      { slug: 'ea-fc', name: 'EA Sports FC' },
      { slug: 'lol', name: 'League of Legends' },
    ];
    const titleBySlug = new Map<string, string>();
    for (const t of titleSpecs) {
      const row = await tx.gameTitle.create({ data: { organizationId: orgId, slug: t.slug, name: t.name } });
      titleBySlug.set(t.slug, row.id);
    }

    // ── Canonical role accounts (one per role — these are the testing logins) ──
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

    const userBy = new Map<string, string>(); // key: sys role OR email
    for (const m of memberSpecs) {
      const userId = await addMember(tx, {
        organizationId: orgId,
        email: m.email,
        name: m.name,
        password: DEMO_PASSWORD,
        roleId: roleIdBySystemRole.get(m.sys)!,
        departmentId: departmentIdByType.get(m.dept),
        isPrimary: true,
      });
      userBy.set(m.sys, userId);
      userBy.set(m.email, userId);
    }

    // Two more managers so Leadership/Finance see multiple teams (not testing logins).
    for (const m of [
      { email: 'manager2@twisminds.gg', name: 'Reem (Manager)' },
      { email: 'manager3@twisminds.gg', name: 'Bandar (Manager)' },
    ]) {
      const userId = await addMember(tx, {
        organizationId: orgId,
        email: m.email,
        name: m.name,
        password: DEMO_PASSWORD,
        roleId: roleIdBySystemRole.get('MANAGER')!,
        departmentId: departmentIdByType.get('MANAGEMENT'),
        isPrimary: true,
      });
      userBy.set(m.email, userId);
    }

    // ── Manager profiles ──────────────────────────────────────────────────────
    const mkManager = (userKey: string, first: string, last: string, email: string) =>
      tx.manager.create({ data: { organizationId: orgId, userId: userBy.get(userKey)!, firstName: first, lastName: last, email } });
    const khalid = await mkManager('MANAGER', 'Khalid', 'Al-Otaibi', 'manager@twisminds.gg');
    const reem = await mkManager('manager2@twisminds.gg', 'Reem', 'Al-Qahtani', 'manager2@twisminds.gg');
    const bandar = await mkManager('manager3@twisminds.gg', 'Bandar', 'Al-Dosari', 'manager3@twisminds.gg');

    // ── Rosters (Khalid owns 3 → rich Manager + approver experience) ──────────
    const mkRoster = (name: string, slug: string, managerId: string) =>
      tx.roster.create({ data: { organizationId: orgId, name, gameTitleId: titleBySlug.get(slug)!, managerId } });
    const rValorant = await mkRoster('Twisted Minds Valorant', 'valorant', khalid.id);
    const rCs2 = await mkRoster('Twisted Minds CS2', 'cs2', khalid.id);
    const rRl = await mkRoster('Twisted Minds Rocket League', 'rocket-league', khalid.id);
    const rPubg = await mkRoster('Twisted Minds PUBG', 'pubg', reem.id);
    const rFc = await mkRoster('Twisted Minds EA FC', 'ea-fc', reem.id);
    const rLol = await mkRoster('Twisted Minds LoL', 'lol', bandar.id);

    // ── Players ───────────────────────────────────────────────────────────────
    type PSpec = { roster: { id: string }; first: string; last: string; ign: string; jersey: number; userKey?: string };
    const playerSpecs: PSpec[] = [
      // Valorant (TM1 = the PLAYER login)
      { roster: rValorant, first: 'Faisal', last: 'Al-Harbi', ign: 'TM1', jersey: 7, userKey: 'PLAYER' },
      { roster: rValorant, first: 'Yousef', last: 'Al-Nasser', ign: 'TM2', jersey: 8 },
      { roster: rValorant, first: 'Mido', last: 'Kamal', ign: 'TM3', jersey: 9 },
      { roster: rValorant, first: 'Abdullah', last: 'Al-Qahtani', ign: 'tmRaze', jersey: 11 },
      { roster: rValorant, first: 'Saud', last: 'Al-Dosari', ign: 'tmJett', jersey: 14 },
      // CS2
      { roster: rCs2, first: 'Turki', last: 'Al-Shehri', ign: 'tmReaper', jersey: 1 },
      { roster: rCs2, first: 'Naif', last: 'Al-Ghamdi', ign: 'tmViper', jersey: 2 },
      { roster: rCs2, first: 'Majed', last: 'Al-Otaibi', ign: 'tmSpectre', jersey: 3 },
      { roster: rCs2, first: 'Rayan', last: 'Al-Mutairi', ign: 'tmBlaze', jersey: 4 },
      { roster: rCs2, first: 'Ziyad', last: 'Al-Subaie', ign: 'tmFrost', jersey: 5 },
      // Rocket League
      { roster: rRl, first: 'Fahad', last: 'Al-Anazi', ign: 'tmOnyx', jersey: 6 },
      { roster: rRl, first: 'Nawaf', last: 'Al-Zahrani', ign: 'tmPulse', jersey: 10 },
      { roster: rRl, first: 'Salman', last: 'Al-Harbi', ign: 'tmRogue', jersey: 12 },
      // PUBG (Reem)
      { roster: rPubg, first: 'Hassan', last: 'Al-Amri', ign: 'tmEcho', jersey: 21 },
      { roster: rPubg, first: 'Omar', last: 'Al-Faraj', ign: 'tmDrift', jersey: 22 },
      { roster: rPubg, first: 'Bader', last: 'Al-Khaldi', ign: 'tmCobra', jersey: 23 },
      { roster: rPubg, first: 'Khaled', last: 'Al-Sahli', ign: 'tmAce', jersey: 24 },
      // EA FC (Reem)
      { roster: rFc, first: 'Sultan', last: 'Al-Dosari', ign: 'tmGhost', jersey: 7 },
      { roster: rFc, first: 'Waleed', last: 'Al-Shehri', ign: 'tmStorm', jersey: 10 },
      // LoL (Bandar)
      { roster: rLol, first: 'Ibrahim', last: 'Al-Ghamdi', ign: 'tmComet', jersey: 1 },
      { roster: rLol, first: 'Mansour', last: 'Al-Mutairi', ign: 'tmHex', jersey: 2 },
      { roster: rLol, first: 'Talal', last: 'Al-Subaie', ign: 'tmNyx', jersey: 3 },
      { roster: rLol, first: 'Rakan', last: 'Al-Harbi', ign: 'tmFlux', jersey: 4 },
      { roster: rLol, first: 'Ali', last: 'Al-Balawi', ign: 'tmQuasar', jersey: 5 },
    ];

    const players = new Map<string, { id: string; rosterId: string; ign: string }>();
    for (const p of playerSpecs) {
      const row = await tx.player.create({
        data: {
          organizationId: orgId,
          rosterId: p.roster.id,
          userId: p.userKey ? userBy.get(p.userKey) : null,
          firstName: p.first,
          lastName: p.last,
          inGameName: p.ign,
          jerseyNumber: p.jersey,
          dateOfBirth: new Date(2002 + (p.jersey % 6), p.jersey % 12, ((p.jersey * 3) % 27) + 1),
        },
      });
      players.set(p.ign, { id: row.id, rosterId: p.roster.id, ign: p.ign });
    }
    const P = (ign: string) => players.get(ign)!;
    const allPlayers = Array.from(players.values());

    // ── Contracts + base salaries + merch + entitlements (all rostered) ───────
    const SAR = 'SAR';
    let salaryTier = 0;
    for (const pl of allPlayers) {
      const base = 8000 + (salaryTier % 6) * 2500; // 8k–20.5k spread
      salaryTier += 1;
      const isStarter = pl.ign === 'TM1' || pl.ign === 'tmReaper' || pl.ign === 'tmComet';
      await tx.contract.create({
        data: {
          organizationId: orgId,
          playerId: pl.id,
          status: 'ACTIVE',
          startDate: months(-8),
          endDate: months(isStarter ? 10 : 6),
          salaryAmount: isStarter ? base + 7000 : base,
          currency: SAR,
          buyout: isStarter ? 250000 : 80000,
          prizeSplitPct: 10,
          notes: isStarter ? 'Starter — renewal priority' : null,
        },
      });
      await tx.salary.create({ data: { organizationId: orgId, playerId: pl.id, amount: isStarter ? base + 7000 : base, currency: SAR, effectiveFrom: months(-8) } });
      await tx.merchSizeProfile.create({
        data: { organizationId: orgId, playerId: pl.id, jerseySize: ['S', 'M', 'L', 'XL'][pl.id.charCodeAt(0) % 4], jacketSize: 'L', shoeSize: String(41 + (pl.id.charCodeAt(1) % 6)) },
      });
      await tx.jerseyEntitlement.create({ data: { organizationId: orgId, playerId: pl.id, season: '2026', allocated: 3, claimed: pl.ign === 'TM1' ? 1 : 0 } });
    }

    // A couple of non-active contracts for variety.
    await tx.contract.create({ data: { organizationId: orgId, playerId: P('tmJett').id, status: 'DRAFT', startDate: months(0), endDate: months(12), salaryAmount: 12000, currency: SAR } });
    await tx.contract.create({ data: { organizationId: orgId, playerId: P('tmStorm').id, status: 'EXPIRED', startDate: months(-20), endDate: months(-2), salaryAmount: 9000, currency: SAR } });

    // ── Performance records (Valorant + CS2) ──────────────────────────────────
    const perf: Array<{ ign: string; opp: string; metric: string; value: number; d: number }> = [
      { ign: 'TM1', opp: 'Team Vitality', metric: 'ACS', value: 268, d: -10 },
      { ign: 'TM1', opp: 'NAVI', metric: 'ACS', value: 241, d: -3 },
      { ign: 'TM2', opp: 'FNATIC', metric: 'ACS', value: 219, d: -10 },
      { ign: 'tmReaper', opp: 'G2', metric: 'Rating 2.0', value: 1.28, d: -7 },
      { ign: 'tmViper', opp: 'Astralis', metric: 'Rating 2.0', value: 1.12, d: -7 },
      { ign: 'tmComet', opp: 'T1', metric: 'KDA', value: 4.6, d: -5 },
    ];
    for (const r of perf) {
      await tx.performanceRecord.create({ data: { organizationId: orgId, playerId: P(r.ign).id, matchDate: days(r.d), opponent: r.opp, metric: r.metric, value: r.value } });
    }

    // ── Tournaments (mixed status, across rosters) ────────────────────────────
    const tourns = [
      { slug: 'valorant', roster: rValorant, name: 'Esports World Cup 2026', status: 'UPCOMING' as const, start: 2, pool: 1000000 },
      { slug: 'valorant', roster: rValorant, name: 'Gamers8 Qualifier', status: 'UPCOMING' as const, start: 1, pool: 250000 },
      { slug: 'valorant', roster: rValorant, name: 'VCT Challengers KSA', status: 'COMPLETED' as const, start: -2, place: 2, pool: 150000 },
      { slug: 'cs2', roster: rCs2, name: 'BLAST Open Riyadh', status: 'ONGOING' as const, start: 0, pool: 500000 },
      { slug: 'cs2', roster: rCs2, name: 'IEM Dammam', status: 'COMPLETED' as const, start: -4, place: 1, pool: 300000 },
      { slug: 'rocket-league', roster: rRl, name: 'RLCS MENA Major', status: 'UPCOMING' as const, start: 1, pool: 100000 },
      { slug: 'pubg', roster: rPubg, name: 'PMGC MENA', status: 'UPCOMING' as const, start: 3, pool: 400000 },
      { slug: 'ea-fc', roster: rFc, name: 'eChampions League', status: 'COMPLETED' as const, start: -1, place: 5, pool: 50000 },
      { slug: 'lol', roster: rLol, name: 'Arabian League Split 2', status: 'ONGOING' as const, start: 0, pool: 120000 },
    ];
    for (const t of tourns) {
      await tx.tournament.create({
        data: {
          organizationId: orgId,
          gameTitleId: titleBySlug.get(t.slug)!,
          rosterId: t.roster.id,
          name: t.name,
          status: t.status,
          startDate: months(t.start),
          endDate: t.status === 'COMPLETED' ? months(t.start) : null,
          placement: (t as { place?: number }).place ?? null,
          prizePool: t.pool,
          prizeCurrency: SAR,
        },
      });
    }

    // ── Schedules (varied types; keep practice/scrim ids for attendance) ──────
    const mkSched = (roster: { id: string }, type: string, title: string, d: number, hour: number) =>
      tx.schedule.create({ data: { organizationId: orgId, rosterId: roster.id, type: type as never, title, startAt: new Date(days(d).setHours(hour, 0, 0, 0)), endAt: new Date(days(d).setHours(hour + 2, 0, 0, 0)) } });
    const sPracticeV = await mkSched(rValorant, 'PRACTICE', 'Evening practice block', -1, 18);
    const sScrimV = await mkSched(rValorant, 'SCRIM', 'Scrim vs Twisted Minds Academy', 1, 20);
    const sPracticeC = await mkSched(rCs2, 'PRACTICE', 'Map pool practice', -2, 17);
    await mkSched(rValorant, 'PHOTOSHOOT', 'EWC media-day photoshoot', 3, 11);
    await mkSched(rValorant, 'MEETING', 'VOD review with coach', 0, 15);
    await mkSched(rValorant, 'MEDIA_DAY', 'Sponsor content day', 5, 10);
    await mkSched(rCs2, 'SCRIM', 'Bo3 scrim vs Falcons-tier', 2, 19);
    await mkSched(rRl, 'PRACTICE', 'Freeplay + rotations', -1, 16);
    await mkSched(rLol, 'REVIEW', 'Draft review session', 1, 14);
    await mkSched(rPubg, 'PRACTICE', 'Drop-spot drills', 0, 13);

    // ── Attendance (some tied to a practice session; all statuses) ────────────
    const att = [
      { ign: 'TM1', sched: sPracticeV.id, type: 'PRESENT', d: -1 },
      { ign: 'TM2', sched: sPracticeV.id, type: 'TARDINESS', d: -1, late: 15, reason: 'Traffic' },
      { ign: 'TM3', sched: sPracticeV.id, type: 'EXCUSED', d: -1, reason: 'Doctor appointment' },
      { ign: 'tmRaze', sched: sScrimV.id, type: 'PRESENT', d: 1 },
      { ign: 'tmReaper', sched: sPracticeC.id, type: 'PRESENT', d: -2 },
      { ign: 'tmViper', sched: sPracticeC.id, type: 'ABSENCE', d: -2, reason: 'No-show' },
      { ign: 'tmFrost', sched: null, type: 'TARDINESS', d: -3, late: 10, reason: 'Overslept' },
      { ign: 'tmComet', sched: null, type: 'PRESENT', d: -1 },
    ] as Array<{ ign: string; sched: string | null; type: string; d: number; late?: number; reason?: string }>;
    for (const a of att) {
      await tx.attendance.create({
        data: { organizationId: orgId, playerId: P(a.ign).id, scheduleId: a.sched, type: a.type as never, date: days(a.d), minutesLate: a.late ?? null, reason: a.reason ?? null },
      });
    }

    // ── Bootcamps ─────────────────────────────────────────────────────────────
    await tx.bootcamp.createMany({
      data: [
        { organizationId: orgId, name: 'Riyadh EWC Bootcamp', location: 'Riyadh', startDate: months(1), endDate: months(2), notes: 'Pre-EWC prep camp' },
        { organizationId: orgId, name: 'Istanbul Scrim Camp', location: 'Istanbul', startDate: months(2), endDate: months(3) },
        { organizationId: orgId, name: 'Berlin CS2 Bootcamp', location: 'Berlin', startDate: months(-1), endDate: months(-1) },
      ],
    });

    // ── Trips (+ flight options) ──────────────────────────────────────────────
    const trip1 = await tx.trip.create({ data: { organizationId: orgId, playerId: P('TM1').id, rosterId: rValorant.id, purpose: 'EWC travel', origin: 'Riyadh', destination: 'Riyadh', departAt: months(2), returnAt: months(2), status: 'BOOKED' } });
    await tx.flightOption.create({ data: { organizationId: orgId, tripId: trip1.id, airline: 'Saudia', flightNo: 'SV1021', departAt: months(2), arriveAt: months(2), price: 950, currency: SAR, selected: true } });
    await tx.trip.create({ data: { organizationId: orgId, playerId: P('tmReaper').id, rosterId: rCs2.id, purpose: 'IEM Dammam', origin: 'Riyadh', destination: 'Dammam', departAt: months(-4), returnAt: months(-4), status: 'COMPLETED' } });
    await tx.trip.create({ data: { organizationId: orgId, playerId: P('tmComet').id, rosterId: rLol.id, purpose: 'Bootcamp travel', origin: 'Jeddah', destination: 'Istanbul', departAt: months(2), status: 'REQUESTED' } });

    // ── Invoices (every status of the player→manager→finance flow) ────────────
    const inv = [
      { ign: 'TM1', num: 'INV-1001', amt: 5000, status: 'SUBMITTED', d: 0 },
      { ign: 'TM2', num: 'INV-1002', amt: 3200, status: 'MANAGER_APPROVED', d: -2, approver: 'MANAGER' },
      { ign: 'tmReaper', num: 'INV-1003', amt: 7500, status: 'PAID', d: -10, approver: 'MANAGER', paid: true },
      { ign: 'tmViper', num: 'INV-1004', amt: 2100, status: 'REJECTED', d: -5, reason: 'Missing receipt' },
      { ign: 'tmComet', num: 'INV-1005', amt: 4400, status: 'SENT', d: -1 },
      { ign: 'TM3', num: 'INV-1006', amt: 1800, status: 'SUBMITTED', d: 0 },
    ] as Array<{ ign: string; num: string; amt: number; status: string; d: number; approver?: string; paid?: boolean; reason?: string }>;
    for (const v of inv) {
      await tx.invoice.create({
        data: {
          organizationId: orgId,
          playerId: P(v.ign).id,
          number: v.num,
          amount: v.amt,
          currency: SAR,
          status: v.status as never,
          issuedAt: days(v.d),
          dueAt: days(v.d + 30),
          paidAt: v.paid ? days(v.d + 5) : null,
          createdById: P(v.ign).ign === 'TM1' ? userBy.get('PLAYER')! : null,
          approvedById: v.approver ? userBy.get('MANAGER')! : null,
          approvedAt: v.approver ? days(v.d + 1) : null,
          rejectionReason: v.reason ?? null,
        },
      });
    }

    // ── Department requests (direct, varied) ──────────────────────────────────
    const reqs = [
      { type: 'TECHNICAL_SERVICE', title: 'New 240Hz monitor for TM1', desc: 'Current monitor flickers during scrims.', prio: 'HIGH', status: 'NEW', dept: 'IT', requester: 'PLAYER', due: 1 },
      { type: 'MERCH', title: 'Extra training jerseys — Valorant', desc: '5 sets for the bootcamp.', prio: 'MEDIUM', status: 'IN_PROGRESS', dept: 'MERCH', requester: 'MANAGER', due: 2 },
      { type: 'TRAVEL', title: 'Visa support for Istanbul camp', desc: 'Two players need invitation letters.', prio: 'HIGH', status: 'NEW', dept: 'AVIATION', requester: 'MANAGER', due: 1 },
      { type: 'PHOTOGRAPHY', title: 'Roster announcement content', desc: 'Need hero shots before EWC.', prio: 'MEDIUM', status: 'DONE', dept: 'MARCOM', requester: 'MANAGER', due: -1 },
      { type: 'GENERAL', title: 'Reimburse peripherals', desc: 'Mouse + mousepad bought for TM3.', prio: 'LOW', status: 'NEW', dept: 'FINANCE', requester: 'PLAYER', due: 3 },
    ] as Array<{ type: string; title: string; desc: string; prio: string; status: string; dept: string; requester: string; due: number }>;
    for (const r of reqs) {
      await tx.request.create({
        data: {
          organizationId: orgId,
          type: r.type as never,
          title: r.title,
          description: r.desc,
          priority: r.prio as never,
          status: r.status as never,
          requesterUserId: userBy.get(r.requester)!,
          targetDepartmentId: departmentIdByType.get(r.dept as never),
          dueDate: days(r.due),
        },
      });
    }

    // ── Tasks (kanban across all columns) ─────────────────────────────────────
    const tasks = [
      { title: 'Renew Faisal (TM1) contract before expiry', desc: 'Opens in ~10 months — start talks.', prio: 'HIGH', status: 'TODO', assignee: 'MANAGER', due: 14 },
      { title: 'Finalize EWC roster submission', desc: 'Submit 5+1 to the organizer.', prio: 'URGENT', status: 'IN_PROGRESS', assignee: 'MANAGER', due: 5 },
      { title: 'Approve CS2 travel manifest', desc: 'Aviation needs sign-off.', prio: 'MEDIUM', status: 'BLOCKED', assignee: 'LEADERSHIP', due: 3 },
      { title: 'Publish IEM Dammam win recap', desc: 'Marcom content piece.', prio: 'MEDIUM', status: 'DONE', assignee: 'MARCOM', due: -2 },
      { title: 'Review Q2 payroll adjustments', desc: 'Winnings + cuts reconciliation.', prio: 'HIGH', status: 'TODO', assignee: 'FINANCE', due: 7 },
    ] as Array<{ title: string; desc: string; prio: string; status: string; assignee: string; due: number }>;
    for (const t of tasks) {
      await tx.task.create({
        data: {
          organizationId: orgId,
          title: t.title,
          description: t.desc,
          priority: t.prio as never,
          status: t.status as never,
          creatorUserId: adminUserId,
          assigneeUserId: userBy.get(t.assignee)!,
          dueDate: days(t.due),
        },
      });
    }

    // ── Notifications (a few per key user) ────────────────────────────────────
    const notes = [
      { user: 'MANAGER', type: 'GENERIC', title: 'Awaiting your approval: Kit "TM1" · TM1' },
      { user: 'MANAGER', type: 'TASK_ASSIGNED', title: 'Assigned: Finalize EWC roster submission' },
      { user: 'PLAYER', type: 'REQUEST_STATUS', title: 'Approved: Roster announcement content', read: true },
      { user: 'LEADERSHIP', type: 'GENERIC', title: 'Awaiting your approval: Travel · Istanbul' },
      { user: 'FINANCE', type: 'GENERIC', title: 'Invoice MANAGER_APPROVED: INV-1002' },
      { user: 'MARCOM', type: 'GENERIC', title: 'Approved — ready to action: Sponsor content day' },
    ] as Array<{ user: string; type: string; title: string; read?: boolean }>;
    for (const n of notes) {
      await tx.notification.create({ data: { organizationId: orgId, userId: userBy.get(n.user)!, type: n.type as never, title: n.title, readAt: n.read ? days(-1) : null } });
    }

    // ── Workflow items — the approval engine showcase (every type & state) ────
    // steps builder: first `approved` steps APPROVED (by approver), rest PENDING.
    const stepsFor = (chain: string[], approved: number, approverId?: string) =>
      chain.map((role, i) => (i < approved ? { role, status: 'APPROVED', actorUserId: approverId ?? null, decidedAt: iso(days(-(approved - i))) } : { role, status: 'PENDING' }));
    const wf = (o: {
      type: string; title: string; status: string; chain: string[]; approved: number; executorRole?: string | null;
      requester: string; subjectRosterId?: string; subjectPlayerId?: string; targetDepartmentId?: string; payload?: unknown; approver?: string;
    }) =>
      tx.workflowItem.create({
        data: {
          organizationId: orgId,
          type: o.type as never,
          title: o.title,
          status: o.status as never,
          requesterUserId: userBy.get(o.requester)!,
          subjectRosterId: o.subjectRosterId ?? null,
          subjectPlayerId: o.subjectPlayerId ?? null,
          targetDepartmentId: o.targetDepartmentId ?? null,
          steps: J(stepsFor(o.chain, o.approved, o.approver ? userBy.get(o.approver)! : undefined)),
          currentStep: Math.min(o.approved, Math.max(0, o.chain.length - 1)),
          executorRole: o.executorRole ?? null,
          payload: o.payload ? J(o.payload) : undefined,
        },
      });

    // MERCH_KIT: pending @ team manager (Khalid) / approved → Merch / completed
    await wf({ type: 'MERCH_KIT', title: 'Kit "TM1" · TM1', status: 'PENDING', chain: ['TEAM_MANAGER'], approved: 0, executorRole: 'MERCH', requester: 'PLAYER', subjectRosterId: rValorant.id, subjectPlayerId: P('TM1').id, payload: { jerseyName: 'TM1', kitType: 'JERSEY', size: 'L', season: '2026' } });
    await wf({ type: 'MERCH_KIT', title: 'Kit "VIPER" · tmViper', status: 'APPROVED', chain: ['TEAM_MANAGER'], approved: 1, approver: 'MANAGER', executorRole: 'MERCH', requester: 'MANAGER', subjectRosterId: rCs2.id, subjectPlayerId: P('tmViper').id, payload: { jerseyName: 'VIPER', kitType: 'JERSEY', size: 'M', season: '2026' } });
    await wf({ type: 'MERCH_KIT', title: 'Kit "ONYX" · tmOnyx', status: 'COMPLETED', chain: ['TEAM_MANAGER'], approved: 1, approver: 'MANAGER', executorRole: 'MERCH', requester: 'MANAGER', subjectRosterId: rRl.id, subjectPlayerId: P('tmOnyx').id, payload: { jerseyName: 'ONYX', kitType: 'JACKET', size: 'L', season: '2026' } });

    // TRAVEL: pending @ esports / approved → aviation / completed with booking
    const travelPayload = (dep: string, dest: string, pax: string[]) => ({ departure: dep, destination: dest, hotelNeeded: true, passengers: pax.map((n) => ({ name: n })), departAt: iso(months(2)), returnAt: iso(months(2)), notes: 'Team travel' });
    await wf({ type: 'TRAVEL', title: 'Travel · Istanbul', status: 'PENDING', chain: ['ESPORTS_MANAGER'], approved: 0, executorRole: 'AVIATION', requester: 'MANAGER', subjectRosterId: rLol.id, payload: travelPayload('Jeddah (JED)', 'Istanbul (IST)', ['tmComet', 'tmHex']) });
    await wf({ type: 'TRAVEL', title: 'Travel · Dammam', status: 'APPROVED', chain: ['ESPORTS_MANAGER'], approved: 1, approver: 'LEADERSHIP', executorRole: 'AVIATION', requester: 'MANAGER', subjectRosterId: rCs2.id, payload: travelPayload('Riyadh (RUH)', 'Dammam (DMM)', ['tmReaper', 'tmViper', 'tmSpectre']) });
    await wf({ type: 'TRAVEL', title: 'Travel · Riyadh EWC', status: 'COMPLETED', chain: ['ESPORTS_MANAGER'], approved: 1, approver: 'LEADERSHIP', executorRole: 'AVIATION', requester: 'MANAGER', subjectRosterId: rValorant.id, payload: { ...travelPayload('Jeddah (JED)', 'Riyadh (RUH)', ['TM1', 'TM2', 'TM3']), booking: { airline: 'Saudia', flightNo: 'SV1021', departAt: iso(months(2)), arriveAt: iso(months(2)), price: 950, currency: SAR, hotelName: 'Fairmont Riyadh' } } });

    // PHOTO: pending @ esports / marcom-initiated pending @ team mgr / completed
    await wf({ type: 'PHOTO', title: 'PHOTOSHOOT · Twisted Minds Valorant', status: 'PENDING', chain: ['ESPORTS_MANAGER'], approved: 0, executorRole: 'MARCOM', requester: 'MANAGER', subjectRosterId: rValorant.id, payload: { kind: 'PHOTOSHOOT', event: 'EWC roster reveal', deadline: iso(months(1)), notes: 'Hero shots', rosterName: 'Twisted Minds Valorant' } });
    await wf({ type: 'PHOTO', title: 'MEDIA DAY · Twisted Minds CS2', status: 'PENDING', chain: ['ESPORTS_MANAGER', 'TEAM_MANAGER'], approved: 1, approver: 'LEADERSHIP', executorRole: 'MARCOM', requester: 'MARCOM', subjectRosterId: rCs2.id, payload: { kind: 'MEDIA_DAY', event: 'Sponsor day', deadline: iso(months(1)), notes: 'Marcom-initiated', rosterName: 'Twisted Minds CS2' } });
    await wf({ type: 'PHOTO', title: 'CONTENT · Twisted Minds LoL', status: 'COMPLETED', chain: ['ESPORTS_MANAGER'], approved: 1, approver: 'LEADERSHIP', executorRole: 'MARCOM', requester: 'MANAGER', subjectRosterId: rLol.id, payload: { kind: 'CONTENT', event: 'Split 2 promo', rosterName: 'Twisted Minds LoL' } });

    // SALARY_ADJUSTMENT: pending @ esports / two COMPLETED (feed payroll for TM1)
    await wf({ type: 'SALARY_ADJUSTMENT', title: `Winning +5000 ${SAR} · TM1 · ${period(0)}`, status: 'PENDING', chain: ['ESPORTS_MANAGER'], approved: 0, requester: 'MANAGER', subjectRosterId: rValorant.id, subjectPlayerId: P('TM1').id, payload: { kind: 'WINNING', amount: 5000, currency: SAR, period: period(0), reason: 'VCT Challengers prize share', playerName: 'TM1' } });
    await wf({ type: 'SALARY_ADJUSTMENT', title: `Winning +8000 ${SAR} · tmReaper · ${period(0)}`, status: 'COMPLETED', chain: ['ESPORTS_MANAGER'], approved: 1, approver: 'LEADERSHIP', requester: 'MANAGER', subjectRosterId: rCs2.id, subjectPlayerId: P('tmReaper').id, payload: { kind: 'WINNING', amount: 8000, currency: SAR, period: period(0), reason: 'IEM Dammam 1st place', playerName: 'tmReaper' } });
    await wf({ type: 'SALARY_ADJUSTMENT', title: `Cut −500 ${SAR} · TM2 · ${period(0)}`, status: 'COMPLETED', chain: ['ESPORTS_MANAGER'], approved: 1, approver: 'LEADERSHIP', requester: 'MANAGER', subjectRosterId: rValorant.id, subjectPlayerId: P('TM2').id, payload: { kind: 'CUT', amount: 500, currency: SAR, period: period(0), reason: 'Missed practice', playerName: 'TM2' } });

    // REQUEST (engine-gated player request): pending @ team manager (Khalid)
    await wf({ type: 'REQUEST', title: 'New mousepad for TM1', status: 'PENDING', chain: ['TEAM_MANAGER'], approved: 0, requester: 'PLAYER', subjectRosterId: rValorant.id, targetDepartmentId: departmentIdByType.get('MANAGEMENT'), payload: { requestType: 'GENERAL', description: 'Current one is worn out', priority: 'LOW', targetDepartmentId: departmentIdByType.get('MANAGEMENT'), departmentName: 'Management', dueDate: null } });

    // ── Match results (feed roster win rates) ─────────────────────────────────
    const matches: Array<{ roster: { id: string }; kind: 'SCRIM' | 'OFFICIAL'; opp: string; us: number; them: number; d: number }> = [
      { roster: rValorant, kind: 'OFFICIAL', opp: 'Team Vitality', us: 2, them: 1, d: -12 },
      { roster: rValorant, kind: 'OFFICIAL', opp: 'NAVI', us: 0, them: 2, d: -5 },
      { roster: rValorant, kind: 'SCRIM', opp: 'TM Academy', us: 13, them: 7, d: -2 },
      { roster: rValorant, kind: 'SCRIM', opp: 'Falcons', us: 13, them: 11, d: -1 },
      { roster: rCs2, kind: 'OFFICIAL', opp: 'G2', us: 2, them: 0, d: -20 },
      { roster: rCs2, kind: 'OFFICIAL', opp: 'Astralis', us: 2, them: 1, d: -9 },
      { roster: rCs2, kind: 'SCRIM', opp: 'Eternal Fire', us: 10, them: 13, d: -3 },
      { roster: rRl, kind: 'OFFICIAL', opp: 'Team BDS', us: 3, them: 4, d: -15 },
      { roster: rLol, kind: 'OFFICIAL', opp: 'T1 Academy', us: 1, them: 1, d: -6 },
      { roster: rPubg, kind: 'SCRIM', opp: 'Regional lobby', us: 24, them: 18, d: -4 },
    ];
    for (const m of matches) {
      await tx.matchResult.create({
        data: { organizationId: orgId, rosterId: m.roster.id, kind: m.kind, opponent: m.opp, ourScore: m.us, theirScore: m.them, playedAt: days(m.d), createdById: userBy.get('MANAGER') },
      });
    }

    // ── Announcements (org feed) ──────────────────────────────────────────────
    await tx.announcement.create({
      data: { organizationId: orgId, title: 'EWC 2026 bootcamp confirmed', body: 'Riyadh bootcamp locked for all rosters ahead of the Esports World Cup. Travel forms go out this week — watch your approvals inbox.', pinned: true, authorUserId: userBy.get('LEADERSHIP')! },
    });
    await tx.announcement.create({
      data: { organizationId: orgId, title: 'IEM Dammam champions 🏆', body: 'Huge congratulations to the CS2 roster on taking IEM Dammam — 1st place and a 300k SAR prize pool. Winnings will show in this month\'s payroll.', pinned: false, authorUserId: userBy.get('LEADERSHIP')! },
    });
    await tx.announcement.create({
      data: { organizationId: orgId, title: 'New jersey drop — sizes needed', body: 'Merch is collecting sizes for the 2026 third kit. Players: check your size profile is current before Friday.', pinned: false, authorUserId: userBy.get('MANAGER')! },
    });
  });

  // ── Second org (org switcher + cross-tenant isolation demo) ─────────────────
  const nova = await provisionOrganization({
    orgName: 'Nova Esports',
    slug: 'nova',
    country: 'SA',
    adminEmail: 'owner@nova.gg',
    adminName: 'Nova Owner',
    adminPassword: DEMO_PASSWORD,
  });
  await withOrgTx(nova.organizationId, async (tx) => {
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

  console.log('\n✔ Seed complete. "Twisted Minds" (slug: twisminds) — 6 rosters, 24 players, full module data + workflow items in every state.');
  console.log('  + second org "Nova Esports" — superadmin@twisminds.gg belongs to both (try the org switcher).');
  console.log(`  All accounts share password: ${DEMO_PASSWORD}\n`);
  for (const email of [
    'superadmin@twisminds.gg (SUPER_ADMIN)',
    'it@twisminds.gg (IT)',
    'leadership@twisminds.gg (LEADERSHIP)',
    'manager@twisminds.gg (MANAGER — owns Valorant/CS2/Rocket League)',
    'player@twisminds.gg (PLAYER — TM1, Valorant)',
    'marcom@twisminds.gg (MARCOM)',
    'aviation@twisminds.gg (AVIATION)',
    'merch@twisminds.gg (MERCH)',
    'finance@twisminds.gg (FINANCE)',
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
