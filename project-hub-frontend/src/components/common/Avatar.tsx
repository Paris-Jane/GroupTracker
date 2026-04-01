interface AvatarProps {
  initial?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  name?: string;
}

export default function Avatar({ initial, color = '#4A90D9', size = 'md', name }: AvatarProps) {
  const cls = `avatar${size === 'sm' ? ' avatar-sm' : size === 'lg' ? ' avatar-lg' : ''}`;
  return (
    <span className={cls} style={{ background: color }} title={name}>
      {initial ?? '?'}
    </span>
  );
}
