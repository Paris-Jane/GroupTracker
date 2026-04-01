import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  getTasks, createTask, updateTask, deleteTask,
  updateTaskStatus, assignTask,
} from '../api/client';
import type { TaskItem, GroupMember, TaskStatus, TaskPriority, CreateTaskDto } from '../types';
import { PriorityBadge } from '../components/common/StatusBadge';
import Avatar from '../components/common/Avatar';
import ConfirmDialog from '../components/common/ConfirmDialog';
import BulkImportModal from '../components/Tasks/BulkImportModal';
import TaskFormModal from '../components/Tasks/TaskFormModal';
import PlanningPokerModal from '../components/games/PlanningPokerModal';
import PickTasksModal from '../components/games/PickTasksModal';

interface Props {
  currentMember: GroupMember | null;
  members: GroupMember[];
}

type FilterView = 'all' | 'mine' | 'incomplete' | 'completed';
type SortKey = 'deadline' | 'priority' | 'name' | 'updated';

const PRIORITIES: TaskPriority[] = ['High', 'Medium', 'Low'];

function isOverdue(deadline?: string, status?: TaskStatus) {
  if (!deadline || status === 'Completed') return false;
  return new Date(deadline) < new Date();
}

function priorityOrder(p: TaskPriority) { return p === 'High' ? 0 : p === 'Medium' ? 1 : 2; }

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

// ── Task row ───────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: TaskItem;
  members: GroupMember[];
  onOpen: () => void;
  onStatusCycle: () => void;
  onAssigneesChange: (memberIds: number[]) => Promise<void>;
}

