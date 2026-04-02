import type { CSSProperties } from 'react';
import type { GroupMember } from '../../types';
import { resolveMemberColor } from '../../lib/memberColor';

interface Props {
  members: GroupMember[];
  selected: number[];
  onChange: (ids: number[]) => void;
  label?: string;
  /** Avatar-only circles; names on hover. */
  compact?: boolean;
}

export default function MemberSelector({ members, selected, onChange, label = 'Assign to', compact = false }: Props) {
  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);

  if (compact) {
    return (
      <div className="member-selector member-selector--compact">
        {label && <label>{label}</label>}
        <div className="member-selector-avatars" role="group" aria-label={label}>
          {members.map(m => {
            const active = selected.includes(m.id);
            const c = resolveMemberColor(m.name, m.color);
            const initial = (m.avatarInitial ?? m.name.charAt(0) ?? '?').toUpperCase();
            return (
              <button
                key={m.id}
                type="button"
                className={`member-selector-avatar-btn${active ? ' member-selector-avatar-btn--on' : ''}`}
                style={{ '--ms-color': c } as CSSProperties}
                onClick={() => toggle(m.id)}
                title={m.name}
                aria-label={m.name}
                aria-pressed={active}
              >
                <span className="member-selector-avatar-circle">{initial}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      {label && <label>{label}</label>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
        {members.map(m => {
          const active = selected.includes(m.id);
          const c = resolveMemberColor(m.name, m.color);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => toggle(m.id)}
              className="member-chip"
              data-active={active ? 'true' : undefined}
              style={{
                borderColor: active ? c : undefined,
                background: active ? `${c}14` : undefined,
                color: active ? c : undefined,
              }}
            >
              <span className="avatar avatar-sm" style={{ background: c, fontSize: 10 }}>
                {m.avatarInitial ?? m.name.charAt(0)}
              </span>
              {m.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
