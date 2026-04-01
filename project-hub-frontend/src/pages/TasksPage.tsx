import { useEffect, useState, useMemo } from 'react';
import {
  getTasks, createTask, updateTask, deleteTask,
  updateTaskStatus, assignTask,
  createSubtask, updateSubtask, deleteSubtask,
} from '../api/client';
import type { TaskItem, GroupMember, TaskStatus, TaskPriority, SubtaskItem, TaskCategory, CreateTaskDto } from '../types';
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
const CATEGORIES: TaskCategory[] = ['ProductBacklog', 'SprintGoal', 'SprintBacklog', 'Other'];

function formatDeadline(d?: string) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(deadline?: string, status?: TaskStatus) {
  if (!deadline || status === 'Completed') return false;
  return new Date(deadline) < new Date();
}

function priorityOrder(p: TaskPriority) { return p === 'High' ? 0 : p === 'Medium' ? 1 : 2; }

// ── Task row (scannable list) ───────────────────────────────────────────────

interface TaskRowProps {
  task: TaskItem;
  currentMember: GroupMember | null;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: TaskStatus) => void;
  onSubtaskToggle: (subtask: SubtaskItem) => void;
  onSubtaskAdd: (name: string) => void;
  onSubtaskDelete: (id: number) => void;
  onAssignSelf: () => void;
}

