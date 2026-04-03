import type { TaskItem, GroupMember } from '../../../types';
import { pickMemberRecord } from '../pick/pickResultsUtils';
import PokerEstimateRow from './PokerEstimateRow';
import {
  formatAverageSummary,
  formatEvaluationFooter,
  sortPokerMembersForDisplay,
  type PokerResultsRow,
} from './pokerResultsUtils';

export interface PokerTaskCardProps {
  row: PokerResultsRow;
  task: TaskItem;
  /** Shown until parent task list catches up after apply (optional). */
  displayEvaluation?: number;
  members: GroupMember[];
  currentMemberId: number | null;
  applying: boolean;
  onApplyEstimate: (value: number) => void;
}

export default function PokerTaskCard({
  row,
  task,
  displayEvaluation,
  members,
  currentMemberId,
  applying,
  onApplyEstimate,
}: PokerTaskCardProps) {
  const sorted = sortPokerMembersForDisplay(row.byMember, row.average);
  const nameById = new Map(members.map(m => [m.id, m.name] as const));
  for (const c of row.byMember) {
    if (!nameById.has(c.memberId)) nameById.set(c.memberId, c.memberName);
  }
  const hasAnyVote = row.byMember.some(c => c.value != null);
  const averageLine = formatAverageSummary(row.average, row.closestMemberIds, nameById, hasAnyVote);

  const evalN = displayEvaluation !== undefined ? displayEvaluation : task.evaluation;
  const matchingNames = row.byMember
    .filter(c => c.value != null && c.value === evalN)
    .map(c => c.memberName)
    .sort((a, b) => a.localeCompare(b));
  const evalLine = formatEvaluationFooter(evalN, matchingNames);

  const canApply = currentMemberId != null;

  return (
    <li className="pick-results-task-card">
      <div className="pick-results-task-head">
        <h3 className="pick-results-task-title">{task.name}</h3>
        <p className="pick-results-best-fit-summary">{averageLine}</p>
      </div>
      <ul className="pick-results-candidates">
        {sorted.map(cell => {
          const member = pickMemberRecord(members, cell.memberId, cell.memberName);
          const isClosest = row.closestMemberIds.includes(cell.memberId);
          const isApplied = evalN != null && cell.value != null && cell.value === evalN;
          return (
            <li key={cell.memberId} className="pick-results-candidate-item">
              <PokerEstimateRow
                member={member}
                taskName={task.name}
                value={cell.value}
                isClosest={isClosest}
                isApplied={isApplied}
                disabled={!canApply}
                busy={applying}
                onApply={() => {
                  if (cell.value != null) onApplyEstimate(cell.value);
                }}
              />
            </li>
          );
        })}
      </ul>
      <div className="pick-results-footer">
        {!canApply ? (
          <p className="pick-results-footer-hint">Sign in to apply an estimate from the team&apos;s votes.</p>
        ) : evalLine ? (
          <p className="pick-results-footer-assigned">{evalLine}</p>
        ) : (
          <p className="pick-results-footer-hint">Click a teammate&apos;s estimate to apply it to this task</p>
        )}
      </div>
    </li>
  );
}
