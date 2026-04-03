import type { PokerVoteRow } from '../../../api/client';
import type { GroupMember } from '../../../types';

export interface PokerMemberCell {
  memberId: number;
  memberName: string;
  value: number | null;
}

export interface PokerResultsRow {
  taskId: number;
  byMember: PokerMemberCell[];
  /** Arithmetic mean of non-null votes, or null if none. */
  average: number | null;
  /** Members whose vote is tied for smallest distance to `average`. */
  closestMemberIds: number[];
}

function averageAndClosest(byMember: PokerMemberCell[]): { average: number | null; closestMemberIds: number[] } {
  const vals = byMember.map(x => x.value).filter((x): x is number => x != null);
  if (vals.length === 0) return { average: null, closestMemberIds: [] };
  const sum = vals.reduce((a, b) => a + b, 0);
  const average = sum / vals.length;

  let bestDist = Infinity;
  for (const cell of byMember) {
    if (cell.value == null) continue;
    const d = Math.abs(cell.value - average);
    if (d < bestDist) bestDist = d;
  }
  if (bestDist === Infinity) return { average, closestMemberIds: [] };

  const closestMemberIds = byMember
    .filter(cell => cell.value != null && Math.abs(cell.value - average) === bestDist)
    .map(cell => cell.memberId);
  return { average, closestMemberIds };
}

export function aggregatePokerRows(
  queue: number[],
  votes: PokerVoteRow[],
  members: GroupMember[],
): PokerResultsRow[] {
  const byTask = new Map<number, Map<number, number | null>>();
  for (const tid of queue) byTask.set(tid, new Map());
  for (const v of votes) {
    const m = byTask.get(v.taskItemId);
    if (m) m.set(v.memberId, v.value);
  }
  return queue.map(taskId => {
    const m = byTask.get(taskId) ?? new Map();
    const byMember = members.map(mem => ({
      memberId: mem.id,
      memberName: mem.name,
      value: m.get(mem.id) ?? null,
    }));
    const { average, closestMemberIds } = averageAndClosest(byMember);
    return { taskId, byMember, average, closestMemberIds };
  });
}

/** Closest to team average first, then by distance, then no vote last. */
export function sortPokerMembersForDisplay(
  cells: PokerMemberCell[],
  average: number | null,
): PokerMemberCell[] {
  return [...cells].sort((a, b) => {
    const av = a.value;
    const bv = b.value;
    if (av == null && bv == null) return a.memberName.localeCompare(b.memberName);
    if (av == null) return 1;
    if (bv == null) return -1;
    if (average != null) {
      const da = Math.abs(av - average);
      const db = Math.abs(bv - average);
      if (da !== db) return da - db;
    }
    if (bv !== av) return av - bv;
    return a.memberName.localeCompare(b.memberName);
  });
}

function formatAverageNumber(average: number): string {
  const r = Math.round(average * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export function formatAverageSummary(
  average: number | null,
  closestMemberIds: number[],
  nameById: Map<number, string>,
  hasAnyVote: boolean,
): string {
  if (!hasAnyVote || average == null) return 'No votes yet';
  const avgStr = formatAverageNumber(average);
  if (closestMemberIds.length === 0) return `Team average: ${avgStr}`;
  const names = closestMemberIds.map(id => nameById.get(id) ?? `Teammate #${id}`);
  if (names.length === 1) return `Team average: ${avgStr} — closest: ${names[0]}`;
  return `Team average: ${avgStr} — closest: ${names.join(', ')}`;
}

export function formatEvaluationFooter(evaluation: number | undefined, matchingNames: string[]): string {
  if (evaluation == null) return '';
  if (matchingNames.length === 0) return `Evaluation set to ${evaluation}`;
  if (matchingNames.length === 1) return `Evaluation set to ${evaluation} — matches ${matchingNames[0]}`;
  return `Evaluation set to ${evaluation} — matches ${matchingNames.join(', ')}`;
}
