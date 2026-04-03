import type { CSSProperties } from 'react';
import type { GroupMember } from '../../../types';
import { memberChipColor } from '../../Tasks/TaskFilters';
import PickScoreDisplay from './PickScoreDisplay';

export interface PickCandidateRowProps {
  member: GroupMember;
  taskName: string;
  rating: number | null;
  isRecommended: boolean;
  isSelected: boolean;
  disabled: boolean;
  savePending: boolean;
  onToggle: () => void;
}

export default function PickCandidateRow({
  member,
  taskName,
  rating,
  isRecommended,
  isSelected,
  disabled,
  savePending,
  onToggle,
}: PickCandidateRowProps) {
  const bg = memberChipColor(member);
  const initial = (member.avatarInitial ?? member.name.charAt(0) ?? '?').toUpperCase();
  const frozen = disabled || savePending;
  const label = isSelected
    ? `Unselect ${member.name} for ${taskName}`
    : `Select ${member.name} for ${taskName}`;

  return (
    <label
      className={`pick-results-row pick-results-row--label${isRecommended ? ' pick-results-row--recommended' : ''}${isSelected ? ' pick-results-row--assigned' : ''}${frozen ? ' pick-results-row--frozen' : ''}`}
      style={{ '--pick-row-accent': bg } as CSSProperties}
    >
      <input
        type="checkbox"
        className="pick-results-checkbox"
        checked={isSelected}
        disabled={frozen}
        aria-label={label}
        onChange={() => {
          if (!frozen) onToggle();
        }}
      />
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
          {isSelected ? (
            <span className="pick-results-row-assigned-mark" aria-hidden title="Selected">
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
    </label>
  );
}
