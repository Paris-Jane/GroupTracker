import { useEffect, useState, useMemo } from 'react';
import {
  getTasks, createTask, updateTask, deleteTask,
  updateTaskStatus, assignTask,
  createSubtask, updateSubtask, deleteSubtask,
} from '../api/client';
import type { TaskItem, GroupMember, TaskStatus, TaskPriority, SubtaskItem, TaskCategory, CreateTaskDto } from '../types';
import { StatusBadge, PriorityBadge, RequiredBadge } from '../components/common/StatusBadge';
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

// ── Task Card ────────────────────────────────────────────────────────────────

interface TaskCardProps {
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

function TaskCard({ task, currentMember, onEdit, onDelete, onStatusChange, onSubtaskToggle, onSubtaskAdd, onSubtaskDelete, onAssignSelf }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [newSub, setNewSub] = useState('');
  const completedSubs = task.subtasks.filter(s => s.isCompleted).length;
  const overdue = isOverdue(task.deadline, task.status);
  const isAssigned = currentMember && task.assignments.some(a => a.groupMemberId === currentMember.id);

  return (
    <div className="card" style={{
      borderLeft: `4px solid ${task.priority === 'High' ? 'var(--danger)' : task.priority === 'Medium' ? 'var(--warning)' : 'var(--success)'}`,
      opacity: task.status === 'Completed' ? .75 : 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: task.status === 'Completed' ? 'var(--text-muted)' : 'var(--text)', textDecoration: task.status === 'Completed' ? 'line-through' : 'none' }}>
              {task.name}
            </span>
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            <RequiredBadge required={task.isRequired} />
          </div>

          {task.notes && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>{task.notes}</p>
          )}

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
            {task.deadline && (
              <span style={{ color: overdue ? 'var(--danger)' : 'var(--text-muted)', fontWeight: overdue ? 600 : 400 }}>
                Due {formatDeadline(task.deadline)}
                {overdue && ' (overdue)'}
              </span>
            )}
            {task.estimatedTime && <span>Est. {task.estimatedTime}</span>}
            {task.tags && <span>Tags: {task.tags}</span>}
          </div>

          {/* Assignments */}
          {task.assignments.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
              {task.assignments.map(a => (
                <Avatar key={a.id} initial={a.memberAvatarInitial} color={a.memberColor} size="sm" name={a.memberName} />
              ))}
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>
                {task.assignments.map(a => a.memberName).join(', ')}
              </span>
            </div>
          )}

          {/* Subtask progress */}
          {task.subtasks.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                <span>Subtasks: {completedSubs} / {task.subtasks.length}</span>
                <button className="btn btn-ghost btn-xs" onClick={() => setExpanded(!expanded)}>
                  {expanded ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="progress-bar">
                <div
                  className={`progress-fill${completedSubs === task.subtasks.length ? ' complete' : ''}`}
                  style={{ width: `${(completedSubs / task.subtasks.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Expanded subtasks */}
          {expanded && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              {task.subtasks.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                  <input
                    type="checkbox"
                    checked={s.isCompleted}
                    onChange={() => onSubtaskToggle(s)}
                    style={{ width: 'auto', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, textDecoration: s.isCompleted ? 'line-through' : 'none', color: s.isCompleted ? 'var(--text-muted)' : 'var(--text)', flex: 1 }}>
                    {s.name}
                  </span>
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => onSubtaskDelete(s.id)}>
                    Remove
                  </button>
                </div>
              ))}
              {/* Add subtask inline */}
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <input
                  value={newSub}
                  onChange={e => setNewSub(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && newSub.trim() && (onSubtaskAdd(newSub.trim()), setNewSub(''))}
                  placeholder="Add subtask…"
                  style={{ fontSize: 12 }}
                />
                <button
                  className="btn btn-secondary btn-xs"
                  style={{ flexShrink: 0 }}
                  onClick={() => { if (newSub.trim()) { onSubtaskAdd(newSub.trim()); setNewSub(''); } }}
                >+</button>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
          {/* Status quick-change */}
          <select
            value={task.status}
            onChange={e => onStatusChange(e.target.value as TaskStatus)}
            style={{ fontSize: 12, padding: '3px 6px', width: 'auto' }}
          >
            <option value="NotStarted">Not Started</option>
                <option value="InProgress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            {!isAssigned && currentMember && (
              <button className="btn btn-secondary btn-xs" onClick={onAssignSelf} title="Assign to me">
                + Me
              </button>
            )}
            <button className="btn btn-secondary btn-xs" onClick={onEdit}>Edit</button>
            <button className="btn btn-danger btn-xs" onClick={onDelete}>Del</button>
          </div>
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
    <div className="page-stack">
      <header className="page-header flex-between flex-wrap gap-3">
        <div>
          <h1>Tasks</h1>
          <p className="page-lead mb-0">Backlog, assignments, planning poker, and pick sessions</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowPoker(true)}>
            Planning poker
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowPick(true)}>
            Pick tasks
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowBulkImport(true)}>
            Bulk import
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditingTask('new')}>
            New task
          </button>
        </div>
      </header>

      <div className="page-body" style={{ padding: 0 }}>

        {/* ── Filters & search ── */}
        <div className="card-section">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tasks…"
              style={{ maxWidth: 220 }}
            />
            <div style={{ display: 'flex', gap: 4 }}>
              {(['all', 'mine', 'incomplete', 'completed'] as FilterView[]).map(v => (
                <button
                  key={v}
                  type="button"
                  className={`btn btn-sm ${view === v ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setView(v)}
                >
                  {v === 'all' ? 'All' : v === 'mine' ? 'Mine' : v === 'incomplete' ? 'Incomplete' : 'Completed'}
                </button>
              ))}
            </div>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as TaskStatus | '')}
              style={{ width: 'auto' }}
            >
              <option value="">All statuses</option>
              <option value="NotStarted">Not started</option>
              <option value="InProgress">In progress</option>
              <option value="Completed">Completed</option>
            </select>
            <input
              type="number"
              min={0}
              placeholder="Sprint #"
              value={filterSprint === '' ? '' : String(filterSprint)}
              onChange={e => setFilterSprint(e.target.value === '' ? '' : Number(e.target.value))}
              style={{ maxWidth: 100 }}
            />
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value as TaskCategory | '')}
              style={{ width: 'auto' }}
            >
              <option value="">All categories</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {c.replace(/([A-Z])/g, ' $1').trim()}
                </option>
              ))}
            </select>
            <select
              value={filterAssignee === '' ? '' : String(filterAssignee)}
              onChange={e => setFilterAssignee(e.target.value === '' ? '' : Number(e.target.value))}
              style={{ width: 'auto', minWidth: 120 }}
            >
              <option value="">Any assignee</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value as TaskPriority | '')}
              style={{ width: 'auto' }}
            >
              <option value="">All priorities</option>
              {PRIORITIES.map(p => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              value={sortKey}
              onChange={e => setSortKey(e.target.value as SortKey)}
              style={{ width: 'auto' }}
            >
              <option value="deadline">Sort: Deadline</option>
              <option value="priority">Sort: Priority</option>
              <option value="name">Sort: Name</option>
              <option value="updated">Sort: Updated</option>
            </select>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {visible.length} task{visible.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* ── Task list ── */}
        {visible.length === 0 ? (
          <div className="empty-state">
            <div className="empty-title">No tasks match</div>
            <div>Try clearing filters or create a task.</div>
            <button type="button" className="btn btn-primary mt-2" onClick={() => setEditingTask('new')}>
              New task
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {visible.map(task => (
              <TaskCard
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
      </div>

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
