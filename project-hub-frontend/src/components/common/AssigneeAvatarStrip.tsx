import type { CSSProperties } from 'react';
import type { GroupMember } from '../../types';
import { assignableMembers } from '../../lib/admin';
import { memberChipColor } from '../Tasks/TaskFilters';

interface Props {
  members: GroupMember[];
  selectedIds: number[];
  onToggle: (memberId: number) => void;
}

/** Compact avatar circles for board / task row assign popovers (team only, no admin). */
export default function AssigneeAvatarStrip({ members, selectedIds, onToggle }: Props) {
  const team = assignableMembers(members);
  return (
    <div className="task-assign-popover-avatars">
      {team.map(m => {
        const on = selectedIds.includes(m.id);
        const c = memberChipColor(m);
        const initial = (m.avatarInitial ?? m.name.charAt(0) ?? '?').toUpperCase();
        return (
          <button
            key={m.id}
            type="button"
            className={`task-assign-icon-btn${on ? ' task-assign-icon-btn--on' : ''}`}
            style={{ '--assign-icon-bg': c } as CSSProperties}
            title={m.name}
            aria-label={m.name}
            aria-pressed={on}
            onClick={() => onToggle(m.id)}
          >
            <span className="task-assign-icon-circle">{initial}</span>
          </button>
        );
      })}
    </div>
  );
}
