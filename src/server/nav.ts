import { authorize } from './authz/gate';
import type { Action, Principal, Resource } from './authz/types';

export interface NavItem {
  key: string;
  href: string;
  labelKey: string;
}

const NAV_DEFS: Array<{ key: string; href: string; labelKey: string; resource: Resource; action: Action }> = [
  { key: 'players', href: '/players', labelKey: 'nav.players', resource: 'player', action: 'read' },
  { key: 'managers', href: '/managers', labelKey: 'nav.managers', resource: 'manager', action: 'read' },
];

/** Role-aware navigation: an item appears only if the principal can read it AND
 * its module is enabled for the tenant (both checked by authorize()). */
export function navFor(principal: Principal): NavItem[] {
  const items: NavItem[] = [{ key: 'dashboard', href: '/dashboard', labelKey: 'nav.dashboard' }];
  for (const def of NAV_DEFS) {
    if (authorize(principal, def.action, def.resource).allowed) {
      items.push({ key: def.key, href: def.href, labelKey: def.labelKey });
    }
  }
  return items;
}
