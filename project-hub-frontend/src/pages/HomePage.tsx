import { useEffect, useState, useMemo, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import {
  getTasks,
  getRecentUpdates,
  getProjectSettings,
  getMembers,
  getSprintGoals,
  updateTaskStatus,
  updateProjectSettings,
  updateTask,
  assignTask,
} from '../api/client';
import type { TaskItem, TaskUpdate, GroupMember, TaskStatus, CreateTaskDto, SprintGoal } from '../types';
import UserAvatar from '../components/common/UserAvatar';
import TaskFormModal from '../components/Tasks/TaskFormModal';
import { useAuth } from '../auth/AuthContext';
import { inferCurrentSprintNumber } from '../lib/sprintCurrent';

function fmtDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function isToday(iso?: string) {
  if (!iso) return false;
  return new Date(iso).toDateString() === new Date().toDateString();
}

function daysUntil(iso: string): number {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86_400_000);
}

function nextStatus(s: TaskStatus): TaskStatus {
  if (s === 'NotStarted') return 'InProgress';
  if (s === 'InProgress') return 'Completed';
  return 'NotStarted';
}

type LinkEditKind = 'website' | 'github';

function StatCard({
  label,
  value,
  accent,
  note,
}: {
  label: string;
  value: string | number;
  accent: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
  note?: string;
}) {
  return (
    <div className={`home-stat-card home-stat-card--${accent}`}>
      <span className="home-stat-value">{value}</span>
      <span className="home-stat-label">{label}</span>
      {note && <span className="home-stat-note">{note}</span>}
    </div>
  );
}

function HomeStatLinkCard({
  kind,
  url,
  heading,
  linkLabel,
  accent,
  onEdit,
  onContextMenu,
}: {
  kind: LinkEditKind;
  url?: string;
  heading: string;
  linkLabel: string;
  accent: 'neutral' | 'primary';
  onEdit: () => void;
  onContextMenu: (e: ReactMouseEvent, k: LinkEditKind) => void;
}) {
  const isSet = !!url?.trim();
  const href = isSet ? (/^https?:\/\//i.test(url!) ? url! : `https://${url}`) : '';

  return (
    <div
      className={`home-stat-link-card home-stat-link-card--${accent}${!isSet ? ' home-stat-link-card--unset' : ''}`}
      onContextMenu={e => onContextMenu(e, kind)}
      title={isSet ? `${heading} — right-click to edit or remove` : `Set ${heading}`}
    >
      <span className="home-stat-link-heading">{heading}</span>
      {isSet ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="home-stat-link-anchor"
          onClick={e => e.stopPropagation()}
        >
          {linkLabel}
        </a>
      ) : (
        <button type="button" className="home-stat-link-placeholder btn btn-ghost btn-sm" onClick={onEdit}>
          Set link
        </button>
      )}
    </div>
  );
}