function TaskRow({
  task,
  members,
  onOpen,
  onStatusCycle,
  onAssigneesChange,
}: TaskRowProps) {
  const [assignOpen, setAssignOpen] = useState(false);
  const assignWrapRef = useRef<HTMLDivElement>(null);
  const overdue = isOverdue(task.deadline, task.status);
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

  return (
    <div className="task-row-wrap">
      <div
        role="button"
        tabIndex={0}
        className={`task-row task-row--${statusClass}${overdue ? ' task-row--overdue' : ''}`}
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
        <div className="task-row-pri">
          <PriorityBadge priority={task.priority} />
        </div>
        <div className="task-row-status">
          <button
            type="button"
            className={`task-status-chip task-status-chip--${statusClass}`}
            onClick={e => {
              e.stopPropagation();
              onStatusCycle();
            }}
            aria-label={`Status: ${statusChipLabel(task.status)}. Click for next status.`}
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
            <div className="task-assign-popover" role="dialog" aria-label="Choose assignees">
              {members.map(m => (
                <label key={m.id} className="task-assign-popover-row">
                  <input
                    type="checkbox"
                    checked={assignedIds.includes(m.id)}
                    onChange={() => void toggleAssignee(m.id)}
                  />
                  <Avatar initial={m.avatarInitial} color={m.color} size="sm" name={m.name} />
                  <span>{m.name}</span>
                </label>
              ))}
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
  const [view, setView] = useState<FilterView>('all');
  const [sortKey, setSortKey] = useState<SortKey>('deadline');
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | ''>('');
  const [editingTask, setEditingTask] = useState<TaskItem | null | 'new'>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showPoker, setShowPoker] = useState(false);
  const [showPick, setShowPick] = useState(false);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | ''>('');
  const [filterSprint, setFilterSprint] = useState<number | ''>('');
  const [filterAssignee, setFilterAssignee] = useState<number | ''>('');

  const load = () => getTasks().then(setTasks);
  useEffect(() => { load(); }, []);

  const sprintOptions = useMemo(() => {
    const s = new Set<number>();
    for (const t of tasks) {
      if (t.sprintNumber != null && !Number.isNaN(Number(t.sprintNumber))) {
        s.add(t.sprintNumber);
      }
    }
    return [...s].sort((a, b) => a - b);
  }, [tasks]);

  const visible = useMemo(() => {
    let list = [...tasks];
    if (view === 'mine' && currentMember) list = list.filter(t => t.assignments.some(a => a.groupMemberId === currentMember.id));
    if (view === 'incomplete') list = list.filter(t => t.status !== 'Completed');
    if (view === 'completed') list = list.filter(t => t.status === 'Completed');
    if (filterPriority) list = list.filter(t => t.priority === filterPriority);
    if (filterStatus) list = list.filter(t => t.status === filterStatus);
    if (filterSprint !== '') list = list.filter(t => t.sprintNumber === filterSprint);
    if (filterAssignee !== '') {
      list = list.filter(t => t.assignments.some(a => a.groupMemberId === filterAssignee));
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.notes?.toLowerCase().includes(q) ||
        t.tags?.toLowerCase().includes(q)
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
    filterAssignee,
    currentMember,
  ]);

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

  return (
    <div className="page">
      <header className="page-title-block page-title-block--split">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-subtitle">All project work in one place</p>
        </div>
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

      <div className="panel toolbar-panel">
        <div className="toolbar">
          <input
            className="input-inline toolbar-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search"
            aria-label="Search tasks"
          />
          <div className="toolbar-seg">
            {(['all', 'mine', 'incomplete', 'completed'] as FilterView[]).map(v => (
              <button
                key={v}
                type="button"
                className={`toolbar-seg-btn${view === v ? ' is-on' : ''}`}
                onClick={() => setView(v)}
              >
                {v === 'all' ? 'All' : v === 'mine' ? 'Mine' : v === 'incomplete' ? 'Open' : 'Done'}
              </button>
            ))}
          </div>
        </div>
        <div className="toolbar toolbar--second">
          <span className="toolbar-group-label">Filter</span>
          <select
            className="select-compact"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as TaskStatus | '')}
            aria-label="Filter by status"
          >
            <option value="">Any status</option>
            <option value="NotStarted">To do</option>
            <option value="InProgress">In progress</option>
            <option value="Completed">Done</option>
          </select>
          <select
            className="select-compact"
            value={filterSprint === '' ? '' : String(filterSprint)}
            onChange={e => setFilterSprint(e.target.value === '' ? '' : Number(e.target.value))}
            aria-label="Filter by sprint"
          >
            <option value="">All sprints</option>
            {sprintOptions.map(n => (
              <option key={n} value={n}>
                Sprint {n}
              </option>
            ))}
          </select>
          <select
            className="select-compact"
            value={filterAssignee === '' ? '' : String(filterAssignee)}
            onChange={e => setFilterAssignee(e.target.value === '' ? '' : Number(e.target.value))}
            aria-label="Filter by assignee"
          >
            <option value="">Anyone</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <select
            className="select-compact"
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value as TaskPriority | '')}
            aria-label="Filter by priority"
          >
            <option value="">Any priority</option>
            {PRIORITIES.map(p => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <span className="toolbar-count">{visible.length} shown</span>
          <div className="toolbar-sort-group">
            <span className="toolbar-group-label" id="tasks-sort-label">
              Sort by
            </span>
            <select
              className="select-compact"
              value={sortKey}
              onChange={e => setSortKey(e.target.value as SortKey)}
              aria-labelledby="tasks-sort-label"
            >
              <option value="deadline">Deadline</option>
              <option value="priority">Priority</option>
              <option value="name">Name</option>
              <option value="updated">Last updated</option>
            </select>
          </div>
        </div>
      </div>

      <div className="task-list-header" aria-hidden>
        <span>Task</span>
        <span>Sprint</span>
        <span>Pri</span>
        <span>Status</span>
        <span className="task-list-header-assignee">Assignee</span>
      </div>

      {visible.length === 0 ? (
        <div className="panel panel-empty">
          <p className="panel-empty-title">No tasks match</p>
          <p className="text-muted text-sm">Adjust filters or add a task.</p>
          <button type="button" className="btn btn-primary btn-sm mt-2" onClick={() => setEditingTask('new')}>
            New task
          </button>
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
