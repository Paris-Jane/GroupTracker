import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getTasks,
  getProjectSettings,
  updateProjectSettings,
  getSprintGoals,
  upsertSprintGoal,
  deleteSprintGoal,
  getSprintReviews,
  addSprintReview,
  updateTaskStatus,
  createTask,
  updateTask,
  assignTask,
  deleteTask,
} from '../api/client';
import type { GroupMember, TaskItem, TaskStatus, CreateTaskDto, SprintGoal } from '../types';
import UserAvatar from '../components/common/UserAvatar';
import Avatar from '../components/common/Avatar';
import TaskFormModal from '../components/Tasks/TaskFormModal';
import ConfirmDialog from '../components/common/ConfirmDialog';

interface Props {
  currentMember: GroupMember | null;
  members: GroupMember[];
}

function colForStatus(s: TaskStatus): 'todo' | 'progress' | 'done' {
  if (s === 'Completed') return 'done';
  if (s === 'InProgress') return 'progress';
  return 'todo';
}

function statusForCol(col: 'todo' | 'progress' | 'done'): TaskStatus {
  if (col === 'done') return 'Completed';
  if (col === 'progress') return 'InProgress';
  return 'NotStarted';
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

function statusVisualClass(s: TaskStatus) {
  if (s === 'Completed') return 'completed';
  if (s === 'InProgress') return 'inprogress';
  return 'notstarted';
}

function parseLocalDate(s: string) {
  const [y, m, d] = s.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
}

function startOfLocalDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function endOfLocalDayFromIso(s: string) {
  const x = parseLocalDate(s);
  x.setHours(23, 59, 59, 999);
  return x.getTime();
}

function inferCurrentSprintNumber(goals: SprintGoal[], tasks: TaskItem[]): number {
  const taskMax = Math.max(0, ...tasks.map(t => t.sprintNumber ?? 0));
  const goalNums = goals.map(g => g.sprintNumber);
  const floor = Math.max(1, taskMax, ...goalNums, 1);

  const withDates = [...goals].filter(g => g.sprintDueDate).sort((a, b) => a.sprintNumber - b.sprintNumber);
  if (withDates.length === 0) return Math.max(1, taskMax || 1);

  const today = startOfLocalDay(new Date());
  for (const g of withDates) {
    const end = endOfLocalDayFromIso(g.sprintDueDate!);
    if (today <= end) return g.sprintNumber;
  }
  return floor;
}

type BoardCol = 'todo' | 'progress' | 'done';

export default function ScrumPage({ currentMember, members }: Props) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof getProjectSettings>> | null>(null);
  const [sprintGoals, setSprintGoals] = useState<Awaited<ReturnType<typeof getSprintGoals>>>([]);
  const [sprintNum, setSprintNum] = useState(1);
  const [reviews, setReviews] = useState<Awaited<ReturnType<typeof getSprintReviews>>>([]);
  const [reviewBody, setReviewBody] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productGoalDraft, setProductGoalDraft] = useState('');
  const [websiteDraft, setWebsiteDraft] = useState('');
  const [githubDraft, setGithubDraft] = useState('');

  const [sprintGoalModalOpen, setSprintGoalModalOpen] = useState(false);
  const [sprintGoalDraft, setSprintGoalDraft] = useState('');
  const [sprintDueDraft, setSprintDueDraft] = useState('');

  const [dragOver, setDragOver] = useState<BoardCol | null>(null);
  const [editingTask, setEditingTask] = useState<TaskItem | null | 'new'>(null);
  const [newTaskDefaults, setNewTaskDefaults] = useState<{
    status?: TaskStatus;
    sprintNumber?: number;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<
    null | { type: 'product' } | { type: 'sprint' } | { type: 'task'; id: number }
  >(null);

  const autoSprintSet = useRef(false);
  const todayMatchSprint = useMemo(() => inferCurrentSprintNumber(sprintGoals, tasks), [sprintGoals, tasks]);

  const loadTasks = () => getTasks().then(setTasks);
  const loadGoals = () => getSprintGoals().then(setSprintGoals);
  const loadSettings = () =>
    getProjectSettings().then(s => {
      setSettings(s);
      setProductGoalDraft(s.productGoal);
      setWebsiteDraft(s.websiteUrl ?? '');
      setGithubDraft(s.githubUrl ?? '');
    });
  const loadReviews = () => getSprintReviews(sprintNum).then(setReviews);

  useEffect(() => {
    loadTasks();
    loadGoals();
    loadSettings();
  }, []);

  useEffect(() => {
    loadReviews();
  }, [sprintNum]);

  const maxSprint = useMemo(() => {
    const fromTasks = tasks.map(t => t.sprintNumber ?? 0);
    const fromGoals = sprintGoals.map(g => g.sprintNumber);
    return Math.max(1, ...fromTasks, ...fromGoals, 6);
  }, [tasks, sprintGoals]);

  useEffect(() => {
    if (autoSprintSet.current) return;
    if (tasks.length === 0 && sprintGoals.length === 0) return;
    setSprintNum(inferCurrentSprintNumber(sprintGoals, tasks));
    autoSprintSet.current = true;
  }, [tasks, sprintGoals]);

  const currentGoal = sprintGoals.find(g => g.sprintNumber === sprintNum);

  useEffect(() => {
    setSprintGoalDraft(currentGoal?.goal ?? '');
    setSprintDueDraft(currentGoal?.sprintDueDate?.split('T')[0] ?? '');
  }, [currentGoal?.goal, currentGoal?.sprintDueDate, sprintNum]);

  const sprintTasks = useMemo(
    () => tasks.filter(t => t.sprintNumber === sprintNum),
    [tasks, sprintNum],
  );

  const columns = useMemo(() => {
    const todo: TaskItem[] = [];
    const progress: TaskItem[] = [];
    const done: TaskItem[] = [];
    for (const t of sprintTasks) {
      const c = colForStatus(t.status);
      if (c === 'done') done.push(t);
      else if (c === 'progress') progress.push(t);
      else todo.push(t);
    }
    return { todo, progress, done };
  }, [sprintTasks]);

  const doneCount = columns.done.length;
  const totalSprint = sprintTasks.length;
  const progressPct = totalSprint === 0 ? 0 : Math.round((doneCount / totalSprint) * 100);

  const openProductModal = () => {
    if (settings) {
      setProductGoalDraft(settings.productGoal);
      setWebsiteDraft(settings.websiteUrl ?? '');
      setGithubDraft(settings.githubUrl ?? '');
    }
    setProductModalOpen(true);
  };

  const saveProductModal = async () => {
    setSavingSettings(true);
    try {
      const next = await updateProjectSettings({
        productGoal: productGoalDraft,
        websiteUrl: websiteDraft || undefined,
        githubUrl: githubDraft || undefined,
      });
      setSettings(next);
      setProductModalOpen(false);
    } finally {
      setSavingSettings(false);
    }
  };

  const openSprintGoalModal = () => {
    setSprintGoalDraft(currentGoal?.goal ?? '');
    setSprintDueDraft(currentGoal?.sprintDueDate?.split('T')[0] ?? '');
    setSprintGoalModalOpen(true);
  };

  const saveSprintGoalModal = async () => {
    await upsertSprintGoal({
      sprintNumber: sprintNum,
      goal: sprintGoalDraft.trim(),
      sprintDueDate: sprintDueDraft || undefined,
    });
    setSprintGoalModalOpen(false);
    loadGoals();
  };

  const handleDrop = async (col: BoardCol, e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const raw = e.dataTransfer.getData('application/task-id') || e.dataTransfer.getData('text/plain');
    const id = raw ? Number(raw) : NaN;
    if (!Number.isFinite(id)) return;
    const nextStatus = statusForCol(col);
    const t = tasks.find(x => x.id === id);
    if (!t || t.status === nextStatus) return;
    await updateTaskStatus(id, nextStatus, currentMember?.id);
    loadTasks();
  };

  const handleSaveTask = async (data: CreateTaskDto & { assigneeIds: number[]; subtaskNames: string[] }) => {
    const { assigneeIds: ids, subtaskNames: subs, ...rest } = data;
    if (editingTask === 'new') {
      await createTask({ ...rest, assigneeIds: ids, subtaskNames: subs }, currentMember?.id);
    } else if (editingTask) {
      await updateTask(editingTask.id, { ...rest, assigneeIds: undefined, subtaskNames: undefined }, currentMember?.id);
      await assignTask(editingTask.id, ids, currentMember?.id);
    }
    setEditingTask(null);
    setNewTaskDefaults(null);
    loadTasks();
  };

  const openNewTask = (col: BoardCol) => {
    setNewTaskDefaults({ status: statusForCol(col), sprintNumber: sprintNum });
    setEditingTask('new');
  };

  const formatDue = (iso?: string) => {
    if (!iso) return null;
    return parseLocalDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const productGoalText = settings?.productGoal?.trim() ?? '';
  const dueLabel = formatDue(currentGoal?.sprintDueDate);
  const dueIso = currentGoal?.sprintDueDate?.split('T')[0];

  const openCardEdit = (e: React.MouseEvent, task: TaskItem) => {
    if ((e.target as HTMLElement).closest('[data-sprint-stop]')) return;
    setEditingTask(task);
  };

  const cycleTaskStatus = async (task: TaskItem, e: React.MouseEvent) => {
    e.stopPropagation();
    await updateTaskStatus(task.id, nextTaskStatus(task.status), currentMember?.id);
    loadTasks();
  };

  return (
    <div className="page sprint-page">
      {/* 1. Page header */}
      <header className="sprint-header">
        <div className="sprint-header-main">
          <h1 className="sprint-header-title">Sprint {sprintNum}</h1>
          <p className="sprint-header-sub">
            {dueLabel ? (
              <>
                Due{' '}
                <time dateTime={dueIso ?? undefined}>{dueLabel}</time>
              </>
            ) : (
              <span>No deadline set — use Edit sprint to add one</span>
            )}
            {sprintNum === todayMatchSprint && (
              <span className="sprint-header-pill" title="This sprint matches today’s date range">
                Current
              </span>
            )}
          </p>
        </div>
        <div className="sprint-header-progress" role="group" aria-label="Sprint completion">
          <div className="sprint-header-progress-labels">
            <span>
              {totalSprint === 0 ? 'No tasks in this sprint' : `${doneCount} of ${totalSprint} tasks complete`}
            </span>
            {totalSprint > 0 && <span className="sprint-header-progress-pct">{progressPct}%</span>}
          </div>
          <div
            className="sprint-progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPct}
            aria-label={`${progressPct} percent of sprint tasks complete`}
          >
            <div className="sprint-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </header>

      {/* 2. Product goal */}
      <section className="sprint-section sprint-product" aria-labelledby="sprint-product-heading">
        <h2 id="sprint-product-heading" className="sprint-section-label">
          Product goal
        </h2>
        <div className="sprint-product-inner">
          <p className="sprint-product-body">{productGoalText || 'Not set yet. Add a short statement of what you are building.'}</p>
          <div className="sprint-product-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={openProductModal}>
              {productGoalText ? 'Edit goal' : 'Add goal'}
            </button>
            {productGoalText ? (
              <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => setDeleteConfirm({ type: 'product' })}>
                Clear goal
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {/* 3. Sprint navigation */}
      <nav className="sprint-tabs-wrap" aria-label="Sprint selection">
        <div className="sprint-tabs" role="tablist">
          {Array.from({ length: maxSprint }, (_, i) => i + 1).map(n => (
            <button
              key={n}
              type="button"
              role="tab"
              aria-selected={n === sprintNum}
              className={`sprint-tab${n === sprintNum ? ' is-active' : ''}${n === todayMatchSprint && n !== sprintNum ? ' is-suggested' : ''}`}
              onClick={() => setSprintNum(n)}
            >
              Sprint {n}
            </button>
          ))}
        </div>
      </nav>

      {/* 4. Sprint summary strip */}
      <section className="sprint-overview" aria-label="Sprint summary">
        <div className="sprint-overview-inner">
          <div className="sprint-overview-grid">
            <div className="sprint-overview-cell">
              <span className="sprint-overview-label">Sprint goal</span>
              <p className="sprint-overview-value">{currentGoal?.goal?.trim() || '—'}</p>
            </div>
            <div className="sprint-overview-cell">
              <span className="sprint-overview-label">Deadline</span>
              <p className="sprint-overview-value">{dueLabel || '—'}</p>
            </div>
            <div className="sprint-overview-cell">
              <span className="sprint-overview-label">Progress</span>
              <p className="sprint-overview-value">
                {totalSprint === 0 ? '—' : `${doneCount} of ${totalSprint} complete`}
              </p>
            </div>
          </div>
          <div className="sprint-overview-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={openSprintGoalModal}>
              Edit sprint
            </button>
            {currentGoal ? (
              <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => setDeleteConfirm({ type: 'sprint' })}>
                Remove sprint goal
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {/* 5. Kanban */}
      <section className="sprint-section sprint-board-wrap" aria-labelledby="sprint-board-heading">
        <h2 id="sprint-board-heading" className="sprint-board-section-title">
          Board
        </h2>
        <div className="sprint-kanban">
          {(
            [
              ['todo', 'To do', columns.todo] as const,
              ['progress', 'In progress', columns.progress] as const,
              ['done', 'Done', columns.done] as const,
            ] as const
          ).map(([key, title, list]) => (
            <div key={key} className={`sprint-column sprint-column--${key}`}>
              <header className={`sprint-column-head sprint-column-head--${key}`}>
                <span className="sprint-column-title">{title}</span>
                <span className="sprint-column-count" aria-label={`${list.length} tasks`}>
                  {list.length}
                </span>
              </header>
              <div
                className={`sprint-column-body${dragOver === key ? ' is-drag-over' : ''}`}
                onDragOver={e => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDragEnter={() => setDragOver(key)}
                onDragLeave={e => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
                }}
                onDrop={e => handleDrop(key, e)}
              >
                {list.length === 0 ? <p className="sprint-column-empty">No tasks</p> : null}
                {list.map(t => (
                  <div
                    key={t.id}
                    className="sprint-card"
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData('application/task-id', String(t.id));
                      e.dataTransfer.setData('text/plain', String(t.id));
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => setDragOver(null)}
                    onClick={e => openCardEdit(e, t)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setEditingTask(t);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`${t.name}. ${statusChipLabel(t.status)}. Click to edit.`}
                  >
                    <div className="sprint-card-top">
                      <h3 className="sprint-card-title">{t.name}</h3>
                      <button
                        type="button"
                        className="sprint-card-delete"
                        data-sprint-stop
                        aria-label={`Delete ${t.name}`}
                        onClick={e => {
                          e.stopPropagation();
                          setDeleteConfirm({ type: 'task', id: t.id });
                        }}
                      >
                        Delete
                      </button>
                    </div>
                    {t.assignments.length > 0 ? (
                      <div className="sprint-card-meta">
                        <span className="sprint-card-meta-label">Assigned</span>
                        <div className="sprint-card-avatars">
                          {t.assignments.slice(0, 4).map(a => (
                            <Avatar
                              key={a.id}
                              initial={a.memberAvatarInitial}
                              color={a.memberColor}
                              size="sm"
                              name={a.memberName}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="sprint-card-footer">
                      <button
                        type="button"
                        data-sprint-stop
                        className={`task-status-chip task-status-chip--${statusVisualClass(t.status)} sprint-card-status`}
                        onClick={e => cycleTaskStatus(t, e)}
                        aria-label={`Status: ${statusChipLabel(t.status)}. Click for next status.`}
                      >
                        {statusChipLabel(t.status)}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="sprint-column-footer">
                <button type="button" className="btn btn-secondary btn-sm sprint-add-task" onClick={() => openNewTask(key)}>
                  + Add task
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Sprint notes */}
      <section className="sprint-section sprint-notes" aria-labelledby="sprint-notes-heading">
        <h2 id="sprint-notes-heading" className="sprint-section-label">
          Sprint notes
        </h2>
        <div className="sprint-notes-compose">
          <textarea
            className="sprint-notes-input"
            rows={2}
            value={reviewBody}
            onChange={e => setReviewBody(e.target.value)}
            placeholder="What went well, what to improve…"
            disabled={!currentMember}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm sprint-notes-post"
            disabled={!currentMember || !reviewBody.trim()}
            onClick={async () => {
              if (!currentMember || !reviewBody.trim()) return;
              await addSprintReview(sprintNum, currentMember.id, reviewBody.trim());
              setReviewBody('');
              loadReviews();
            }}
          >
            Post note
          </button>
        </div>
        <ul className="sprint-notes-list">
          {reviews.map(r => (
            <li key={r.id} className="sprint-notes-item">
              <UserAvatar member={{ name: r.memberName, color: r.memberColor, avatarInitial: r.memberAvatarInitial }} size="sm" />
              <div className="sprint-notes-item-body">
                <div className="sprint-notes-item-meta">
                  <span className="sprint-notes-item-name">{r.memberName}</span>
                  <time className="sprint-notes-item-date" dateTime={r.createdAt}>
                    {new Date(r.createdAt).toLocaleDateString()}
                  </time>
                </div>
                <p className="sprint-notes-item-text">{r.content}</p>
              </div>
            </li>
          ))}
        </ul>
        {reviews.length === 0 ? <p className="sprint-notes-empty text-muted text-sm">No notes yet for this sprint.</p> : null}
      </section>

      {productModalOpen && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">Product goal &amp; links</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setProductModalOpen(false)}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <label>Product goal</label>
                <textarea
                  rows={3}
                  value={productGoalDraft}
                  onChange={e => setProductGoalDraft(e.target.value)}
                  disabled={savingSettings}
                  placeholder="What you are building and why"
                />
              </div>
              <div className="form-grid">
                <div className="form-row">
                  <label>Website</label>
                  <input value={websiteDraft} onChange={e => setWebsiteDraft(e.target.value)} disabled={savingSettings} placeholder="https://…" />
                </div>
                <div className="form-row">
                  <label>GitHub</label>
                  <input value={githubDraft} onChange={e => setGithubDraft(e.target.value)} disabled={savingSettings} placeholder="https://…" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setProductModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" disabled={savingSettings} onClick={saveProductModal}>
                {savingSettings ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {sprintGoalModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Sprint {sprintNum}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSprintGoalModalOpen(false)}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <label>Sprint goal</label>
                <textarea rows={3} value={sprintGoalDraft} onChange={e => setSprintGoalDraft(e.target.value)} placeholder="Focus for this sprint" />
              </div>
              <div className="form-row">
                <label>Deadline</label>
                <input type="date" value={sprintDueDraft} onChange={e => setSprintDueDraft(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setSprintGoalModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={saveSprintGoalModal}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {editingTask && (
        <TaskFormModal
          key={editingTask === 'new' ? `new-${newTaskDefaults?.status}-${newTaskDefaults?.sprintNumber}` : editingTask.id}
          task={editingTask === 'new' ? undefined : editingTask}
          members={members}
          defaultsForNew={
            editingTask === 'new' && newTaskDefaults
              ? { ...newTaskDefaults, category: 'SprintBacklog' }
              : undefined
          }
          onSave={handleSaveTask}
          onClose={() => {
            setEditingTask(null);
            setNewTaskDefaults(null);
          }}
          onDelete={
            editingTask !== 'new'
              ? () => {
                  const id = editingTask.id;
                  setEditingTask(null);
                  setDeleteConfirm({ type: 'task', id });
                }
              : undefined
          }
        />
      )}

      {deleteConfirm?.type === 'product' && (
        <ConfirmDialog
          message="Clear the product goal? Website and GitHub links stay as they are until you change them in Edit goal."
          onConfirm={async () => {
            setSavingSettings(true);
            try {
              const next = await updateProjectSettings({ productGoal: '' });
              setSettings(next);
              setProductGoalDraft('');
            } finally {
              setSavingSettings(false);
              setDeleteConfirm(null);
            }
          }}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
      {deleteConfirm?.type === 'sprint' && (
        <ConfirmDialog
          message={`Remove the saved sprint goal and deadline for sprint ${sprintNum}?`}
          onConfirm={async () => {
            await deleteSprintGoal(sprintNum);
            setDeleteConfirm(null);
            loadGoals();
          }}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
      {deleteConfirm?.type === 'task' && (
        <ConfirmDialog
          message="Delete this task? This cannot be undone."
          onConfirm={async () => {
            await deleteTask(deleteConfirm.id);
            setDeleteConfirm(null);
            loadTasks();
          }}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
