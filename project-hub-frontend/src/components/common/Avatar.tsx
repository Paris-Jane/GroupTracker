import { resolveMemberColor } from '../../lib/memberColor';

interface AvatarProps {
  initial?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  name?: string;
}

export default function Avatar({ initial, color, size = 'md', name }: AvatarProps) {
  const cls = `avatar${size === 'sm' ? ' avatar-sm' : size === 'lg' ? ' avatar-lg' : ''}`;
  const bg = resolveMemberColor(name ?? '', color);
  return (
    <span className={cls} style={{ background: bg }} title={name}>
      {initial ?? '?'}
    </span>
  );
}
