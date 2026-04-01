import type { GroupMember } from '../../types';
import { resolveMemberColor } from '../../lib/memberColor';

interface Props {
  members: GroupMember[];
  selected: number[];
  onChange: (ids: number[]) => void;
  label?: string;
}

export default function MemberSelector({ members, selected, onChange, label = 'Assign to' }: Props) {
  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);

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
