import { useEffect, useState, useMemo, useRef, useCallback, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getTasks,
  getProjectSettings,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  assignTask,
  patchTaskFields,
} from '../api/client';
import type { TaskItem, GroupMember, TaskStatus, TaskPriority, CreateTaskDto } from '../types';
import Avatar from '../components/common/Avatar';
import ConfirmDialog from '../components/common/ConfirmDialog';
import BulkImportModal from '../components/Tasks/BulkImportModal';
import TaskFormModal from '../components/Tasks/TaskFormModal';
import QuickTasksModal from '../components/Tasks/QuickTasksModal';
import {
  TaskFilters,
  type TasksSortKey,
  type TaskColumnKey,
  ALL_TASK_COLUMN_KEYS,
  DEFAULT_TASK_COLUMN_KEYS,
  memberChipColor,
} from '../components/Tasks/TaskFilters';

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

const TASK_COLS_STORAGE_KEY = 'ph.taskCols.v1';

function loadTaskColumns(): TaskColumnKey[] {
  try {
    const raw = localStorage.getItem(TASK_COLS_STORAGE_KEY);
    if (!raw) return [...DEFAULT_TASK_COLUMN_KEYS];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_TASK_COLUMN_KEYS];
    const allowed = new Set<TaskColumnKey>(ALL_TASK_COLUMN_KEYS);
    const out = parsed.filter((x): x is TaskColumnKey => typeof x === 'string' && allowed.has(x as TaskColumnKey));
    if (!out.includes('task')) out.unshift('task');
    return out.length ? ALL_TASK_COLUMN_KEYS.filter(k => out.includes(k)) : [...DEFAULT_TASK_COLUMN_KEYS];
  } catch {
    return [...DEFAULT_TASK_COLUMN_KEYS];
  }
}

function taskListGridColumns(cols: TaskColumnKey[]): string {
  const parts: string[] = ['40px'];
  const w: Record<TaskColumnKey, string> = {
    task: 'minmax(0, 1fr)',
    sprint: '52px',
    deadline: '88px',
    status: '118px',
    users: 'minmax(112px, auto)',
    priority: '88px',
    evaluation: '72px',
    estimatedTime: '96px',
    updated: '112px',
    notes: 'minmax(100px, 1fr)',
  };
  for (const c of cols) parts.push(w[c]);
  return parts.join(' ');
}

function formatUpdatedShort(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Task row ───────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: TaskItem;
  members: GroupMember[];
  visibleColumns: TaskColumnKey[];
  selectionArmed: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  gridTemplateColumns: string;
  onOpen: () => void;
  onStatusCycle: () => void;
  onAssigneesChange: (memberIds: number[]) => Promise<void>;
}

