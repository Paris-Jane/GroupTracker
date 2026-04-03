import type { CSSProperties } from 'react';
import type { GroupMember } from '../../../types';
import { memberChipColor } from '../../Tasks/TaskFilters';
import PickScoreDisplay from './PickScoreDisplay';

export interface PickCandidateRowProps {
  member: GroupMember;
  taskName: string;
  rating: number | null;
  isRecommended: boolean;
  isAssigned: boolean;
  disabled: boolean;
  busy: boolean;
  onToggle: () => void;
}

export default function PickCandidateRow({
  member,
  taskName,
  rating,
  isRecommended,
  isAssigned,
  disabled,
  busy,
  onToggle,
}: PickCandidateRowProps) {
  const bg = memberChipColor(member);
  const initial = (member.avatarInitial ?? member.name.charAt(0) ?? '?').toUpperCase();
  const assignAction = isAssigned ? 'Unassign' : 'Assign';
  const label = `${assignAction} ${member.name} ${isAssigned ? 'from' : 'to'} ${taskName}`;

  return (
    <button
      type="button"
      className={`pick-results-row${isRecommended ? ' pick-results-row--recommended' : ''}${isAssigned ? ' pick-results-row--assigned' : ''}${busy ? ' pick-results-row--busy' : ''}`}
      style={{ '--pick-row-accent': bg } as CSSProperties}
      disabled={disabled || busy}
      aria-label={label}
      aria-pressed={isAssigned}
      onClick={onToggle}
    >
      <span className="pick-results-row-avatar" aria-hidden>
        <span className="pick-results-row-avatar-circle" style={{ backgroundColor: bg, color: '#fff' }}>
          {initial}
        </span>
      </span>
      <span className="pick-results-row-main">
        <span className="pick-results-row-name-line">
          <span className="pick-results-row-name">{member.name}</span>
          {isRecommended ? (
            <span className="pick-results-row-badge">Best fit</span>
          ) : null}
          {isAssigned ? (
            <span className="pick-results-row-assigned-mark" aria-hidden title="Assigned">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path
                  d="M13.5 4.5L6.5 11.5L3 8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          ) : null}
        </span>
        <PickScoreDisplay rating={rating} />
      </span>
    </button>
  );
}
