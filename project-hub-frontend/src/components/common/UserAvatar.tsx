import type { GroupMember } from '../../types';
import { resolveMemberColor } from '../../lib/memberColor';

export default function UserAvatar({
  member,
  size = 'md',
}: {
  member: Pick<GroupMember, 'name' | 'avatarInitial' | 'color'>;
  size?: 'sm' | 'md';
}) {
  const s = size === 'sm' ? 28 : 36;
  const initial = member.avatarInitial ?? member.name.charAt(0).toUpperCase();
  const bg = resolveMemberColor(member.name, member.color);
  return (
    <span
      className="user-avatar"
      style={{
        width: s,
        height: s,
        borderRadius: '50%',
        background: bg,
        color: '#fff',
        fontSize: size === 'sm' ? 11 : 13,
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
      title={member.name}
    >
      {initial}
    </span>
  );
}