function TaskRow({
  task,
  members,
  visibleColumns,
  selectionArmed,
  selected,
  onToggleSelect,
  gridTemplateColumns,
  onOpen,
  onStatusCycle,
  onAssigneesChange,
}: TaskRowProps) {
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
  const notesPreview = task.notes?.trim()
    ? task.notes.trim().length > 80
      ? `${task.notes.trim().slice(0, 80)}…`
      : task.notes.trim()
    : null;

  const renderColumn = (key: TaskColumnKey) => {
    switch (key) {
      case 'task':
        return (
          <div className="task-row-name">
            <span className={task.status === 'Completed' ? 'task-row-title task-row-title--done' : 'task-row-title'}>
              {task.name}
            </span>
          </div>
        );
      case 'sprint':
        return (
          <div className="task-row-sprint">
            {task.sprintNumber != null ? (
              <span className="task-row-sprint-num">S{task.sprintNumber}</span>
            ) : (
              <span className="text-muted text-xs">—</span>
            )}
          </div>
        );
      case 'deadline':
        return (
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
        );
      case 'status':
        return (
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
        );
      case 'users':
        return (
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
        );
      case 'priority':
        return (
          <div className="task-row-pri-inline">
            <span
              className={`task-priority-chip task-priority-chip--${task.priority === 'High' ? 'high' : task.priority === 'Medium' ? 'medium' : 'low'}`}
            >
              {task.priority}
            </span>
          </div>
        );
      case 'evaluation':
        return (
          <div className="task-row-eval text-muted text-xs">
            {task.evaluation != null ? String(task.evaluation) : '—'}
          </div>
        );
      case 'estimatedTime':
        return (
          <div className="task-row-est text-muted text-xs" title={task.estimatedTime ?? undefined}>
            {task.estimatedTime?.trim() ? task.estimatedTime.trim() : '—'}
          </div>
        );
      case 'updated':
        return (
          <div className="task-row-updated text-muted text-xs">{formatUpdatedShort(task.updatedAt)}</div>
        );
      case 'notes':
        return (
          <div className="task-row-notes-inline text-muted text-xs" title={task.notes ?? undefined}>
            {notesPreview ?? '—'}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`task-row-wrap${selectionArmed ? ' task-row-wrap--select-armed' : ''}`}>
      <div
        role="button"
        tabIndex={0}
        className={`task-row task-row--${statusClass}${overdue ? ' task-row--overdue' : ''}${dueToday && !overdue ? ' task-row--due-today' : ''}`}
        style={{ gridTemplateColumns }}
        onClick={onOpen}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen();
          }
        }}
      >
        <div className="task-row-select" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect()}
            aria-label={`Select ${task.name}`}
          />
        </div>
        {visibleColumns.map(col => (
          <div key={col} className={`task-row-cell task-row-cell--${col}`}>
            {renderColumn(col)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Tasks Page ──────────────────────────────────────────────────────────

export default function TasksPage({ currentMember, members }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [settingsSprintCount, setSettingsSprintCount] = useState<number>(6);
  const [sortKey, setSortKey] = useState<TasksSortKey>('deadline');
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterPriority, setFilterPriority] = useState<TaskPriority | ''>('');
  const [editingTask, setEditingTask] = useState<TaskItem | null | 'new'>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showQuickTasks, setShowQuickTasks] = useState(false);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const bulkAddRef = useRef<HTMLDivElement>(null);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | ''>('');
  const [filterSprint, setFilterSprint] = useState<number | ''>('');
  const [filterAssigneeIds, setFilterAssigneeIds] = useState<number[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<TaskColumnKey[]>(loadTaskColumns);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkAssigneeIds, setBulkAssigneeIds] = useState<number[]>([]);
  const [bulkSprint, setBulkSprint] = useState<number | ''>('');
  const [bulkDeadline, setBulkDeadline] = useState('');
  const [bulkStatus, setBulkStatus] = useState<TaskStatus | ''>('');
  const [bulkPriority, setBulkPriority] = useState<TaskPriority | ''>('');
  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[] | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(TASK_COLS_STORAGE_KEY, JSON.stringify(visibleColumns));
    } catch {
      /* ignore */
    }
  }, [visibleColumns]);

  useEffect(() => {
    if (!bulkAddOpen) return;
    const close = (e: MouseEvent) => {
      if (bulkAddRef.current && !bulkAddRef.current.contains(e.target as Node)) setBulkAddOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [bulkAddOpen]);

  const load = useCallback(() => {
    getTasks().then(setTasks);
  }, []);

  useEffect(() => {
    load();
    getProjectSettings().then(s => setSettingsSprintCount(s.sprintCount ?? 6));
  }, [load]);

  useEffect(() => {
    const st = location.state as { openBulkImport?: boolean } | null;
    if (st?.openBulkImport) {
      setShowBulkImport(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

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
  }, [tasks, sortKey, search, filterPriority, filterStatus, filterSprint, filterAssigneeIds]);

  const overdueCount = useMemo(
    () => visible.filter(t => isOverdue(t.deadline, t.status)).length,
    [visible],
  );

  const activeSummary = useMemo(() => {
    const parts: string[] = [];
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
  }, [filterStatus, filterSprint, filterAssigneeIds, filterPriority, search, members]);

  const clearAllFilters = () => {
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

  const selectionArmed = selectedIds.length > 0;

  const gridCols = useMemo(() => taskListGridColumns(visibleColumns), [visibleColumns]);

  const toggleRowSelect = (id: number) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const selectAllVisible = () => {
    if (visible.length === 0) return;
    const allSel = visible.every(t => selectedIds.includes(t.id));
    if (allSel) setSelectedIds([]);
    else setSelectedIds(visible.map(t => t.id));
  };

  const toggleBulkMember = (id: number) => {
    setBulkAssigneeIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const applyBulkAssignees = async () => {
    if (selectedIds.length === 0) return;
    for (const id of selectedIds) {
      await assignTask(id, bulkAssigneeIds, currentMember?.id);
    }
    setSelectedIds([]);
    load();
  };

  const applyBulkSprint = async () => {
    if (selectedIds.length === 0 || bulkSprint === '') return;
    for (const id of selectedIds) {
      await patchTaskFields(id, { sprintNumber: bulkSprint }, currentMember?.id, 'Updated', 'Bulk sprint');
    }
    setBulkSprint('');
    setSelectedIds([]);
    load();
  };

  const applyBulkDeadline = async () => {
    if (selectedIds.length === 0 || !bulkDeadline.trim()) return;
    for (const id of selectedIds) {
      await patchTaskFields(
        id,
        { deadline: bulkDeadline },
        currentMember?.id,
        'Updated',
        'Bulk deadline',
      );
    }
    setBulkDeadline('');
    setSelectedIds([]);
    load();
  };

  const applyBulkStatus = async () => {
    if (selectedIds.length === 0 || !bulkStatus) return;
    for (const id of selectedIds) {
      await updateTaskStatus(id, bulkStatus, currentMember?.id);
    }
    setBulkStatus('');
    setSelectedIds([]);
    load();
  };

  const applyBulkPriority = async () => {
    if (selectedIds.length === 0 || !bulkPriority) return;
    for (const id of selectedIds) {
      await patchTaskFields(id, { priority: bulkPriority }, currentMember?.id, 'Updated', 'Bulk priority');
    }
    setBulkPriority('');
    setSelectedIds([]);
    load();
  };

  const hasTasks = tasks.length > 0;
  const emptyFromFilters = hasTasks && visible.length === 0;

  return (
    <div className="page tasks-page">
      <TaskFilters
        search={search}
        onSearchChange={setSearch}
        toolbarActions={
          <>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditingTask('new')}>
              New task
            </button>
            <div className="tasks-bulk-add-wrap" ref={bulkAddRef}>
              <button
                type="button"
                className={`btn btn-secondary btn-sm${bulkAddOpen ? ' is-on' : ''}`}
                onClick={() => setBulkAddOpen(o => !o)}
                aria-expanded={bulkAddOpen}
              >
                Bulk add ▾
              </button>
              {bulkAddOpen ? (
                <div className="tasks-bulk-add-menu panel" role="menu">
                  <button
                    type="button"
                    className="tasks-bulk-add-menu-item"
                    role="menuitem"
                    onClick={() => {
                      setBulkAddOpen(false);
                      setShowBulkImport(true);
                    }}
                  >
                    Use AI / import
                  </button>
                  <button
                    type="button"
                    className="tasks-bulk-add-menu-item"
                    role="menuitem"
                    onClick={() => {
                      setBulkAddOpen(false);
                      setShowQuickTasks(true);
                    }}
                  >
                    Manually add
                  </button>
                </div>
              ) : null}
            </div>
          </>
        }
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen(o => !o)}
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
        advancedOpen={advancedOpen}
        onToggleAdvanced={() => setAdvancedOpen(o => !o)}
        visibleColumns={visibleColumns}
        onChangeVisibleColumns={setVisibleColumns}
      />

      {selectedIds.length > 0 ? (
        <div className="tasks-batch-bar panel">
          <div className="tasks-batch-bar-head">
            <strong>{selectedIds.length}</strong>
            <span className="text-muted text-sm"> tasks selected</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedIds([])}>
              Clear selection
            </button>
          </div>
          <div className="tasks-batch-bar-section tasks-batch-assign-block">
            <span className="tasks-batch-label tasks-batch-label--block">Assignees</span>
            <div className="tasks-batch-assign-row">
              <div className="tasks-batch-chips">
                {members.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    className={`tasks-batch-chip${bulkAssigneeIds.includes(m.id) ? ' is-on' : ''}`}
                    onClick={() => toggleBulkMember(m.id)}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void applyBulkAssignees()}>
                Set assignees
              </button>
            </div>
          </div>
          <div className="tasks-batch-bar-section">
            <div className="tasks-batch-field-grid">
              <div className="tasks-batch-field">
                <label className="tasks-batch-label">Sprint</label>
                <div className="tasks-batch-field-actions">
                  <select
                    className="select-compact"
                    value={bulkSprint === '' ? '' : String(bulkSprint)}
                    onChange={e => setBulkSprint(e.target.value === '' ? '' : Number(e.target.value))}
                  >
                    <option value="">Choose…</option>
                    {sprintNumbers.map(n => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => void applyBulkSprint()}>
                    Apply
                  </button>
                </div>
              </div>
              <div className="tasks-batch-field">
                <label className="tasks-batch-label">Deadline</label>
                <div className="tasks-batch-field-actions">
                  <input type="date" value={bulkDeadline} onChange={e => setBulkDeadline(e.target.value)} />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => void applyBulkDeadline()}>
                    Apply
                  </button>
                </div>
              </div>
              <div className="tasks-batch-field">
                <label className="tasks-batch-label">Status</label>
                <div className="tasks-batch-field-actions">
                  <select
                    className="select-compact"
                    value={bulkStatus}
                    onChange={e => setBulkStatus(e.target.value as TaskStatus | '')}
                  >
                    <option value="">Choose…</option>
                    <option value="NotStarted">To do</option>
                    <option value="InProgress">In progress</option>
                    <option value="Completed">Done</option>
                  </select>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => void applyBulkStatus()}>
                    Apply
                  </button>
                </div>
              </div>
              <div className="tasks-batch-field">
                <label className="tasks-batch-label">Priority</label>
                <div className="tasks-batch-field-actions">
                  <select
                    className="select-compact"
                    value={bulkPriority}
                    onChange={e => setBulkPriority(e.target.value as TaskPriority | '')}
                  >
                    <option value="">Choose…</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => void applyBulkPriority()}>
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="tasks-batch-bar-section tasks-batch-bar-footer">
            <button type="button" className="btn btn-danger btn-sm" onClick={() => setBulkDeleteIds([...selectedIds])}>
              Delete selected
            </button>
          </div>
        </div>
      ) : null}

      <div
        className={`task-list-header${selectionArmed ? ' task-list-header--armed' : ''}`}
        style={{ gridTemplateColumns: gridCols }}
      >
        <span className="task-list-header-select">
          {selectionArmed ? (
            <input
              type="checkbox"
              checked={visible.length > 0 && visible.every(t => selectedIds.includes(t.id))}
              onChange={selectAllVisible}
              aria-label="Select all visible tasks"
            />
          ) : null}
        </span>
        {visibleColumns.map(col => (
          <span key={col} className={col === 'users' ? 'task-list-header-assignee' : undefined}>
            {col === 'task'
              ? 'Task'
              : col === 'sprint'
                ? 'Sprint'
                : col === 'deadline'
                  ? 'Deadline'
                  : col === 'status'
                    ? 'Status'
                    : col === 'users'
                      ? 'Users'
                      : col === 'priority'
                        ? 'Priority'
                        : col === 'evaluation'
                          ? 'Eval'
                          : col === 'estimatedTime'
                            ? 'Est. time'
                            : col === 'updated'
                              ? 'Updated'
                              : 'Notes'}
          </span>
        ))}
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
        <div className={`task-list${selectionArmed ? ' task-list--select-armed' : ''}`}>
          {visible.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              members={members}
              visibleColumns={visibleColumns}
              selectionArmed={selectionArmed}
              selected={selectedIds.includes(task.id)}
              onToggleSelect={() => toggleRowSelect(task.id)}
              gridTemplateColumns={gridCols}
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
      {bulkDeleteIds && bulkDeleteIds.length > 0 && (
        <ConfirmDialog
          message={`Delete ${bulkDeleteIds.length} task(s)? This cannot be undone.`}
          onConfirm={async () => {
            for (const id of bulkDeleteIds) {
              await deleteTask(id);
            }
            setBulkDeleteIds(null);
            setSelectedIds([]);
            load();
          }}
          onCancel={() => setBulkDeleteIds(null)}
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
      {showQuickTasks && (
        <QuickTasksModal
          currentMemberId={currentMember?.id ?? null}
          onClose={() => setShowQuickTasks(false)}
          onCreated={load}
        />
      )}
    </div>
  );
}
