import type { GroupMember } from '../types';

/** Match full names (as in DB) or first name only. */
const ALLOWED_FULL = new Set(['paris ward', 'ethan wood', 'luke carr']);
const ALLOWED_FIRST = new Set(['paris', 'ethan', 'luke']);
const ORDER = ['paris', 'ethan', 'luke'];

function teamSortKey(m: GroupMember): string {
  const n = m.name.trim().toLowerCase();
  const first = n.split(/\s+/)[0] ?? '';
  return first;
}

function isTeamMember(m: GroupMember): boolean {
  const n = m.name.trim().toLowerCase();
  if (ALLOWED_FULL.has(n)) return true;
  const first = n.split(/\s+/)[0] ?? '';
  return ALLOWED_FIRST.has(first);
}

/** Only these members appear in assignee lists, filters, and team UIs. */
export function filterVisibleMembers(members: GroupMember[]): GroupMember[] {
  return members
    .filter(isTeamMember)
    .sort((a, b) => ORDER.indexOf(teamSortKey(a)) - ORDER.indexOf(teamSortKey(b)));
}
