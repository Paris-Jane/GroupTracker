import { useEffect, useState, useMemo } from 'react';
import {
  getTasks, createTask, updateTask, deleteTask,
  updateTaskStatus, assignTask,
  createSubtask, updateSubtask, deleteSubtask,
} from '../api/client';
import type { TaskItem, GroupMember, TaskStatus, TaskPriority, SubtaskItem, TaskCategory, CreateTaskDto } from '../types';
import { PriorityBadge } from '../components/common/StatusBadge';
import Avatar from '../components/common/Avatar';
import MemberSelector from '../components/common/MemberSelector';
import ConfirmDialog from '../components/common/ConfirmDialog';
import BulkImportModal from '../components/Tasks/BulkImportModal';
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

// ── Task Form Modal ──────────────────────────────────────────────────────────

interface TaskFormProps {
  task?: TaskItem;
  members: GroupMember[];
  onSave: (data: CreateTaskDto & { assigneeIds: number[]; subtaskNames: string[] }) => void;
  onClose: () => void;
}

function TaskFormModal({ task, members, onSave, onClose }: TaskFormProps) {
  const [name, setName] = useState(task?.name ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [estimatedTime, setEstimatedTime] = useState(task?.estimatedTime ?? '');
  const [deadline, setDeadline] = useState(task?.deadline ? task.deadline.split('T')[0] : '');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'Medium');
  const [isRequired, setIsRequired] = useState(task?.isRequired ?? true);
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'NotStarted');
  const [tags, setTags] = useState(task?.tags ?? '');
  const [sprintNumber, setSprintNumber] = useState(task?.sprintNumber != null ? String(task.sprintNumber) : '');
  const [category, setCategory] = useState<TaskCategory>(task?.category ?? 'ProductBacklog');
  const [evaluation, setEvaluation] = useState(task?.evaluation != null ? String(task.evaluation) : '');
  const [definitionOfDone, setDefinitionOfDone] = useState(task?.definitionOfDone ?? '');
  const [assigneeIds, setAssigneeIds] = useState<number[]>(task?.assignments.map(a => a.groupMemberId) ?? []);
  const [subtaskNames, setSubtaskNames] = useState<string[]>(task?.subtasks.map(s => s.name) ?? []);
  const [newSubtask, setNewSubtask] = useState('');

  const addSubtask = () => {
    if (newSubtask.trim()) {
      setSubtaskNames([...subtaskNames, newSubtask.trim()]);
      setNewSubtask('');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">{task ? 'Edit Task' : 'New Task'}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <label>Task Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Write project report" />
          </div>
          <div className="form-row">
            <label>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Details, context, links…" />
          </div>
          <div className="form-grid mb-3">
            <div>
              <label>Estimated Time</label>
              <input value={estimatedTime} onChange={e => setEstimatedTime(e.target.value)} placeholder="e.g. 2 hours" />
            </div>
            <div>
              <label>Deadline</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
            </div>
          </div>
          <div className="form-grid mb-3">
            <div>
              <label>Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as TaskStatus)}>
                <option value="NotStarted">Not Started</option>
                <option value="InProgress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>
          <div className="form-grid mb-3">
            <div>
              <label>Sprint number</label>
              <input type="number" min={0} value={sprintNumber} onChange={e => setSprintNumber(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value as TaskCategory)}>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c.replace(/([A-Z])/g, ' $1').trim()}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-grid mb-3">
            <div>
              <label>Evaluation (poker points)</label>
              <input type="number" min={0} value={evaluation} onChange={e => setEvaluation(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label>Definition of done</label>
              <input value={definitionOfDone} onChange={e => setDefinitionOfDone(e.target.value)} placeholder="When is this task done?" />
            </div>
          </div>
          <div className="form-grid mb-3">
            <div>
              <label>Tags</label>
              <input value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. Design, Backend" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', paddingTop: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 400 }}>
                <input type="checkbox" checked={isRequired} onChange={e => setIsRequired(e.target.checked)} style={{ width: 'auto' }} />
                Required task
              </label>
            </div>
          </div>
          <div className="form-row">
            <MemberSelector members={members} selected={assigneeIds} onChange={setAssigneeIds} />
          </div>

          {/* Subtasks */}
          <div className="form-row">
            <label>Subtasks</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
              {subtaskNames.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 13 }}>• {s}</span>
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => setSubtaskNames(subtaskNames.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={newSubtask}
                onChange={e => setNewSubtask(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSubtask()}
                placeholder="Add subtask…"
              />
              <button className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }} onClick={addSubtask}>Add</button>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!name.trim()}
            onClick={() => onSave({
              name,
              notes,
              estimatedTime,
              deadline: deadline || undefined,
              priority,
              isRequired,
              status,
              tags,
              sprintNumber: sprintNumber ? Number(sprintNumber) : undefined,
              category,
              evaluation: evaluation ? Number(evaluation) : undefined,
              definitionOfDone: definitionOfDone || undefined,
              assigneeIds,
              subtaskNames,
            })}
          >
            {task ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

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
