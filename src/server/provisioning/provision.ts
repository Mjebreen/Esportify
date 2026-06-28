import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { DepartmentType, Prisma, SystemRole } from '@prisma/client';
import { prisma } from '../db/client';
import { getActiveOrgId, withBootstrapTx, type TxClient } from '../db/tenant';
import { DEFAULT_ENABLED_MODULES, DEFAULT_ROLE_GRANTS, PERMISSION_CATALOG } from '../authz/catalog';

const SYSTEM_ROLE_DEFS: Array<{ systemRole: SystemRole; slug: string; name: string }> = [
  { systemRole: 'SUPER_ADMIN', slug: 'super-admin', name: 'Super Admin' },
  { systemRole: 'IT', slug: 'it', name: 'IT' },
  { systemRole: 'LEADERSHIP', slug: 'leadership', name: 'Esports Leadership' },
  { systemRole: 'MANAGER', slug: 'manager', name: 'Roster Manager' },
  { systemRole: 'PLAYER', slug: 'player', name: 'Player' },
  { systemRole: 'MARCOM', slug: 'marcom', name: 'Marcom' },
  { systemRole: 'AVIATION', slug: 'aviation', name: 'Aviation / Travel' },
  { systemRole: 'MERCH', slug: 'merch', name: 'Merch' },
  { systemRole: 'FINANCE', slug: 'finance', name: 'Finance' },
];

const DEPARTMENTS: Array<{ type: DepartmentType; name: string }> = [
  { type: 'ESPORTS', name: 'Esports' },
  { type: 'MANAGEMENT', name: 'Management' },
  { type: 'MARCOM', name: 'Marcom' },
  { type: 'AVIATION', name: 'Aviation' },
  { type: 'MERCH', name: 'Merch' },
  { type: 'IT', name: 'IT' },
  { type: 'FINANCE', name: 'Finance' },
];

/** Upsert the GLOBAL permission catalog (idempotent; not tenant-scoped). */
export async function ensurePermissionCatalog(): Promise<void> {
  for (const p of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { resource: p.resource, action: p.action, description: p.description },
      create: p,
    });
  }
}

async function seedRolesAndGrants(tx: TxClient, orgId: string): Promise<Map<SystemRole, string>> {
  const permissions = await tx.permission.findMany({ select: { id: true, key: true } });
  const permIdByKey = new Map(permissions.map((p) => [p.key, p.id]));
  const roleId = new Map<SystemRole, string>();

  for (const def of SYSTEM_ROLE_DEFS) {
    const role = await tx.role.create({
      data: { organizationId: orgId, slug: def.slug, name: def.name, systemRole: def.systemRole, isSystem: true },
    });
    roleId.set(def.systemRole, role.id);

    for (const grant of DEFAULT_ROLE_GRANTS[def.systemRole]) {
      const permissionId = permIdByKey.get(`${grant.resource}:${grant.action}`);
      if (!permissionId) throw new Error(`Permission not in catalog: ${grant.resource}:${grant.action}`);
      await tx.rolePermission.create({
        data: {
          organizationId: orgId,
          roleId: role.id,
          permissionId,
          scope: grant.scope,
          effect: 'ALLOW',
          phase: grant.phase ?? 1,
          constraints: grant.constraints ? (grant.constraints as Prisma.InputJsonValue) : undefined,
        },
      });
    }
  }
  return roleId;
}

export interface ProvisionInput {
  orgName: string;
  slug: string;
  country?: string;
  defaultLocale?: string;
  defaultDir?: 'ltr' | 'rtl';
  adminEmail: string;
  adminName: string;
  adminPassword: string;
}

export interface ProvisionResult {
  organizationId: string;
  adminUserId: string;
  roleIdBySystemRole: Map<SystemRole, string>;
  departmentIdByType: Map<DepartmentType, string>;
}

/**
 * THE canonical first-tenant bootstrap. Creates org + departments + the 8 system
 * roles + their permission grants + the first Super Admin, atomically. Self-serve
 * signup and ops-assisted provisioning both call this; it operates entirely within
 * the brand-new org's scope, preserving the no-cross-tenant invariant.
 */
export async function provisionOrganization(input: ProvisionInput): Promise<ProvisionResult> {
  await ensurePermissionCatalog();
  const passwordHash = await bcrypt.hash(input.adminPassword, 10);

  // Generate the org id up front and bind the GUC BEFORE the insert, so the
  // INSERT ... RETURNING is visible to the org SELECT policy (id = current GUC).
  const orgId = randomUUID();

  return withBootstrapTx(async (tx, setOrg) => {
    await setOrg(orgId);
    const org = await tx.organization.create({
      data: {
        id: orgId,
        name: input.orgName,
        slug: input.slug,
        country: input.country,
        defaultLocale: input.defaultLocale ?? 'en',
        defaultDir: input.defaultDir ?? 'ltr',
      },
    });

    const departmentIdByType = new Map<DepartmentType, string>();
    for (const d of DEPARTMENTS) {
      const dept = await tx.department.create({ data: { organizationId: org.id, type: d.type, name: d.name } });
      departmentIdByType.set(d.type, dept.id);
    }

    await tx.orgModule.createMany({
      data: DEFAULT_ENABLED_MODULES.map((module) => ({ organizationId: org.id, module, enabled: true })),
    });

    const roleIdBySystemRole = await seedRolesAndGrants(tx, org.id);

    const adminUser = await tx.user.upsert({
      where: { email: input.adminEmail },
      update: { name: input.adminName, passwordHash },
      create: { email: input.adminEmail, name: input.adminName, passwordHash, emailVerified: new Date() },
    });

    await tx.membership.create({
      data: {
        organizationId: org.id,
        userId: adminUser.id,
        roleId: roleIdBySystemRole.get('SUPER_ADMIN')!,
        departmentId: departmentIdByType.get('IT'),
        status: 'ACTIVE',
        isPrimary: true,
        createdById: adminUser.id,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: org.id,
        actorUserId: adminUser.id,
        action: 'CREATE',
        entity: 'Organization',
        entityId: org.id,
        after: { name: org.name, slug: org.slug },
      },
    });

    return { organizationId: org.id, adminUserId: adminUser.id, roleIdBySystemRole, departmentIdByType };
  });
}

export interface AddMemberInput {
  organizationId: string;
  email: string;
  name: string;
  password: string;
  roleId: string;
  departmentId?: string;
  isPrimary?: boolean;
}

/**
 * Create (or reuse) a global user and attach an ACTIVE membership in `organizationId`.
 * MUST run inside withOrgTx(organizationId) so the membership insert passes RLS.
 */
export async function addMember(tx: TxClient, input: AddMemberInput): Promise<string> {
  // Precondition: must run inside withOrgTx(input.organizationId). RLS WITH CHECK
  // already rejects a cross-org membership insert; this makes the misuse explicit.
  if (getActiveOrgId() !== input.organizationId) {
    throw new Error('addMember must run inside withOrgTx(input.organizationId)');
  }
  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await tx.user.upsert({
    where: { email: input.email },
    update: { name: input.name, passwordHash },
    create: { email: input.email, name: input.name, passwordHash, emailVerified: new Date() },
  });
  await tx.membership.upsert({
    where: {
      organizationId_userId_roleId: {
        organizationId: input.organizationId,
        userId: user.id,
        roleId: input.roleId,
      },
    },
    update: { status: 'ACTIVE' },
    create: {
      organizationId: input.organizationId,
      userId: user.id,
      roleId: input.roleId,
      departmentId: input.departmentId,
      status: 'ACTIVE',
      isPrimary: input.isPrimary ?? false,
    },
  });
  return user.id;
}
