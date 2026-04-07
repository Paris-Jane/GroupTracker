import type { TaskStatus } from '../../types';

const STATUS_META: Record<
  TaskStatus,
  { cls: 'todo' | 'progress' | 'done'; title: string }
> = {
  NotStarted: { cls: 'todo', title: 'To do — click to start' },
  InProgress: { cls: 'progress', title: 'In progress — click to complete' },
  Completed: { cls: 'done', title: 'Completed — click to move back to to do' },
};

/** Same control as the home “My tasks” status cycle. */
export default function TaskStatusDot({ status, onClick }: { status: TaskStatus; onClick: () => void }) {
  const { cls, title } = STATUS_META[status];
  return (
    <button
      type="button"
      className={`home-status-dot home-status-dot--${cls}`}
      onClick={onClick}
      title={title}
      aria-label={title}
    />
  );
}
