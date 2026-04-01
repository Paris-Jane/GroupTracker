import type { TaskStatus, TaskPriority } from '../../types';

export function StatusBadge({ status }: { status: TaskStatus }) {
  const map: Record<TaskStatus, [string, string]> = {
    NotStarted: ['badge badge-not-started', 'Not Started'],
    InProgress: ['badge badge-working', 'In Progress'],
    Completed: ['badge badge-completed', 'Completed'],
  };
  const [cls, label] = map[status] ?? ['badge', status];
  return <span className={cls}>{label}</span>;
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const map: Record<TaskPriority, [string, string]> = {
    High: ['badge badge-pri-high', 'High'],
    Medium: ['badge badge-pri-med', 'Med'],
    Low: ['badge badge-pri-low', 'Low'],
  };
  const [cls, label] = map[priority] ?? ['badge', priority];
  return <span className={cls}>{label}</span>;
}

export function RequiredBadge({ required }: { required: boolean }) {
  return required
    ? <span className="badge badge-required">Required</span>
    : <span className="badge badge-optional">Optional</span>;
}
