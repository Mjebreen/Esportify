import { authorize } from './authz/gate';
import type { Action, Principal, Resource } from './authz/types';

export interface NavItem {
  key: string;
  href: string;
  labelKey: string;
}

interface NavDef {
  key: string;
  href: string;
  labelKey: string;
  resource: Resource;
  action: Action;
  group: 'core' | 'asana' | 'manager' | 'leadership' | 'me';
}

const NAV_DEFS: NavDef[] = [
  // Leadership
  { key: 'overview', href: '/overview', labelKey: 'nav.overview', resource: 'contract', action: 'read', group: 'leadership' },
  { key: 'rosterCalculator', href: '/roster-calculator', labelKey: 'nav.rosterCalculator', resource: 'contract', action: 'read', group: 'leadership' },
  // Core master data
  { key: 'players', href: '/players', labelKey: 'nav.players', resource: 'player', action: 'read', group: 'core' },
  { key: 'managers', href: '/managers', labelKey: 'nav.managers', resource: 'manager', action: 'read', group: 'core' },
  // Asana layer
  { key: 'requests', href: '/requests', labelKey: 'nav.requests', resource: 'request', action: 'read', group: 'asana' },
  { key: 'tasks', href: '/tasks', labelKey: 'nav.tasks', resource: 'task', action: 'read', group: 'asana' },
  { key: 'calendar', href: '/calendar', labelKey: 'nav.calendar', resource: 'calendar', action: 'read', group: 'asana' },
  { key: 'media', href: '/media', labelKey: 'nav.media', resource: 'mediaAsset', action: 'read', group: 'asana' },
  // Manager workspace
  { key: 'tournaments', href: '/tournaments', labelKey: 'nav.tournaments', resource: 'tournament', action: 'read', group: 'manager' },
  { key: 'contracts', href: '/contracts', labelKey: 'nav.contracts', resource: 'contract', action: 'read', group: 'manager' },
  { key: 'salaries', href: '/salaries', labelKey: 'nav.salaries', resource: 'salary', action: 'read', group: 'manager' },
  { key: 'attendance', href: '/attendance', labelKey: 'nav.attendance', resource: 'attendance', action: 'read', group: 'manager' },
  { key: 'performance', href: '/performance', labelKey: 'nav.performance', resource: 'performance', action: 'read', group: 'manager' },
  { key: 'schedule', href: '/schedule', labelKey: 'nav.schedule', resource: 'schedule', action: 'read', group: 'manager' },
  { key: 'bootcamps', href: '/bootcamps', labelKey: 'nav.bootcamps', resource: 'bootcamp', action: 'read', group: 'manager' },
  { key: 'merch', href: '/merch', labelKey: 'nav.merch', resource: 'merchProfile', action: 'read', group: 'manager' },
  { key: 'trips', href: '/trips', labelKey: 'nav.trips', resource: 'trip', action: 'read', group: 'manager' },
  { key: 'invoices', href: '/invoices', labelKey: 'nav.invoices', resource: 'invoice', action: 'read', group: 'manager' },
  // Personal
  { key: 'portal', href: '/portal', labelKey: 'nav.portal', resource: 'invoice', action: 'read', group: 'me' },
];

/** Role-aware navigation: an item shows only if the principal can read it AND its
 * module is enabled for the tenant (both checked by authorize()). */
export function navFor(principal: Principal): NavItem[] {
  const items: NavItem[] = [
    { key: 'dashboard', href: '/dashboard', labelKey: 'nav.dashboard' },
    { key: 'approvals', href: '/approvals', labelKey: 'nav.approvals' }, // everyone has an inbox
  ];
  for (const def of NAV_DEFS) {
    if (authorize(principal, def.action, def.resource).allowed) {
      items.push({ key: def.key, href: def.href, labelKey: def.labelKey });
    }
  }
  items.push({ key: 'notifications', href: '/notifications', labelKey: 'nav.notifications' });
  return items;
}
