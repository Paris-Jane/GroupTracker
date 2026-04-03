import type { GroupMember } from '../types';

const ALLOWED = new Set(['paris', 'ethan', 'luke']);
const ORDER = ['paris', 'ethan', 'luke'];

/** Only these members appear in assignee lists, filters, and team UIs. */
export function filterVisibleMembers(members: GroupMember[]): GroupMember[] {
  return members
    .filter(m => ALLOWED.has(m.name.trim().toLowerCase()))
    .sort(
      (a, b) =>
        ORDER.indexOf(a.name.trim().toLowerCase()) - ORDER.indexOf(b.name.trim().toLowerCase()),
    );
}