function StatusDot({ status, onClick }: { status: TaskStatus; onClick: () => void }) {
  const map = {
    NotStarted: { cls: 'todo', title: 'To do — click to start' },
    InProgress: { cls: 'progress', title: 'In progress — click to complete' },
    Completed: { cls: 'done', title: 'Completed — click to move back to to do' },
  };
  const { cls, title } = map[status];
  return (
    <button
      type="button"
      className={`home-status-dot home-status-dot--${cls}`}
      onClick={onClick}
      title={title}
      aria-label={title}
    />
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [sprintGoals, setSprintGoals] = useState<SprintGoal[]>([]);
  const [updates, setUpdates] = useState<TaskUpdate[]>([]);
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof getProjectSettings>> | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [linkEdit, setLinkEdit] = useState<LinkEditKind | null>(null);
  const [urlDraft, setUrlDraft] = useState('');
  const [ctxMenu, setCtxMenu] = useState<{ kind: LinkEditKind; x: number; y: number } | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  const load = () => {
    getTasks().then(setTasks);
    getRecentUpdates(8).then(setUpdates);
    getProjectSettings().then(setSettings);
    getMembers().then(setMembers);
    getSprintGoals().then(setSprintGoals);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!linkEdit || !settings) return;
    setUrlDraft(linkEdit === 'website' ? (settings.websiteUrl ?? '') : (settings.githubUrl ?? ''));
  }, [linkEdit, settings]);

  useEffect(() => {
    if (!ctxMenu) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (ctxRef.current?.contains(e.target as Node)) return;
      setCtxMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [ctxMenu]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const pct = total ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pct };
  }, [tasks]);

  const currentSprint = useMemo(
    () => inferCurrentSprintNumber(sprintGoals, tasks, settings?.sprintCount ?? 6),
    [sprintGoals, tasks, settings?.sprintCount],
  );

  const myTasks = useMemo(() => {
    if (!user) return [];
    return tasks
      .filter(t => t.assignments.some(a => a.groupMemberId === user.id))
      .sort((a, b) => {
        const rank = (t: TaskItem) =>
          t.status === 'InProgress' ? 0 : t.status === 'NotStarted' ? 1 : 2;
        const dr = rank(a) - rank(b);
        if (dr !== 0) return dr;
        return (a.deadline ?? '').localeCompare(b.deadline ?? '');
      });
  }, [tasks, user]);

  const upcoming = useMemo(() => {
    return tasks
      .filter(t => {
        if (t.status === 'Completed' || !t.deadline) return false;
        const d = daysUntil(t.deadline);
        return d >= -1 && d <= 5;
      })
      .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))
      .slice(0, 7);
  }, [tasks]);

  const cycleStatus = async (t: TaskItem) => {
    if (!user) return;
    await updateTaskStatus(t.id, nextStatus(t.status), user.id);
    load();
  };

  const reopenTask = async (t: TaskItem) => {
    if (!user || t.status !== 'Completed') return;
    await updateTaskStatus(t.id, 'NotStarted', user.id);
    load();
  };

  const onTaskBodyClick = (t: TaskItem) => {
    if (t.status === 'Completed') {
      void reopenTask(t);
    } else {
      setEditingTask(t);
    }
  };

  const saveTask = async (data: CreateTaskDto & { assigneeIds: number[]; subtaskNames: string[] }) => {
    if (!editingTask || !user) return;
    const { assigneeIds: ids, subtaskNames: _subs, ...rest } = data;
    await updateTask(editingTask.id, { ...rest, assigneeIds: undefined, subtaskNames: undefined }, user.id);
    await assignTask(editingTask.id, ids, user.id);
    setEditingTask(null);
    load();
  };

  const saveLink = async () => {
    if (!linkEdit) return;
    const trimmed = urlDraft.trim();
    await updateProjectSettings(
      linkEdit === 'website' ? { websiteUrl: trimmed || undefined } : { githubUrl: trimmed || undefined },
    );
    setSettings(await getProjectSettings());
    setLinkEdit(null);
  };

  const clearLink = async (kind: LinkEditKind) => {
    await updateProjectSettings(kind === 'website' ? { websiteUrl: undefined } : { githubUrl: undefined });
    setSettings(await getProjectSettings());
    setCtxMenu(null);
  };

  const openLinkCtx = (e: ReactMouseEvent, kind: LinkEditKind) => {
    e.preventDefault();
    setCtxMenu({ kind, x: e.clientX, y: e.clientY });
  };

  return (
    <div className="home-page">
      <div className="home-header">
        <div className="home-header-left">
          <h1 className="home-title">Dashboard</h1>
          <p className="home-subtitle">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="home-stats-row">
        <StatCard
          label="Progress"
          value={`${stats.pct}%`}
          accent="primary"
          note={`${stats.completed} of ${stats.total} done`}
        />
        <StatCard label="Completed" value={stats.completed} accent="success" />
        <StatCard label="Sprint day" value={currentSprint} accent="warning" />
        <HomeStatLinkCard
          kind="website"
          url={settings?.websiteUrl}
          heading="Website"
          linkLabel="Project site"
          accent="neutral"
          onEdit={() => setLinkEdit('website')}
          onContextMenu={openLinkCtx}
        />
        <HomeStatLinkCard
          kind="github"
          url={settings?.githubUrl}
          heading="GitHub"
          linkLabel="Repository"
          accent="primary"
          onEdit={() => setLinkEdit('github')}
          onContextMenu={openLinkCtx}
        />
      </div>

      {stats.total > 0 && (
        <div className="home-progress-bar-wrap">
          <div className="home-progress-bar">
            <div
              className={`home-progress-fill${stats.pct === 100 ? ' home-progress-fill--complete' : ''}`}
              style={{ width: `${stats.pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="home-body-grid">
        <section className="home-panel home-my-tasks">
          <div className="home-panel-header">
            <h2 className="home-panel-title">My Tasks</h2>
            {myTasks.length > 0 && <span className="home-panel-count">{myTasks.length}</span>}
          </div>

          {myTasks.length === 0 ? (
            <p className="home-empty">No tasks are assigned to you yet.</p>
          ) : (
            <ul className="home-task-list">
              {myTasks.map(t => {
                const overdue = t.status !== 'Completed' && t.deadline && daysUntil(t.deadline) < 0;
                const today = isToday(t.deadline);
                return (
                  <li
                    key={t.id}
                    className={`home-task-item${overdue ? ' home-task-item--overdue' : ''}${t.status === 'Completed' ? ' home-task-item--done' : ''}`}
                  >
                    <StatusDot status={t.status} onClick={() => void cycleStatus(t)} />

                    <button type="button" className="home-task-body" onClick={() => onTaskBodyClick(t)}>
                      <span className={`home-task-name${t.status === 'Completed' ? ' home-task-name--done' : ''}`}>
                        {t.name}
                      </span>
                      <span className="home-task-chips">
                        {t.sprintNumber != null && <span className="home-task-sprint">S{t.sprintNumber}</span>}
                        {t.deadline && (
                          <span
                            className={`home-task-due${overdue ? ' home-task-due--late' : today ? ' home-task-due--today' : ''}`}
                          >
                            {today ? 'Today' : fmtDate(t.deadline)}
                          </span>
                        )}
                        <span className={`home-task-status-chip home-task-status-chip--${t.status.toLowerCase()}`}>
                          {t.status === 'NotStarted'
                            ? 'To do'
                            : t.status === 'InProgress'
                              ? 'In progress'
                              : 'Completed'}
                        </span>
                      </span>
                      {t.status === 'Completed' && (
                        <span className="home-task-reopen-hint">Click to move back to to do</span>
                      )}
                    </button>

                    {t.assignments.length > 0 && (
                      <span className="home-task-avatars">
                        {t.assignments.slice(0, 3).map(a => {
                          const m = members.find(x => x.id === a.groupMemberId);
                          return m ? <UserAvatar key={a.id} member={m} size="sm" /> : null;
                        })}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="home-right-col">
          <section className="home-panel home-upcoming">
            <div className="home-panel-header">
              <h2 className="home-panel-title">Upcoming Deadlines</h2>
              {upcoming.length > 0 && <span className="home-panel-count">{upcoming.length}</span>}
            </div>

            {upcoming.length === 0 ? (
              <p className="home-empty">No upcoming deadlines.</p>
            ) : (
              <ul className="home-deadline-list">
                {upcoming.map(t => {
                  const d = daysUntil(t.deadline!);
                  const isLate = d < 0;
                  const isSoon = d >= 0 && d <= 1;
                  return (
                    <li key={t.id} className="home-deadline-item">
                      <span
                        className={`home-deadline-marker${isLate ? ' home-deadline-marker--late' : isSoon ? ' home-deadline-marker--soon' : ''}`}
                      />
                      <button type="button" className="home-deadline-body" onClick={() => setEditingTask(t)}>
                        <span className={`home-deadline-name${isLate ? ' home-deadline-name--late' : ''}`}>{t.name}</span>
                        <span className={`home-deadline-date${isLate ? ' text-danger' : isSoon ? ' text-warning' : 'text-muted'}`}>
                          {isLate
                            ? `${Math.abs(d)}d overdue`
                            : d === 0
                              ? 'Due today'
                              : d === 1
                                ? 'Due tomorrow'
                                : fmtDate(t.deadline)}
                        </span>
                      </button>
                      {t.sprintNumber != null && <span className="home-task-sprint">S{t.sprintNumber}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="home-panel home-activity">
            <div className="home-panel-header">
              <h2 className="home-panel-title">Recent Activity</h2>
            </div>

            {updates.length === 0 ? (
              <p className="home-empty">No activity recorded yet.</p>
            ) : (
              <ul className="home-feed home-feed--scroll">
                {updates.map(u => {
                  const m = u.groupMemberId ? members.find(x => x.id === u.groupMemberId) : null;
                  return (
                    <li key={u.id} className="home-feed-item">
                      <span className="home-feed-avatar">
                        {m ? <UserAvatar member={m} size="sm" /> : <span className="home-feed-system-dot" />}
                      </span>
                      <span className="home-feed-content">
                        <span className="home-feed-msg">{u.message}</span>
                        <span className="home-feed-meta">
                          <span className="home-feed-task">{u.taskName}</span>
                          <span className="home-feed-time text-muted">
                            {fmtDateLong(u.createdAt)} at {fmtTime(u.createdAt)}
                          </span>
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      {editingTask && (
        <TaskFormModal task={editingTask} members={members} onSave={saveTask} onClose={() => setEditingTask(null)} />
      )}

      {linkEdit && (
        <div className="modal-overlay" onClick={() => setLinkEdit(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">
                {linkEdit === 'website' ? 'Project Website URL' : 'GitHub Repository URL'}
              </span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLinkEdit(null)}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <p className="text-muted text-sm mb-2">Paste the full URL. Leave blank to clear the link.</p>
              <input
                value={urlDraft}
                onChange={e => setUrlDraft(e.target.value)}
                placeholder={linkEdit === 'website' ? 'https://your-project.site' : 'https://github.com/org/repo'}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && void saveLink()}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setLinkEdit(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => void clearLink(linkEdit)}>
                Remove link
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void saveLink()}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {ctxMenu && (
        <div
          ref={ctxRef}
          className="home-link-ctx-menu"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          role="menu"
        >
          <button
            type="button"
            className="home-link-ctx-item"
            role="menuitem"
            onClick={() => {
              setLinkEdit(ctxMenu.kind);
              setCtxMenu(null);
            }}
          >
            Edit URL
          </button>
          <button
            type="button"
            className="home-link-ctx-item home-link-ctx-item--danger"
            role="menuitem"
            onClick={() => void clearLink(ctxMenu.kind)}
          >
            Delete link
          </button>
        </div>
      )}
    </div>
  );
}
