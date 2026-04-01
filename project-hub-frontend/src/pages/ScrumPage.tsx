import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  getTasks,
  getProjectSettings,
  updateProjectSettings,
  getSprintGoals,
  upsertSprintGoal,
  deleteSprintGoal,
  getSprintReviews,
  addSprintReview,
  toggleAcceptedByPO,
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

/** Active sprint = first sprint (by number) whose end date is still today or in the future; else highest known sprint. */
function inferCurrentSprintNumber(
  goals: Awaited<ReturnType<typeof getSprintGoals>>,
  tasks: TaskItem[],
): number {
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

type CtxMenu =
  | { clientX: number; clientY: number; kind: 'product' }
  | { clientX: number; clientY: number; kind: 'sprint' }
  | { clientX: number; clientY: number; kind: 'task'; taskId: number };

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

  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [dragOver, setDragOver] = useState<BoardCol | null>(null);
  const [editingTask, setEditingTask] = useState<TaskItem | null | 'new'>(null);
  const [newTaskDefaults, setNewTaskDefaults] = useState<{
    status?: TaskStatus;
    sprintNumber?: number;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<
    null | { type: 'product' } | { type: 'sprint' } | { type: 'task'; id: number }
  >(null);

  const sprintStripRef = useRef<HTMLDivElement>(null);
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
    const n = inferCurrentSprintNumber(sprintGoals, tasks);
    setSprintNum(n);
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

  useEffect(() => {
    if (!ctxMenu) return;
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('.scrum-context-menu')) return;
      setCtxMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [ctxMenu]);

  const openProductModal = () => {
    setCtxMenu(null);
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
    setCtxMenu(null);
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

  const scrollSprints = (dir: -1 | 1) => {
    sprintStripRef.current?.scrollBy({ left: dir * 140, behavior: 'smooth' });
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

  const onProductContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ clientX: e.clientX, clientY: e.clientY, kind: 'product' });
  };

  const onSprintGoalContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ clientX: e.clientX, clientY: e.clientY, kind: 'sprint' });
  };

  const onTaskContextMenu = (e: React.MouseEvent, taskId: number) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ clientX: e.clientX, clientY: e.clientY, kind: 'task', taskId });
  };

  const menuPosition = useCallback((m: CtxMenu) => {
    const pad = 8;
    const w = 160;
    const h = 88;
    let left = m.clientX;
    let top = m.clientY;
    if (left + w > window.innerWidth - pad) left = window.innerWidth - w - pad;
    if (top + h > window.innerHeight - pad) top = window.innerHeight - h - pad;
    return { left, top };
  }, []);

  return (
    <div className="page">
      <header className="page-title-block">
        <h1 className="page-title">Sprint</h1>
        <p className="page-subtitle">Product goal, sprint focus, board, and reviews</p>
      </header>

      <section className="panel scrum-product-block">
        <h2 className="panel-heading">Product goal</h2>
        {productGoalText ? (
          <div
            className="scrum-product-goal-display"
            onContextMenu={onProductContextMenu}
            role="presentation"
          >
            <p className="scrum-product-goal-text">{productGoalText}</p>
            <p className="text-muted text-xs scrum-ctx-hint">Right-click to edit or delete</p>
          </div>
        ) : (
          <div className="scrum-product-empty">
            <p className="text-muted text-sm">No product goal yet. Add one here, or run an AI task import that includes a product goal.</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={openProductModal}>
              Add product goal
            </button>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="scrum-sprint-header">
          <button type="button" className="btn btn-ghost btn-sm scrum-sprint-nav" aria-label="Scroll sprints left" onClick={() => scrollSprints(-1)}>
            ‹
          </button>
          <div className="scrum-sprint-strip-wrap" ref={sprintStripRef}>
            <div className="scrum-sprint-strip">
              {Array.from({ length: maxSprint }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  type="button"
                  className={`scrum-sprint-pill${n === sprintNum ? ' is-active' : ''}${n === todayMatchSprint ? ' is-calendar-match' : ''}`}
                  onClick={() => setSprintNum(n)}
                >
                  Sprint {n}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm scrum-sprint-nav" aria-label="Scroll sprints right" onClick={() => scrollSprints(1)}>
            ›
          </button>
        </div>
        <p className="text-muted text-sm mb-3">
          {doneCount} of {totalSprint || '—'} tasks complete in this sprint · pills marked for the sprint that matches today&apos;s date
        </p>

        <div
          className="scrum-sprint-goal-display"
          onContextMenu={onSprintGoalContextMenu}
          role="presentation"
        >
          <div className="scrum-sprint-goal-row">
            <span className="scrum-sprint-goal-label">Sprint goal</span>
            <p className="scrum-sprint-goal-body">{currentGoal?.goal?.trim() || '— No goal set —'}</p>
          </div>
          <div className="scrum-sprint-goal-row">
            <span className="scrum-sprint-goal-label">Deadline</span>
            <p className="scrum-sprint-goal-body">{formatDue(currentGoal?.sprintDueDate) || '—'}</p>
          </div>
          <p className="text-muted text-xs scrum-ctx-hint">Right-click to edit or delete</p>
        </div>
      </section>

      <section className="panel panel--flush">
        <h2 className="panel-heading px-panel">Board</h2>
        <p className="text-muted text-sm px-panel mb-2">Drag cards between columns. Right-click a card to edit or delete. Use + to add a task to a column.</p>
        <div className="scrum-board scrum-board--minimal">
          {(
            [
              ['todo', 'To do', columns.todo],
              ['progress', 'In progress', columns.progress],
              ['done', 'Done', columns.done],
            ] as const
          ).map(([key, title, list]) => (
            <div key={key} className="scrum-col">
              <div className="scrum-col-head scrum-col-head--with-action">
                <span>
                  {title}
                  <span className="scrum-col-count">{list.length}</span>
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs scrum-col-add"
                  aria-label={`Add task to ${title}`}
                  onClick={() => openNewTask(key)}
                >
                  +
                </button>
              </div>
              <div
                className={`scrum-col-body${dragOver === key ? ' scrum-col-body--drag-over' : ''}`}
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
                {list.length === 0 ? (
                  <p className="scrum-col-empty">Drop tasks here</p>
                ) : (
                  list.map(t => (
                    <div
                      key={t.id}
                      className="scrum-task-card"
                      draggable
                      onDragStart={e => {
                        e.dataTransfer.setData('application/task-id', String(t.id));
                        e.dataTransfer.setData('text/plain', String(t.id));
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => setDragOver(null)}
                      onContextMenu={e => onTaskContextMenu(e, t.id)}
                      role="presentation"
                    >
                      <p className="scrum-task-title">{t.name}</p>
                      {t.assignments.length > 0 && (
                        <div className="scrum-task-avatars">
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
                      )}
                      <label className="scrum-po" onClick={e => e.stopPropagation()} onContextMenu={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={t.acceptedByPO}
                          onChange={async e => {
                            await toggleAcceptedByPO(t.id, e.target.checked, currentMember?.id);
                            loadTasks();
                          }}
                        />
                        PO ok
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-heading">Sprint reviews</h2>
        <div className="form-row">
          <label>Add note</label>
          <textarea
            rows={2}
            value={reviewBody}
            onChange={e => setReviewBody(e.target.value)}
            placeholder="What went well, what to improve"
            disabled={!currentMember}
          />
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm mb-3"
          disabled={!currentMember || !reviewBody.trim()}
          onClick={async () => {
            if (!currentMember || !reviewBody.trim()) return;
            await addSprintReview(sprintNum, currentMember.id, reviewBody.trim());
            setReviewBody('');
            loadReviews();
          }}
        >
          Post
        </button>
        <ul className="reviews-minimal">
          {reviews.map(r => (
            <li key={r.id} className="reviews-minimal-item">
              <UserAvatar member={{ name: r.memberName, color: r.memberColor, avatarInitial: r.memberAvatarInitial }} size="sm" />
              <div>
                <div className="reviews-minimal-meta">
                  <span>{r.memberName}</span>
                  <time className="text-muted text-xs">{new Date(r.createdAt).toLocaleDateString()}</time>
                </div>
                <p className="reviews-minimal-body">{r.content}</p>
              </div>
            </li>
          ))}
        </ul>
        {reviews.length === 0 && <p className="panel-empty">No reviews yet.</p>}
      </section>

      {ctxMenu && (
        <div
          className="scrum-context-menu"
          style={menuPosition(ctxMenu)}
          role="menu"
          onMouseDown={e => e.stopPropagation()}
        >
          {ctxMenu.kind === 'product' && (
            <>
              <button type="button" role="menuitem" className="scrum-context-menu-item" onClick={openProductModal}>
                Edit
              </button>
              <button
                type="button"
                role="menuitem"
                className="scrum-context-menu-item scrum-context-menu-item--danger"
                onClick={() => {
                  setCtxMenu(null);
                  setDeleteConfirm({ type: 'product' });
                }}
                disabled={!productGoalText}
              >
                Delete
              </button>
            </>
          )}
          {ctxMenu.kind === 'sprint' && (
            <>
              <button type="button" role="menuitem" className="scrum-context-menu-item" onClick={openSprintGoalModal}>
                Edit
              </button>
              <button
                type="button"
                role="menuitem"
                className="scrum-context-menu-item scrum-context-menu-item--danger"
                onClick={() => {
                  setCtxMenu(null);
                  setDeleteConfirm({ type: 'sprint' });
                }}
                disabled={!currentGoal}
              >
                Delete
              </button>
            </>
          )}
          {ctxMenu.kind === 'task' && (
            <>
              <button
                type="button"
                role="menuitem"
                className="scrum-context-menu-item"
                onClick={() => {
                  const task = tasks.find(x => x.id === ctxMenu.taskId);
                  setCtxMenu(null);
                  if (task) setEditingTask(task);
                }}
              >
                Edit
              </button>
              <button
                type="button"
                role="menuitem"
                className="scrum-context-menu-item scrum-context-menu-item--danger"
                onClick={() => {
                  const id = ctxMenu.taskId;
                  setCtxMenu(null);
                  setDeleteConfirm({ type: 'task', id });
                }}
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}

      {productModalOpen && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">Product</span>
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
              <span className="modal-title">Sprint {sprintNum} goal</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSprintGoalModalOpen(false)}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <label>Goal</label>
                <textarea rows={3} value={sprintGoalDraft} onChange={e => setSprintGoalDraft(e.target.value)} placeholder="Focus for this sprint" />
              </div>
              <div className="form-row">
                <label>Sprint deadline</label>
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
          message="Clear the product goal? Website and GitHub links are kept unless you remove them in the editor."
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
          message={`Delete the saved goal and deadline for sprint ${sprintNum}?`}
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
