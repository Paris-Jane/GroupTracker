import type { TaskItem, GroupMember } from '../../../types';
import { memberChipColor } from '../../Tasks/TaskFilters';
import PickCandidateRow from './PickCandidateRow';
import {
  formatAssignedFooter,
  formatBestFitSummary,
  pickMemberRecord,
  sortPickMembersForDisplay,
  type PickResultsRow,
} from './pickResultsUtils';

export interface PickTaskCardProps {
  row: PickResultsRow;
  task: TaskItem;
  members: GroupMember[];
  assignedMemberIds: number[];
  currentMemberId: number | null;
  assigning: boolean;
  onToggleAssign: (memberId: number) => void;
}

export default function PickTaskCard({
  row,
  task,
  members,
  assignedMemberIds,
  currentMemberId,
  assigning,
  onToggleAssign,
}: PickTaskCardProps) {
  const sorted = sortPickMembersForDisplay(row.byMember);
  const nameById = new Map(members.map(m => [m.id, m.name] as const));
  for (const c of row.byMember) {
    if (!nameById.has(c.memberId)) nameById.set(c.memberId, c.memberName);
  }
  const hasResponses = row.maxRating != null && row.topMemberIds.length > 0;
  const bestFitLine = formatBestFitSummary(row.topMemberIds, nameById, hasResponses);

  const assignedNames = assignedMemberIds
    .map(id => members.find(m => m.id === id)?.name ?? nameById.get(id) ?? `#${id}`)
    .sort((a, b) => a.localeCompare(b));
  const assignedLine = formatAssignedFooter(assignedNames);

  const canAssign = currentMemberId != null;

  return (
    <li className="pick-results-task-card">
      <div className="pick-results-task-head">
        <h3 className="pick-results-task-title">{task.name}</h3>
        <p className="pick-results-best-fit-summary">{bestFitLine}</p>
      </div>
      <ul className="pick-results-candidates">
        {sorted.map(cell => {
          const member = pickMemberRecord(members, cell.memberId, cell.memberName);
          const isRecommended = hasResponses && row.topMemberIds.includes(cell.memberId);
          const isAssigned = assignedMemberIds.includes(cell.memberId);
          return (
            <li key={cell.memberId} className="pick-results-candidate-item">
              <PickCandidateRow
                member={member}
                taskName={task.name}
                rating={cell.rating}
                isRecommended={isRecommended}
                isAssigned={isAssigned}
                disabled={!canAssign}
                busy={assigning}
                onToggle={() => onToggleAssign(cell.memberId)}
              />
            </li>
          );
        })}
      </ul>
      <div className="pick-results-footer">
        {!canAssign ? (
          <p className="pick-results-footer-hint">Sign in to assign teammates to this task.</p>
        ) : assignedLine ? (
          <>
            <div className="pick-results-footer-strip" aria-hidden>
              {assignedMemberIds.map(id => {
                const m = pickMemberRecord(members, id, nameById.get(id) ?? '');
                const c = memberChipColor(m);
                const ini = (m.avatarInitial ?? m.name.charAt(0) ?? '?').toUpperCase();
                return (
                  <span
                    key={id}
                    className="pick-results-footer-avatar"
                    style={{ backgroundColor: c, color: '#fff' }}
                    title={m.name}
                  >
                    {ini}
                  </span>
                );
              })}
            </div>
            <p className="pick-results-footer-assigned">{assignedLine}</p>
            {assignedMemberIds.length > 1 ? (
              <p className="pick-results-footer-count">{assignedMemberIds.length} people assigned</p>
            ) : null}
          </>
        ) : (
          <p className="pick-results-footer-hint">Click a teammate to assign</p>
        )}
      </div>
    </li>
  );
}
