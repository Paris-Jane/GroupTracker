import { useEffect, useMemo, useRef, useState, useCallback, type CSSProperties } from 'react';
import {
  getTasks,
  getProjectSettings,
  updateProjectSettings,
  getSprintGoals,
  upsertSprintGoal,
  deleteSprintGoal,
  getSprintReviews,
  addSprintReview,
  updateSprintReview,
  deleteSprintReview,
  updateTaskStatus,
  createTask,
  updateTask,
  assignTask,
  deleteTask,
} from '../api/client';
import type {
  GroupMember,
  TaskItem,
  TaskStatus,
  CreateTaskDto,
  SprintReview,
  SprintReviewKind,
} from '../types';
import { inferCurrentSprintNumber, parseLocalDate } from '../lib/sprintCurrent';
import UserAvatar from '../components/common/UserAvatar';
import Avatar from '../components/common/Avatar';
import TaskFormModal from '../components/Tasks/TaskFormModal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { memberChipColor } from '../components/Tasks/TaskFilters';

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

type BoardCol = 'todo' | 'progress' | 'done';

type CtxMenu = { kind: 'details'; clientX: number; clientY: number };

function SprintBoardCard({
  task,
  members,
  currentMember,
  onOpenTask,
  onAssigneesUpdated,
  onDragEnd,
}: {
  task: TaskItem;
  members: GroupMember[];
  currentMember: GroupMember | null;
  onOpenTask: () => void;
  onAssigneesUpdated: () => void;
  onDragEnd: () => void;
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  const assignWrapRef = useRef<HTMLDivElement>(null);

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
    await assignTask(task.id, next, currentMember?.id);
    onAssigneesUpdated();
  };

  return (
    <div
      className="sprint-b-card"
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('application/task-id', String(task.id));
        e.dataTransfer.setData('text/plain', String(task.id));
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragEnd={onDragEnd}
      onClick={e => {
        if ((e.target as HTMLElement).closest('.sprint-b-card-assign-wrap')) return;
        onOpenTask();
      }}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenTask();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <h3 className="sprint-b-card-title">{task.name}</h3>
      <div
        className="sprint-b-card-assign-wrap"
        ref={assignWrapRef}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
      >
        <div className="sprint-b-card-assign-inner">
          {task.assignments.length > 0 ? (
            <div className="sprint-b-card-avatars">
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
          ) : null}
          <button
            type="button"
            className="sprint-b-assign-plus"
            onClick={() => setAssignOpen(o => !o)}
            aria-expanded={assignOpen}
            aria-label={task.assignments.length ? 'Edit assignees' : 'Assign people'}
          >
            <span aria-hidden>+</span>
          </button>
        </div>
        {assignOpen && (
          <div className="task-assign-popover task-assign-popover--icons sprint-b-assign-popover" role="dialog" aria-label="Choose assignees">
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
  );
}

function clampMenuPosition(clientX: number, clientY: number, menuW: number, menuH: number) {
  const pad = 8;
  let left = clientX;
  let top = clientY;
  if (left + menuW > window.innerWidth - pad) left = window.innerWidth - menuW - pad;
  if (top + menuH > window.innerHeight - pad) top = window.innerHeight - menuH - pad;
  return { left, top };
}

export default function ScrumPage({ currentMember, members }: Props) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof getProjectSettings>> | null>(null);
  const [sprintGoals, setSprintGoals] = useState<Awaited<ReturnType<typeof getSprintGoals>>>([]);
  const [sprintNum, setSprintNum] = useState(1);
  const [reviews, setReviews] = useState<SprintReview[]>([]);
  const [reviewWellBody, setReviewWellBody] = useState('');
  const [reviewImproveBody, setReviewImproveBody] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);

  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [productGoalDraft, setProductGoalDraft] = useState('');
  const [sprintGoalDraft, setSprintGoalDraft] = useState('');
  const [sprintDueDraft, setSprintDueDraft] = useState('');

  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [dragOver, setDragOver] = useState<BoardCol | null>(null);
  const [editingTask, setEditingTask] = useState<TaskItem | null | 'new'>(null);
  const [newTaskDefaults, setNewTaskDefaults] = useState<{
    status?: TaskStatus;
    sprintNumber?: number;
  } | null>(null);
  const [editingReview, setEditingReview] = useState<{
    id: number;
    content: string;
    reviewKind: SprintReviewKind;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<null | { type: 'sprint' } | { type: 'task'; id: number } | { type: 'review'; id: number }>(null);

  const autoSprintSet = useRef(false);
  const configuredSprintCount = settings?.sprintCount ?? 6;
  const todayMatchSprint = useMemo(
    () =>
      inferCurrentSprintNumber(sprintGoals, tasks, configuredSprintCount, settings?.sprintDeadlines),
    [sprintGoals, tasks, configuredSprintCount, settings?.sprintDeadlines],
  );

  const loadTasks = () => getTasks().then(setTasks);
  const loadGoals = () => getSprintGoals().then(setSprintGoals);
  const loadSettings = () =>
    getProjectSettings().then(s => {
      setSettings(s);
      setProductGoalDraft(s.productGoal);
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

  const maxSprint = configuredSprintCount;

  useEffect(() => {
    if (!settings) return;
    const m = settings.sprintCount ?? 6;
    if (tasks.length === 0 && sprintGoals.length === 0) return;
    if (!autoSprintSet.current) {
      setSprintNum(inferCurrentSprintNumber(sprintGoals, tasks, m, settings.sprintDeadlines));
      autoSprintSet.current = true;
    }
  }, [settings, tasks, sprintGoals]);

  useEffect(() => {
    const m = settings?.sprintCount ?? 6;
    if (sprintNum > m) setSprintNum(m);
  }, [settings?.sprintCount, sprintNum]);

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

  useEffect(() => {
    if (!ctxMenu) return;
    const close = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.sprint-ctx-menu')) return;
      setCtxMenu(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [ctxMenu]);

  const openDetailsModal = useCallback(() => {
    setCtxMenu(null);
    if (settings) setProductGoalDraft(settings.productGoal);
    setSprintGoalDraft(currentGoal?.goal ?? '');
    setSprintDueDraft(currentGoal?.sprintDueDate?.split('T')[0] ?? '');
    setDetailsModalOpen(true);
  }, [settings, currentGoal]);

  const saveDetailsModal = async () => {
    setSavingDetails(true);
    try {
      const next = await updateProjectSettings({
        productGoal: productGoalDraft,
      });
      setSettings(next);
      await upsertSprintGoal({
        sprintNumber: sprintNum,
        goal: sprintGoalDraft.trim(),
        sprintDueDate: sprintDueDraft || undefined,
      });
      await loadGoals();
      setDetailsModalOpen(false);
    } finally {
      setSavingDetails(false);
    }
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
  const sprintGoalText = currentGoal?.goal?.trim() ?? '';
  const adminDueRaw = settings?.sprintDeadlines?.[sprintNum - 1]?.trim();
  const dueLabel =
    formatDue(currentGoal?.sprintDueDate) || (adminDueRaw ? formatDue(adminDueRaw) : null);
  const dueIso = (currentGoal?.sprintDueDate?.split('T')[0] ?? adminDueRaw) || undefined;

  const onDetailsContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ kind: 'details', clientX: e.clientX, clientY: e.clientY });
  };

  const menuPos = ctxMenu ? clampMenuPosition(ctxMenu.clientX, ctxMenu.clientY, 168, 88) : { left: 0, top: 0 };

  return (
    <div className="page sprint-page sprint-page--v3">
      {/* Section 1: Sprint details (single card) */}
      <section className="sprint-zone sprint-zone--details" aria-label="Sprint details">
        <div
          className="sprint-details-card"
          onContextMenu={onDetailsContextMenu}
        >
          <div className="sprint-details-tabs">
            {Array.from({ length: maxSprint }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                type="button"
                className={`sprint-details-tab${n === sprintNum ? ' is-active' : ''}${n === todayMatchSprint && n !== sprintNum ? ' is-suggested' : ''}`}
                onClick={() => setSprintNum(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="sprint-details-body">
            <div className="sprint-details-left">
              <h1 className="sprint-details-title">Sprint {sprintNum}</h1>
              <p className="sprint-details-due">
                {dueLabel ? (
                  <>
                    Due <time dateTime={dueIso ?? undefined}>{dueLabel}</time>
                  </>
                ) : (
                  <span className="sprint-details-due--muted">No deadline set</span>
                )}
              </p>
              <div className="sprint-details-block">
                <span className="sprint-details-k">Product goal</span>
                <p className="sprint-details-p">{productGoalText || '—'}</p>
              </div>
              <div className="sprint-details-block">
                <span className="sprint-details-k">Sprint goal</span>
                <p className="sprint-details-p">{sprintGoalText || '—'}</p>
              </div>
            </div>
            <div className="sprint-details-right">
              <div className="sprint-details-progress" role="group" aria-label="Sprint completion">
                <div className="sprint-details-progress-row">
                  <span>
                    {totalSprint === 0 ? 'No tasks yet' : `${doneCount} of ${totalSprint} tasks complete`}
                  </span>
                  {totalSprint > 0 ? <span className="sprint-details-progress-pct">{progressPct}%</span> : null}
                </div>
                <div
                  className="sprint-details-bar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressPct}
                >
                  <div className="sprint-details-bar-fill" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Board */}
      <section className="sprint-zone sprint-zone--board" aria-label="Sprint board">
        <h2 className="sprint-zone-title sprint-retro-card-title">Sprint board</h2>
        <div className="sprint-board-shell">
        <div className="sprint-kanban-v3">
          {(
            [
              ['todo', 'To do', columns.todo] as const,
              ['progress', 'In progress', columns.progress] as const,
              ['done', 'Done', columns.done] as const,
            ] as const
          ).map(([key, title, list]) => (
            <div key={key} className={`sprint-col-v3 sprint-col-v3--${key}`}>
              <header className={`sprint-col-v3-head sprint-col-v3-head--${key}`}>
                <span className="sprint-col-v3-title">{title}</span>
                <span className="sprint-col-v3-count">{list.length}</span>
              </header>
              <div
                className={`sprint-col-v3-body${dragOver === key ? ' is-drag-over' : ''}`}
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
                {list.length === 0 ? <p className="sprint-col-v3-empty">No tasks</p> : null}
                {list.map(t => (
                  <SprintBoardCard
                    key={t.id}
                    task={t}
                    members={members}
                    currentMember={currentMember}
                    onOpenTask={() => setEditingTask(t)}
                    onAssigneesUpdated={() => loadTasks()}
                    onDragEnd={() => setDragOver(null)}
                  />
                ))}
              </div>
              <footer className="sprint-col-v3-foot">
                <button type="button" className="btn btn-secondary btn-sm sprint-col-v3-add" onClick={() => openNewTask(key)}>
                  + Add task
                </button>
              </footer>
            </div>
          ))}
        </div>
        </div>
      </section>

      {/* Section 3: Retrospective */}
      <section className="sprint-zone sprint-zone--review" aria-label="Sprint retrospective">
        <div className="sprint-retro-card">
          <h2 className="sprint-zone-title sprint-retro-card-title">Sprint retrospective</h2>
          <div className="sprint-retro-two-col">
            <div className="sprint-retro-column">
              <h3 className="sprint-retro-column-title">What went well</h3>
              <textarea
                className="sprint-review-textarea"
                rows={3}
                value={reviewWellBody}
                onChange={e => setReviewWellBody(e.target.value)}
                placeholder="Share positives, wins, and things that worked…"
                disabled={!currentMember}
              />
              <div className="sprint-review-compose-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!currentMember || !reviewWellBody.trim()}
                  onClick={async () => {
                    if (!currentMember || !reviewWellBody.trim()) return;
                    await addSprintReview(sprintNum, currentMember.id, reviewWellBody.trim(), 'well');
                    setReviewWellBody('');
                    loadReviews();
                  }}
                >
                  Post
                </button>
              </div>
              <ul className="sprint-review-list sprint-review-list--compact">
                {reviews
                  .filter(r => r.reviewKind !== 'improve')
                  .map(r => {
                    const isOwn = currentMember?.id === r.groupMemberId;
                    return (
                      <li key={r.id} className={`sprint-review-item${isOwn ? ' is-own' : ''}`}>
                        <UserAvatar
                          member={{ name: r.memberName, color: r.memberColor, avatarInitial: r.memberAvatarInitial }}
                          size="sm"
                        />
                        <div className="sprint-review-item-main">
                          <div className="sprint-review-item-line">
                            <span className="sprint-review-item-name">{r.memberName}</span>
                            <time className="sprint-review-item-date" dateTime={r.createdAt}>
                              {new Date(r.createdAt).toLocaleDateString()}
                            </time>
                            {isOwn ? (
                              <span className="sprint-review-hover-actions">
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs"
                                  onClick={() =>
                                    setEditingReview({ id: r.id, content: r.content, reviewKind: 'well' })
                                  }
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs text-danger"
                                  onClick={() => setDeleteConfirm({ type: 'review', id: r.id })}
                                >
                                  Delete
                                </button>
                              </span>
                            ) : null}
                          </div>
                          <p className="sprint-review-item-content">{r.content}</p>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </div>
            <div className="sprint-retro-column">
              <h3 className="sprint-retro-column-title">What can we improve on</h3>
              <textarea
                className="sprint-review-textarea"
                rows={3}
                value={reviewImproveBody}
                onChange={e => setReviewImproveBody(e.target.value)}
                placeholder="Blockers, lessons, and ideas for next sprint…"
                disabled={!currentMember}
              />
              <div className="sprint-review-compose-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!currentMember || !reviewImproveBody.trim()}
                  onClick={async () => {
                    if (!currentMember || !reviewImproveBody.trim()) return;
                    await addSprintReview(sprintNum, currentMember.id, reviewImproveBody.trim(), 'improve');
                    setReviewImproveBody('');
                    loadReviews();
                  }}
                >
                  Post
                </button>
              </div>
              <ul className="sprint-review-list sprint-review-list--compact">
                {reviews
                  .filter(r => r.reviewKind === 'improve')
                  .map(r => {
                    const isOwn = currentMember?.id === r.groupMemberId;
                    return (
                      <li key={r.id} className={`sprint-review-item${isOwn ? ' is-own' : ''}`}>
                        <UserAvatar
                          member={{ name: r.memberName, color: r.memberColor, avatarInitial: r.memberAvatarInitial }}
                          size="sm"
                        />
                        <div className="sprint-review-item-main">
                          <div className="sprint-review-item-line">
                            <span className="sprint-review-item-name">{r.memberName}</span>
                            <time className="sprint-review-item-date" dateTime={r.createdAt}>
                              {new Date(r.createdAt).toLocaleDateString()}
                            </time>
                            {isOwn ? (
                              <span className="sprint-review-hover-actions">
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs"
                                  onClick={() =>
                                    setEditingReview({ id: r.id, content: r.content, reviewKind: 'improve' })
                                  }
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs text-danger"
                                  onClick={() => setDeleteConfirm({ type: 'review', id: r.id })}
                                >
                                  Delete
                                </button>
                              </span>
                            ) : null}
                          </div>
                          <p className="sprint-review-item-content">{r.content}</p>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </div>
          </div>
          {reviews.length === 0 ? <p className="sprint-review-empty">No retrospective notes for this sprint yet.</p> : null}
        </div>
      </section>

      {ctxMenu && (
        <div className="sprint-ctx-menu" style={{ left: menuPos.left, top: menuPos.top }} role="menu">
          <button type="button" className="sprint-ctx-item" role="menuitem" onClick={openDetailsModal}>
            Edit sprint details
          </button>
          <button
            type="button"
            className="sprint-ctx-item sprint-ctx-item--danger"
            role="menuitem"
            onClick={() => {
              setCtxMenu(null);
              setDeleteConfirm({ type: 'sprint' });
            }}
            disabled={!currentGoal}
          >
            Delete sprint
          </button>
        </div>
      )}
      {detailsModalOpen && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">Sprint details</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetailsModalOpen(false)}>
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
                  disabled={savingDetails}
                />
              </div>
              <div className="form-row">
                <label>Sprint goal (this sprint)</label>
                <textarea rows={3} value={sprintGoalDraft} onChange={e => setSprintGoalDraft(e.target.value)} disabled={savingDetails} />
              </div>
              <div className="form-row">
                <label>Deadline</label>
                <input type="date" value={sprintDueDraft} onChange={e => setSprintDueDraft(e.target.value)} disabled={savingDetails} />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setDetailsModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" disabled={savingDetails} onClick={saveDetailsModal}>
                {savingDetails ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingReview && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Edit note</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingReview(null)}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <label>Note</label>
                <textarea
                  rows={4}
                  value={editingReview.content}
                  onChange={e => setEditingReview({ ...editingReview, content: e.target.value })}
                />
              </div>
              <p className="text-muted text-sm">
                Section:{' '}
                {editingReview.reviewKind === 'improve' ? 'What can we improve on' : 'What went well'}
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setEditingReview(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!editingReview.content.trim()}
                onClick={async () => {
                  await updateSprintReview(
                    editingReview.id,
                    editingReview.content.trim(),
                    editingReview.reviewKind,
                  );
                  setEditingReview(null);
                  loadReviews();
                }}
              >
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

      {deleteConfirm?.type === 'sprint' && (
        <ConfirmDialog
          message={`Remove the saved sprint goal and deadline for sprint ${sprintNum}? Your tasks are not deleted.`}
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
      {deleteConfirm?.type === 'review' && (
        <ConfirmDialog
          message="Delete this note?"
          onConfirm={async () => {
            await deleteSprintReview(deleteConfirm.id);
            setDeleteConfirm(null);
            loadReviews();
          }}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
