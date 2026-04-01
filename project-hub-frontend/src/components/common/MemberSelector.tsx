import type { GroupMember } from '../../types';

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
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => toggle(m.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 99,
                border: `2px solid ${active ? m.color ?? 'var(--primary)' : 'var(--border-dark)'}`,
                background: active ? (m.color ?? 'var(--primary)') + '18' : 'var(--surface)',
                color: active ? m.color ?? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: active ? 600 : 400,
                cursor: 'pointer', fontSize: 13,
              }}
            >
              <span
                className="avatar avatar-sm"
                style={{ background: m.color ?? '#aaa', fontSize: 10 }}
              >
                {m.avatarInitial}
              </span>
              {m.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
