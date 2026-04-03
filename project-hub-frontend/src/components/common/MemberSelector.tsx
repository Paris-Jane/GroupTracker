import type { GroupMember } from '../../types';
import AssigneePickerTable from './AssigneePickerTable';

interface Props {
  members: GroupMember[];
  selected: number[];
  onChange: (ids: number[]) => void;
  label?: string;
  /** Tighter spacing when used in modals. */
  compact?: boolean;
}

export default function MemberSelector({ members, selected, onChange, label = 'Assign to', compact = false }: Props) {
  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);

  return (
    <div className={compact ? 'member-selector member-selector--compact' : 'member-selector'}>
      {label && <label>{label}</label>}
      <AssigneePickerTable members={members} selectedIds={selected} onToggle={toggle} />
    </div>
  );
}
