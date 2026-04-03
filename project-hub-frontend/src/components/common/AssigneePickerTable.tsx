import type { CSSProperties } from 'react';
import type { GroupMember } from '../../types';
import { isAdminUser } from '../../lib/admin';
import { memberChipColor } from '../Tasks/TaskFilters';

interface AssigneePickerTableProps {
  members: GroupMember[];
  selectedIds: number[];
  onToggle: (memberId: number) => void;
  /** While true, row buttons are non-interactive */
  disabled?: boolean;
}

export default function AssigneePickerTable({ members, selectedIds, onToggle, disabled }: AssigneePickerTableProps) {
  return (
    <div className="task-assign-picker-table" role="list">
      {members.map(m => {
        const admin = isAdminUser(m);
        const on = selectedIds.includes(m.id);
        const c = memberChipColor(m);
        const initial = (m.avatarInitial ?? m.name.charAt(0) ?? '?').toUpperCase();
        return (
          <button
            key={m.id}
            type="button"
            role="listitem"
            className={`task-assign-picker-row${on ? ' task-assign-picker-row--on' : ''}`}
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onToggle(m.id)}
          >
            <span className="task-assign-picker-cell task-assign-picker-cell--icon">
              {admin ? (
                <span className="task-assign-picker-icon-muted" aria-hidden>
                  —
                </span>
              ) : (
                <span
                  className="task-assign-picker-icon-circle"
                  style={{ '--assign-icon-bg': c } as CSSProperties}
                >
                  {initial}
                </span>
              )}
            </span>
            <span className="task-assign-picker-cell task-assign-picker-cell--name">{m.name}</span>
            <span className="task-assign-picker-cell task-assign-picker-cell--role text-muted text-xs">
              {admin ? 'Admin' : 'Member'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
