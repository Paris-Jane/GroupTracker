import type { GroupMember } from '../types';

/** Client-side gate: admin account uses username `admin` (password checked at login). */
export function isAdminUser(member: GroupMember | null | undefined): boolean {
  return (member?.username ?? '').trim().toLowerCase() === 'admin';
}

/** Team members shown for assign / assignee filter (excludes admin login). */
export function assignableMembers(members: GroupMember[]): GroupMember[] {
  return members.filter(m => !isAdminUser(m));
}
