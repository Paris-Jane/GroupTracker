import { pokerModeValue, type PokerVoteRow } from '../../../api/client';
import type { GroupMember } from '../../../types';

export interface PokerMemberCell {
  memberId: number;
  memberName: string;
  value: number | null;
}

export interface PokerResultsRow {
  taskId: number;
  byMember: PokerMemberCell[];
  mode: number | null;
  modeMemberIds: number[];
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
    const mode = pokerModeValue(byMember.map(x => ({ value: x.value })));
    const modeMemberIds =
      mode == null ? [] : byMember.filter(x => x.value === mode).map(x => x.memberId);
    return { taskId, byMember, mode, modeMemberIds };
  });
}

/** Consensus voters first, then other votes (high → low), then no vote. */
export function sortPokerMembersForDisplay(cells: PokerMemberCell[], modeMemberIds: number[]): PokerMemberCell[] {
  const consensus = new Set(modeMemberIds);
  return [...cells].sort((a, b) => {
    const aC = consensus.has(a.memberId);
    const bC = consensus.has(b.memberId);
    if (aC && !bC) return -1;
    if (!aC && bC) return 1;
    const av = a.value;
    const bv = b.value;
    if (av == null && bv == null) return a.memberName.localeCompare(b.memberName);
    if (av == null) return 1;
    if (bv == null) return -1;
    if (bv !== av) return bv - av;
    return a.memberName.localeCompare(b.memberName);
  });
}

export function formatConsensusSummary(
  mode: number | null,
  modeMemberIds: number[],
  nameById: Map<number, string>,
  hasAnyVote: boolean,
): string {
  if (!hasAnyVote) return 'No votes yet';
  if (mode == null || modeMemberIds.length === 0) return 'No consensus yet';
  const names = modeMemberIds.map(id => nameById.get(id) ?? `Teammate #${id}`);
  if (names.length === 1) return `Consensus: ${mode} (${names[0]})`;
  return `Consensus: ${mode} (${names.join(', ')})`;
}

export function formatEvaluationFooter(evaluation: number | undefined, matchingNames: string[]): string {
  if (evaluation == null) return '';
  if (matchingNames.length === 0) return `Evaluation set to ${evaluation}`;
  if (matchingNames.length === 1) return `Evaluation set to ${evaluation} — matches ${matchingNames[0]}`;
  return `Evaluation set to ${evaluation} — matches ${matchingNames.join(', ')}`;
}
