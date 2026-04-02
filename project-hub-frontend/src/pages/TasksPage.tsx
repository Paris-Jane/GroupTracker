import { useEffect, useState, useMemo, useRef, useCallback, type CSSProperties } from 'react';
import {
  getTasks,
  getProjectSettings,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  assignTask,
} from '../api/client';
import type { TaskItem, GroupMember, TaskStatus, TaskPriority, CreateTaskDto } from '../types';
import Avatar from '../components/common/Avatar';
import ConfirmDialog from '../components/common/ConfirmDialog';
import BulkImportModal from '../components/Tasks/BulkImportModal';
import TaskFormModal from '../components/Tasks/TaskFormModal';
import PlanningPokerModal from '../components/games/PlanningPokerModal';
import PickTasksModal from '../components/games/PickTasksModal';
import { TaskFilters, type TasksViewTab, type TasksSortKey, memberChipColor } from '../components/Tasks/TaskFilters';

interface Props {
  currentMember: GroupMember | null;
  members: GroupMember[];
}

function parseLocalYmd(iso?: string): { y: number; m: number; d: number } | null {
  if (!iso) return null;
  const part = iso.split('T')[0];
  const [y, m, d] = part.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function isOverdue(deadline?: string, status?: TaskStatus) {
  if (!deadline || status === 'Completed') return false;
  const p = parseLocalYmd(deadline);
  if (!p) return false;
  const t = new Date();
  const end = new Date(p.y, p.m - 1, p.d, 23, 59, 59, 999);
  return end < t;
}

function isDueToday(deadline?: string) {
  const p = parseLocalYmd(deadline);
  if (!p) return false;
  const t = new Date();
  return p.y === t.getFullYear() && p.m === t.getMonth() + 1 && p.d === t.getDate();
}

function formatDeadlineShort(deadline?: string) {
  if (!deadline) return null;
  const p = parseLocalYmd(deadline);
  if (!p) return null;
  return new Date(p.y, p.m - 1, p.d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function priorityOrder(p: TaskPriority) {
  return p === 'High' ? 0 : p === 'Medium' ? 1 : 2;
}

function nextTaskStatus(s: TaskStatus): TaskStatus {
  if (s === 'NotStarted') return 'InProgress';
  if (s === 'InProgress') return 'Completed';
  return 'NotStarted';
}

function statusChipLabel(s: TaskStatus) {
  if (s === 'NotStarted') return 'To do';
  if (s === 'InProgress') return 'In progress';
  return 'Done';
}

const SPRINT_PILL_MAX = 8;

// ── Task row ───────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: TaskItem;
  members: GroupMember[];
  onOpen: () => void;
  onStatusCycle: () => void;
  onAssigneesChange: (memberIds: number[]) => Promise<void>;
}

function TaskRow({ task, members, onOpen, onStatusCycle, onAssigneesChange }: TaskRowProps) {
  const [assignOpen, setAssignOpen] = useState(false);
  const assignWrapRef = useRef<HTMLDivElement>(null);
  const overdue = isOverdue(task.deadline, task.status);
  const dueToday = isDueToday(task.deadline) && task.status !== 'Completed';
  const statusClass =
    task.status === 'Completed' ? 'completed' : task.status === 'InProgress' ? 'inprogress' : 'notstarted';

  const closeOnOutside = useCallback((e: MouseEvent) => {
    if (assignWrapRef.current && !assignWrapRef.current.contains(e.target as Node)) {
      setAssignOpen(false);
    }
  }, []);

  useEffect(() => {
    if (!assignOpen) return;
    document.addEventListener('mousedown', closeOnOutside);
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, [assignOpen, closeOnOutside]);

  const assignedIds = task.assignments.map(a => a.groupMemberId);

  const toggleAssignee = async (memberId: number) => {
    const next = assignedIds.includes(memberId)
      ? assignedIds.filter(id => id !== memberId)
      : [...assignedIds, memberId];
    await onAssigneesChange(next);
  };

  const dueText = formatDeadlineShort(task.deadline);

  return (
    <div className="task-row-wrap">
      <div
        role="button"
        tabIndex={0}
        className={`task-row task-row--${statusClass}${overdue ? ' task-row--overdue' : ''}${dueToday && !overdue ? ' task-row--due-today' : ''}`}
        onClick={onOpen}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen();
          }
        }}
      >
        <div className="task-row-name">
          <span className={task.status === 'Completed' ? 'task-row-title task-row-title--done' : 'task-row-title'}>
            {task.name}
          </span>
        </div>
        <div className="task-row-sprint">
          {task.sprintNumber != null ? (
            <span className="task-row-sprint-num">S{task.sprintNumber}</span>
          ) : (
            <span className="text-muted text-xs">—</span>
          )}
        </div>
        <div className="task-row-due-col">
          {dueText ? (
            <span
              className={`task-row-due-inline${overdue ? ' task-row-due-inline--late' : ''}${dueToday && !overdue ? ' task-row-due-inline--today' : ''}`}
            >
              {dueText}
            </span>
          ) : (
            <span className="text-muted text-xs">—</span>
          )}
        </div>
        <div className="task-row-status">
          <button
            type="button"
            className={`task-status-chip task-status-chip--${statusClass}`}
            onClick={e => {
              e.stopPropagation();
              onStatusCycle();
            }}
            aria-label={`Status: ${statusChipLabel(task.status)}. Click for next: ${statusChipLabel(nextTaskStatus(task.status))}.`}
          >
            {statusChipLabel(task.status)}
          </button>
        </div>
        <div
          className="task-row-assignees"
          ref={assignWrapRef}
          onClick={e => e.stopPropagation()}
          onKeyDown={e => e.stopPropagation()}
        >
          {task.assignments.length > 0 ? (
            <button
              type="button"
              className="task-row-avatar-trigger"
              onClick={() => setAssignOpen(o => !o)}
              aria-expanded={assignOpen}
              aria-label="Edit assignees"
            >
              <div className="task-row-avatar-stack">
                {task.assignments.map(a => (
                  <Avatar
                    key={a.id}
                    initial={a.memberAvatarInitial}
                    color={a.memberColor}
                    size="sm"
                    name={a.memberName}
                  />
                ))}
              </div>
            </button>
          ) : (
            <button
              type="button"
              className="task-assign-add"
              onClick={() => setAssignOpen(o => !o)}
              aria-expanded={assignOpen}
              aria-label="Assign people"
            >
              <span aria-hidden>+</span>
            </button>
          )}
          {assignOpen && (
            <div className="task-assign-popover task-assign-popover--icons" role="dialog" aria-label="Choose assignees">
              <p className="task-assign-popover-hint">Select people</p>
              <div className="task-assign-popover-avatars">
                {members.map(m => {
                  const on = assignedIds.includes(m.id);
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
                      onClick={() => void toggleAssignee(m.id)}
                    >
                      <span className="task-assign-icon-circle">{initial}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Tasks Page ──────────────────────────────────────────────────────────

export default function TasksPage({ currentMember, members }: Props) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [settingsSprintCount, setSettingsSprintCount] = useState<number>(6);
  const [view, setView] = useState<TasksViewTab>('all');
  const [sortKey, setSortKey] = useState<TasksSortKey>('deadline');
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | ''>('');
  const [editingTask, setEditingTask] = useState<TaskItem | null | 'new'>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showPoker, setShowPoker] = useState(false);
  const [showPick, setShowPick] = useState(false);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | ''>('');
  const [filterSprint, setFilterSprint] = useState<number | ''>('');
  const [filterAssigneeIds, setFilterAssigneeIds] = useState<number[]>([]);

  const load = useCallback(() => {
    getTasks().then(setTasks);
  }, []);

  useEffect(() => {
    load();
    getProjectSettings().then(s => setSettingsSprintCount(s.sprintCount ?? 6));
  }, [load]);

  const sprintNumbers = useMemo(() => {
    const fromTasks = new Set<number>();
    for (const t of tasks) {
      if (t.sprintNumber != null && !Number.isNaN(Number(t.sprintNumber))) {
        fromTasks.add(t.sprintNumber);
      }
    }
    const n = Math.max(1, settingsSprintCount);
    for (let i = 1; i <= n; i++) fromTasks.add(i);
    return [...fromTasks].sort((a, b) => a - b);
  }, [tasks, settingsSprintCount]);

  const useSprintDropdown = sprintNumbers.length > SPRINT_PILL_MAX;

  const visible = useMemo(() => {
    let list = [...tasks];
    if (view === 'mine' && currentMember) {
      list = list.filter(t => t.assignments.some(a => a.groupMemberId === currentMember.id));
    }
    if (view === 'open') {
      list = list.filter(t => t.status === 'NotStarted' || t.status === 'InProgress');
    }
    if (view === 'done') {
      list = list.filter(t => t.status === 'Completed');
    }
    if (filterPriority) list = list.filter(t => t.priority === filterPriority);
    if (filterStatus) list = list.filter(t => t.status === filterStatus);
    if (filterSprint !== '') list = list.filter(t => t.sprintNumber === filterSprint);
    if (filterAssigneeIds.length > 0) {
      list = list.filter(t => t.assignments.some(a => filterAssigneeIds.includes(a.groupMemberId)));
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        t =>
          t.name.toLowerCase().includes(q) ||
          t.notes?.toLowerCase().includes(q) ||
          t.tags?.toLowerCase().includes(q) ||
          t.assignments.some(a => a.memberName.toLowerCase().includes(q)),
      );
    }
    list.sort((a, b) => {
      if (sortKey === 'deadline') return (a.deadline ?? '9999') < (b.deadline ?? '9999') ? -1 : 1;
      if (sortKey === 'priority') return priorityOrder(a.priority) - priorityOrder(b.priority);
      if (sortKey === 'name') return a.name.localeCompare(b.name);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return list;
  }, [
    tasks,
    view,
    sortKey,
    search,
    filterPriority,
    filterStatus,
    filterSprint,
    filterAssigneeIds,
    currentMember,
  ]);

  const overdueCount = useMemo(
    () => visible.filter(t => isOverdue(t.deadline, t.status)).length,
    [visible],
  );

  const activeSummary = useMemo(() => {
    const parts: string[] = [];
    if (view === 'mine') parts.push('View: Mine');
    if (view === 'open') parts.push('View: Open');
    if (view === 'done') parts.push('View: Done');
    if (filterStatus === 'NotStarted') parts.push('Status: To do');
    else if (filterStatus === 'InProgress') parts.push('Status: In progress');
    else if (filterStatus === 'Completed') parts.push('Status: Done');
    if (filterSprint !== '') parts.push(`Sprint: ${filterSprint}`);
    if (filterAssigneeIds.length > 0) {
      const names = filterAssigneeIds
        .map(id => members.find(m => m.id === id)?.name)
        .filter(Boolean) as string[];
      if (names.length) parts.push(names.join(', '));
    }
    if (filterPriority) parts.push(`Priority: ${filterPriority}`);
    if (search.trim()) parts.push(`Search: "${search.trim().length > 28 ? `${search.trim().slice(0, 28)}…` : search.trim()}"`);
    return parts.length ? parts.join(' \u2022 ') : null;
  }, [view, filterStatus, filterSprint, filterAssigneeIds, filterPriority, search, members]);

  const clearAllFilters = () => {
    setView('all');
    setSearch('');
    setFilterStatus('');
    setFilterSprint('');
    setFilterAssigneeIds([]);
    setFilterPriority('');
  };

  const toggleAssigneeFilter = (id: number) => {
    setFilterAssigneeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  const handleSave = async (data: CreateTaskDto & { assigneeIds: number[]; subtaskNames: string[] }) => {
    const { assigneeIds: ids, subtaskNames: subs, ...rest } = data;
    if (editingTask === 'new') {
      await createTask({ ...rest, assigneeIds: ids, subtaskNames: subs }, currentMember?.id);
    } else if (editingTask) {
      await updateTask(editingTask.id, { ...rest, assigneeIds: undefined, subtaskNames: undefined }, currentMember?.id);
      await assignTask(editingTask.id, ids, currentMember?.id);
    }
    setEditingTask(null);
    load();
  };

  const handleModalDelete = () => {
    if (editingTask && editingTask !== 'new') {
      const id = editingTask.id;
      setEditingTask(null);
      setDeletingId(id);
    }
  };

  const hasTasks = tasks.length > 0;
  const emptyFromFilters = hasTasks && visible.length === 0;

  return (
    <div className="page tasks-page">
      <header className="page-title-block page-title-block--split">
        <div className="page-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPoker(true)}>
            Poker
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPick(true)}>
            Pick
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowBulkImport(true)}>
            Import
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditingTask('new')}>
            New task
          </button>
        </div>
      </header>

      <TaskFilters
        search={search}
        onSearchChange={setSearch}
        view={view}
        onViewChange={setView}
        filterStatus={filterStatus}
        onFilterStatus={setFilterStatus}
        sprintNumbers={sprintNumbers}
        useSprintDropdown={useSprintDropdown}
        filterSprint={filterSprint}
        onFilterSprint={setFilterSprint}
        members={members}
        filterAssigneeIds={filterAssigneeIds}
        onToggleAssignee={toggleAssigneeFilter}
        onClearAssignees={() => setFilterAssigneeIds([])}
        filterPriority={filterPriority}
        onFilterPriority={setFilterPriority}
        sortKey={sortKey}
        onSortKey={setSortKey}
        taskCount={visible.length}
        overdueCount={overdueCount}
        activeSummary={activeSummary}
        onClearAllFilters={clearAllFilters}
      />

      <div className="task-list-header" aria-hidden>
        <span>Task</span>
        <span>Sprint</span>
        <span>Deadline</span>
        <span>Status</span>
        <span className="task-list-header-assignee">User</span>
      </div>

      {visible.length === 0 ? (
        <div className="panel panel-empty tasks-empty-panel">
          {emptyFromFilters ? (
            <>
              <p className="panel-empty-title">No tasks match your filters</p>
              <p className="text-muted text-sm">Try clearing filters or adjusting your search.</p>
              <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={clearAllFilters}>
                Clear filters
              </button>
            </>
          ) : (
            <>
              <p className="panel-empty-title">No tasks yet</p>
              <p className="text-muted text-sm">Create a task to get started.</p>
              <button type="button" className="btn btn-primary btn-sm mt-2" onClick={() => setEditingTask('new')}>
                New task
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="task-list">
          {visible.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              members={members}
              onOpen={() => setEditingTask(task)}
              onStatusCycle={async () => {
                await updateTaskStatus(task.id, nextTaskStatus(task.status), currentMember?.id);
                load();
              }}
              onAssigneesChange={async ids => {
                await assignTask(task.id, ids, currentMember?.id);
                load();
              }}
            />
          ))}
        </div>
      )}

      {editingTask && (
        <TaskFormModal
          task={editingTask === 'new' ? undefined : editingTask}
          members={members}
          onSave={handleSave}
          onClose={() => setEditingTask(null)}
          onDelete={editingTask !== 'new' ? handleModalDelete : undefined}
        />
      )}
      {deletingId !== null && (
        <ConfirmDialog
          message="Delete this task? This cannot be undone."
          onConfirm={async () => {
            await deleteTask(deletingId);
            setDeletingId(null);
            load();
          }}
          onCancel={() => setDeletingId(null)}
        />
      )}
      {showBulkImport && (
        <BulkImportModal
          currentMember={currentMember}
          onClose={() => setShowBulkImport(false)}
          onImported={() => {
            setShowBulkImport(false);
            load();
          }}
        />
      )}
      <PlanningPokerModal
        open={showPoker}
        onClose={() => setShowPoker(false)}
        tasks={tasks}
        members={members}
        currentMemberId={currentMember?.id ?? null}
        onTasksChanged={load}
      />
      <PickTasksModal
        open={showPick}
        onClose={() => setShowPick(false)}
        tasks={tasks}
        members={members}
        currentMemberId={currentMember?.id ?? null}
      />
    </div>
  );
}
