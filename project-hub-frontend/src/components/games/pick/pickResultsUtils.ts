import type { PickRatingRow } from '../../../api/client';
import type { GroupMember } from '../../../types';

export interface PickMemberCell {
  memberId: number;
  memberName: string;
  rating: number | null;
}

export interface PickResultsRow {
  taskId: number;
  byMember: PickMemberCell[];
  maxRating: number | null;
  topMemberIds: number[];
}

export function aggregatePickRows(queue: number[], ratings: PickRatingRow[], members: GroupMember[]): PickResultsRow[] {
  const byTask = new Map<number, Map<number, number | null>>();
  for (const tid of queue) byTask.set(tid, new Map());
  for (const r of ratings) {
    const m = byTask.get(r.taskItemId);
    if (m) m.set(r.memberId, r.rating);
  }
  return queue.map(taskId => {
    const m = byTask.get(taskId) ?? new Map();
    const byMember = members.map(mem => ({
      memberId: mem.id,
      memberName: mem.name,
      rating: m.get(mem.id) ?? null,
    }));
    const numeric = byMember.map(x => x.rating).filter((x): x is number => x != null);
    const maxRating = numeric.length ? Math.max(...numeric) : null;
    const topMemberIds =
      maxRating == null ? [] : byMember.filter(x => x.rating === maxRating).map(x => x.memberId);
    return { taskId, byMember, maxRating, topMemberIds };
  });
}

export function sortPickMembersForDisplay(cells: PickMemberCell[]): PickMemberCell[] {
  return [...cells].sort((a, b) => {
    const ar = a.rating;
    const br = b.rating;
    if (ar == null && br == null) return a.memberName.localeCompare(b.memberName);
    if (ar == null) return 1;
    if (br == null) return -1;
    if (br !== ar) return br - ar;
    return a.memberName.localeCompare(b.memberName);
  });
}

export function formatBestFitSummary(topMemberIds: number[], memberNames: Map<number, string>, hasResponses: boolean): string {
  if (!hasResponses || topMemberIds.length === 0) return 'No responses yet';
  const names = topMemberIds.map(id => memberNames.get(id) ?? `Teammate #${id}`);
  if (names.length === 1) return `Best fit: ${names[0]}`;
  return `Best fit: ${names.join(', ')}`;
}

export function formatAssignedFooter(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return `Assigned to ${names[0]}`;
  if (names.length === 2) return `Assigned to ${names[0]} and ${names[1]}`;
  const head = names.slice(0, -1).join(', ');
  const tail = names[names.length - 1];
  return `Assigned to ${head}, and ${tail}`;
}

export function pickMemberRecord(members: GroupMember[], memberId: number, fallbackName: string): GroupMember {
  const m = members.find(x => x.id === memberId);
  if (m) return m;
  return {
    id: memberId,
    name: fallbackName,
    avatarInitial: (fallbackName.charAt(0) || '?').toUpperCase(),
  };
}