function TaskRow({
  task,
  currentMember,
  onEdit,
  onDelete,
  onStatusChange,
  onSubtaskToggle,
  onSubtaskAdd,
  onSubtaskDelete,
  onAssignSelf,
}: TaskRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [newSub, setNewSub] = useState('');
  const completedSubs = task.subtasks.filter(s => s.isCompleted).length;
  const overdue = isOverdue(task.deadline, task.status);
  const isAssigned = currentMember && task.assignments.some(a => a.groupMemberId === currentMember.id);
  const statusClass =
    task.status === 'Completed' ? 'completed' : task.status === 'InProgress' ? 'inprogress' : 'notstarted';

  return (
    <div className="task-row-wrap">
      <div className={`task-row task-row--${statusClass}${overdue ? ' task-row--overdue' : ''}`}>
        <div className="task-row-name">
          <span className={task.status === 'Completed' ? 'task-row-title task-row-title--done' : 'task-row-title'}>
            {task.name}
          </span>
          {task.notes && <p className="task-row-notes">{task.notes}</p>}
        </div>
        <div className="task-row-assignees">
          {task.assignments.length === 0 ? (
            <span className="text-muted text-xs">Unassigned</span>
          ) : (
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
          )}
        </div>
        <div className="task-row-due">
          {task.deadline ? (
            <span className={overdue ? 'task-row-due-text task-row-due-text--late' : 'task-row-due-text'}>
              {formatDeadline(task.deadline)}
            </span>
          ) : (
            <span className="text-muted text-xs">—</span>
          )}
        </div>
        <div className="task-row-pri">
          <PriorityBadge priority={task.priority} />
        </div>
        <div className="task-row-status">
          <select
            className="select-compact"
            value={task.status}
            onChange={e => onStatusChange(e.target.value as TaskStatus)}
            aria-label="Status"
          >
            <option value="NotStarted">To do</option>
            <option value="InProgress">In progress</option>
            <option value="Completed">Done</option>
          </select>
        </div>
        <div className="task-row-actions">
          {task.subtasks.length > 0 && (
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => setExpanded(e => !e)}>
              {expanded ? 'Hide' : `Subtasks (${completedSubs}/${task.subtasks.length})`}
            </button>
          )}
          {!isAssigned && currentMember && (
            <button type="button" className="btn btn-secondary btn-xs" onClick={onAssignSelf}>
              Me
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-xs" onClick={onEdit}>
            Edit
          </button>
          <button type="button" className="btn btn-ghost btn-xs text-danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
      {expanded && task.subtasks.length > 0 && (
        <div className="task-row-detail">
          {task.subtasks.map(s => (
            <div key={s.id} className="task-row-sub">
              <input
                type="checkbox"
                checked={s.isCompleted}
                onChange={() => onSubtaskToggle(s)}
                className="task-row-sub-check"
              />
              <span className={s.isCompleted ? 'task-row-sub-name task-row-sub-name--done' : 'task-row-sub-name'}>
                {s.name}
              </span>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => onSubtaskDelete(s.id)}>
                Remove
              </button>
            </div>
          ))}
          <div className="task-row-sub-add">
            <input
              value={newSub}
              onChange={e => setNewSub(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && newSub.trim() && (onSubtaskAdd(newSub.trim()), setNewSub(''))}
              placeholder="Add subtask"
              className="input-inline"
            />
            <button type="button" className="btn btn-secondary btn-xs" onClick={() => newSub.trim() && (onSubtaskAdd(newSub.trim()), setNewSub(''))}>
              Add
            </button>
          </div>
        </div>
      )}
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
  const [filterCategory, setFilterCategory] = useState<TaskCategory | ''>('');
  const [filterAssignee, setFilterAssignee] = useState<number | ''>('');

  const load = () => getTasks().then(setTasks);
  useEffect(() => { load(); }, []);

  // ── Filtered / sorted tasks ──

  const visible = useMemo(() => {
    let list = [...tasks];
    if (view === 'mine' && currentMember) list = list.filter(t => t.assignments.some(a => a.groupMemberId === currentMember.id));
    if (view === 'incomplete') list = list.filter(t => t.status !== 'Completed');
    if (view === 'completed') list = list.filter(t => t.status === 'Completed');
    if (filterPriority) list = list.filter(t => t.priority === filterPriority);
    if (filterStatus) list = list.filter(t => t.status === filterStatus);
    if (filterSprint !== '') list = list.filter(t => t.sprintNumber === filterSprint);
    if (filterCategory) list = list.filter(t => t.category === filterCategory);
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
    filterCategory,
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
          <input
            className="input-inline input-sprint"
            type="number"
            min={0}
            placeholder="Sprint"
            value={filterSprint === '' ? '' : String(filterSprint)}
            onChange={e => setFilterSprint(e.target.value === '' ? '' : Number(e.target.value))}
            aria-label="Filter by sprint"
          />
          <select
            className="select-compact"
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value as TaskCategory | '')}
            aria-label="Filter by category"
          >
            <option value="">Any category</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>
                {c.replace(/([A-Z])/g, ' $1').trim()}
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
          <select
            className="select-compact"
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            aria-label="Sort"
          >
            <option value="deadline">By deadline</option>
            <option value="priority">By priority</option>
            <option value="name">By name</option>
            <option value="updated">By updated</option>
          </select>
          <span className="toolbar-count">{visible.length} shown</span>
        </div>
      </div>

      <div className="task-list-header" aria-hidden>
        <span>Task</span>
        <span>Assignee</span>
        <span>Due</span>
        <span>Pri</span>
        <span>Status</span>
        <span />
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
              currentMember={currentMember}
              onEdit={() => setEditingTask(task)}
              onDelete={() => setDeletingId(task.id)}
              onStatusChange={async status => {
                await updateTaskStatus(task.id, status, currentMember?.id);
                load();
              }}
              onSubtaskToggle={async sub => {
                await updateSubtask(sub.id, sub.name, !sub.isCompleted);
                load();
              }}
              onSubtaskAdd={async name => {
                await createSubtask(task.id, name);
                load();
              }}
              onSubtaskDelete={async id => {
                await deleteSubtask(id);
                load();
              }}
              onAssignSelf={async () => {
                if (!currentMember) return;
                const existing = task.assignments.map(a => a.groupMemberId);
                await assignTask(task.id, [...existing, currentMember.id], currentMember.id);
                load();
              }}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {editingTask && (
        <TaskFormModal
          task={editingTask === 'new' ? undefined : editingTask}
          members={members}
          onSave={handleSave}
          onClose={() => setEditingTask(null)}
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
