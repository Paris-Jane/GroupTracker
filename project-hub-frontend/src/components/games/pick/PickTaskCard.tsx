import type { TaskItem, GroupMember } from '../../../types';
import { memberChipColor } from '../../Tasks/TaskFilters';
import PickCandidateRow from './PickCandidateRow';
import {
  formatAssignedFooter,
  formatBestFitSummary,
  pickMemberRecord,
  sameSortedMemberIds,
  sortPickMembersForDisplay,
  type PickResultsRow,
} from './pickResultsUtils';

export interface PickTaskCardProps {
  row: PickResultsRow;
  task: TaskItem;
  members: GroupMember[];
  /** Current working selection (draft or server). */
  selectedMemberIds: number[];
  serverMemberIds: number[];
  assignDirty: boolean;
  currentMemberId: number | null;
  savingAllAssignees: boolean;
  onToggleMember: (memberId: number) => void;
  onDiscardAssignees: () => void;
}

export default function PickTaskCard({
  row,
  task,
  members,
  selectedMemberIds,
  serverMemberIds,
  assignDirty,
  currentMemberId,
  savingAllAssignees,
  onToggleMember,
  onDiscardAssignees,
}: PickTaskCardProps) {
  const sorted = sortPickMembersForDisplay(row.byMember);
  const nameById = new Map(members.map(m => [m.id, m.name] as const));
  for (const c of row.byMember) {
    if (!nameById.has(c.memberId)) nameById.set(c.memberId, c.memberName);
  }
  const hasResponses = row.maxRating != null && row.topMemberIds.length > 0;
  const bestFitLine = formatBestFitSummary(row.topMemberIds, nameById, hasResponses);

  const assignedNames = selectedMemberIds
    .map(id => members.find(m => m.id === id)?.name ?? nameById.get(id) ?? `#${id}`)
    .sort((a, b) => a.localeCompare(b));
  const assignedLine = formatAssignedFooter(assignedNames);

  const canAssign = currentMemberId != null;
  const syncedWithServer = sameSortedMemberIds(selectedMemberIds, serverMemberIds);
  const showSavedHint = canAssign && !assignDirty && serverMemberIds.length > 0 && syncedWithServer;

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
          const isSelected = selectedMemberIds.includes(cell.memberId);
          return (
            <li key={cell.memberId} className="pick-results-candidate-item">
              <PickCandidateRow
                member={member}
                taskName={task.name}
                rating={cell.rating}
                isRecommended={isRecommended}
                isSelected={isSelected}
                disabled={!canAssign}
                savePending={savingAllAssignees}
                onToggle={() => onToggleMember(cell.memberId)}
              />
            </li>
          );
        })}
      </ul>
      <div className="pick-results-footer">
        {!canAssign ? (
          <p className="pick-results-footer-hint">Sign in to assign teammates to this task.</p>
        ) : (
          <>
            {selectedMemberIds.length > 0 ? (
              <div className="pick-results-footer-strip" aria-hidden>
                {selectedMemberIds.map(id => {
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
            ) : null}
            {assignedLine ? <p className="pick-results-footer-assigned">{assignedLine}</p> : null}
            {selectedMemberIds.length > 1 ? (
              <p className="pick-results-footer-count">{selectedMemberIds.length} people selected</p>
            ) : null}
            {assignDirty ? (
              <div className="pick-results-footer-actions flex gap-2 flex-wrap mt-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={savingAllAssignees}
                  onClick={onDiscardAssignees}
                >
                  Discard this task
                </button>
              </div>
            ) : (
              <p className="pick-results-footer-hint mt-2">
                {showSavedHint
                  ? 'Assignments saved.'
                  : 'Select teammates with the checkboxes, then use Save all assignees above.'}
              </p>
            )}
          </>
        )}
      </div>
    </li>
  );
}
