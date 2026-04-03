import type { CSSProperties } from 'react';
import type { GroupMember } from '../../../types';
import { memberChipColor } from '../../Tasks/TaskFilters';

export interface PokerEstimateRowProps {
  member: GroupMember;
  taskName: string;
  value: number | null;
  /** Vote is tied for closest to the team average. */
  isClosest: boolean;
  isApplied: boolean;
  disabled: boolean;
  busy: boolean;
  onApply: () => void;
}

export default function PokerEstimateRow({
  member,
  taskName,
  value,
  isClosest,
  isApplied,
  disabled,
  busy,
  onApply,
}: PokerEstimateRowProps) {
  const bg = memberChipColor(member);
  const initial = (member.avatarInitial ?? member.name.charAt(0) ?? '?').toUpperCase();
  const canAct = value != null && !disabled && !busy;
  const label =
    value == null
      ? `${member.name} — no vote on ${taskName}`
      : isApplied
        ? `Evaluation ${value} applied (${member.name} voted ${value} on ${taskName})`
        : `Apply ${member.name}'s estimate of ${value} to ${taskName}`;

  return (
    <button
      type="button"
      className={`pick-results-row${isClosest ? ' pick-results-row--recommended' : ''}${isApplied ? ' pick-results-row--applied' : ''}${busy ? ' pick-results-row--busy' : ''}`}
      style={{ '--pick-row-accent': bg } as CSSProperties}
      disabled={!canAct}
      aria-label={label}
      aria-pressed={isApplied}
      onClick={onApply}
    >
      <span className="pick-results-row-avatar" aria-hidden>
        <span className="pick-results-row-avatar-circle" style={{ backgroundColor: bg, color: '#fff' }}>
          {initial}
        </span>
      </span>
      <span className="pick-results-row-main">
        <span className="pick-results-row-name-line">
          <span className="pick-results-row-name">{member.name}</span>
          {isClosest ? (
            <span className="pick-results-row-badge">Closest</span>
          ) : null}
          {isApplied ? (
            <span className="pick-results-row-assigned-mark" aria-hidden title="Applied to task">
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
        <span className="poker-results-vote-line">
          {value != null ? (
            <span className="poker-results-vote-chip" aria-hidden>
              {value}
            </span>
          ) : (
            <span className="pick-results-score-muted">No vote</span>
          )}
        </span>
      </span>
    </button>
  );
}
