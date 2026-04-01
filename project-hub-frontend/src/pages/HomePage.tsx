import { useEffect, useState, useMemo } from 'react';
import {
  getTasks,
  getRecentUpdates,
  getProjectSettings,
  getMembers,
  updateTaskStatus,
  updateProjectSettings,
  updateTask,
  assignTask,
} from '../api/client';
import type { TaskItem, TaskUpdate, GroupMember, TaskStatus, CreateTaskDto } from '../types';
import UserAvatar from '../components/common/UserAvatar';
import TaskFormModal from '../components/Tasks/TaskFormModal';
import { useAuth } from '../auth/AuthContext';

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  return 'Completed';
}

function linkDisplayUrl(raw?: string): string {
  if (!raw?.trim()) return 'Click to set URL';
  try {
    const u = raw.includes('://') ? raw : `https://${raw}`;
    return new URL(u).hostname.replace(/^www\./, '') || raw;
  } catch {
    return raw.slice(0, 30) + (raw.length > 30 ? '...' : '');
  }
}

type LinkEditKind = 'website' | 'github';

// ── Stat Card ─────────────────────────────────────────────────────────────────

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

// ── Quick Link Button ─────────────────────────────────────────────────────────

function QuickLinkBtn({
  kind,
  url,
  onEdit,
}: {
  kind: LinkEditKind;
  url?: string;
  onEdit: (k: LinkEditKind) => void;
}) {
  const isSet = !!url?.trim();
  const open = () => {
    if (isSet) {
      const href = /^https?:\/\//i.test(url!) ? url! : `https://${url}`;
      window.open(href, '_blank', 'noopener,noreferrer');
    } else {
      onEdit(kind);
    }
  };
  return (
    <button
      type="button"
      className={`home-ql-btn home-ql-btn--${kind}${!isSet ? ' home-ql-btn--unset' : ''}`}
      onClick={open}
      onContextMenu={e => { e.preventDefault(); onEdit(kind); }}
      title={isSet ? `Open ${kind === 'website' ? 'project website' : 'GitHub'} — right-click to edit` : 'Click to set URL'}
    >
      <span className="home-ql-btn-icon">
        {kind === 'website' ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
          </svg>
        )}
      </span>
      <span className="home-ql-btn-body">
        <span className="home-ql-btn-label">{kind === 'website' ? 'Project Website' : 'GitHub'}</span>
        <span className="home-ql-btn-url">{linkDisplayUrl(url)}</span>
      </span>
      {isSet && (
        <svg className="home-ql-btn-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      )}
    </button>
  );
}

// ── Status Cycle Button ───────────────────────────────────────────────────────

function StatusDot({ status, onClick }: { status: TaskStatus; onClick: () => void }) {
  const map = {
    NotStarted: { cls: 'todo', title: 'Not started — click to start' },
    InProgress:  { cls: 'progress', title: 'In progress — click to complete' },
    Completed:   { cls: 'done', title: 'Completed' },
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

// ── Main Component ────────────────────────────────────────────────────────────

export default function HomePage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [updates, setUpdates] = useState<TaskUpdate[]>([]);
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof getProjectSettings>> | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [linkEdit, setLinkEdit] = useState<LinkEditKind | null>(null);
  const [urlDraft, setUrlDraft] = useState('');

  const load = () => {
    getTasks().then(setTasks);
    getRecentUpdates(15).then(setUpdates);
    getProjectSettings().then(setSettings);
    getMembers().then(setMembers);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!linkEdit || !settings) return;
    setUrlDraft(linkEdit === 'website' ? (settings.websiteUrl ?? '') : (settings.githubUrl ?? ''));
  }, [linkEdit, settings]);

  // ── Derived data ──

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const inProgress = tasks.filter(t => t.status === 'InProgress').length;
    const notStarted = tasks.filter(t => t.status === 'NotStarted').length;
    const now = new Date();
    const overdue = tasks.filter(t =>
      t.status !== 'Completed' && t.deadline && new Date(t.deadline) < now,
    ).length;
    const pct = total ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, notStarted, overdue, pct };
  }, [tasks]);

  const myTasks = useMemo(() => {
    if (!user) return [];
    return tasks
      .filter(t => t.assignments.some(a => a.groupMemberId === user.id))
      .sort((a, b) => {
        // In progress first, then not started, then completed
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
        return d >= -1 && d <= 5; // include yesterday (overdue) through 5 days out
      })
      .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))
      .slice(0, 7);
  }, [tasks]);

  const cycleStatus = async (t: TaskItem) => {
    if (!user) return;
    await updateTaskStatus(t.id, nextStatus(t.status), user.id);
    load();
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

  // ── Render ──

  return (
    <div className="home-page">

      {/* ── Header ── */}
      <div className="home-header">
        <div className="home-header-left">
          <h1 className="home-title">Dashboard</h1>
          <p className="home-subtitle">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="home-header-right">
          <QuickLinkBtn kind="website" url={settings?.websiteUrl} onEdit={setLinkEdit} />
          <QuickLinkBtn kind="github" url={settings?.githubUrl} onEdit={setLinkEdit} />
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="home-stats-row">
        <StatCard
          label="Progress"
          value={`${stats.pct}%`}
          accent="primary"
          note={`${stats.completed} of ${stats.total} done`}
        />
        <StatCard label="Completed" value={stats.completed} accent="success" />
        <StatCard label="In Progress" value={stats.inProgress} accent="warning" />
        <StatCard label="Not Started" value={stats.notStarted} accent="neutral" />
        <StatCard
          label="Overdue"
          value={stats.overdue}
          accent={stats.overdue > 0 ? 'danger' : 'neutral'}
        />
      </div>

      {/* ── Progress bar ── */}
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

      {/* ── Main two-column ── */}
      <div className="home-body-grid">

        {/* Left: My Tasks */}
        <section className="home-panel home-my-tasks">
          <div className="home-panel-header">
            <h2 className="home-panel-title">My Tasks</h2>
            {myTasks.length > 0 && (
              <span className="home-panel-count">{myTasks.length}</span>
            )}
          </div>

          {myTasks.length === 0 ? (
            <p className="home-empty">No tasks are assigned to you yet.</p>
          ) : (
            <ul className="home-task-list">
              {myTasks.map(t => {
                const overdue = t.status !== 'Completed' && t.deadline && daysUntil(t.deadline) < 0;
                const today = isToday(t.deadline);
                return (
                  <li key={t.id} className={`home-task-item${overdue ? ' home-task-item--overdue' : ''}${t.status === 'Completed' ? ' home-task-item--done' : ''}`}>
                    <StatusDot status={t.status} onClick={() => void cycleStatus(t)} />

                    <button
                      type="button"
                      className="home-task-body"
                      onClick={() => setEditingTask(t)}
                    >
                      <span className={`home-task-name${t.status === 'Completed' ? ' home-task-name--done' : ''}`}>
                        {t.name}
                      </span>
                      <span className="home-task-chips">
                        {t.sprintNumber != null && (
                          <span className="home-task-sprint">S{t.sprintNumber}</span>
                        )}
                        {t.deadline && (
                          <span className={`home-task-due${overdue ? ' home-task-due--late' : today ? ' home-task-due--today' : ''}`}>
                            {today ? 'Today' : fmtDate(t.deadline)}
                          </span>
                        )}
                        <span className={`home-task-status-chip home-task-status-chip--${t.status.toLowerCase()}`}>
                          {t.status === 'NotStarted' ? 'Not started' : t.status === 'InProgress' ? 'In progress' : 'Completed'}
                        </span>
                      </span>
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

        {/* Right column */}
        <div className="home-right-col">

          {/* Upcoming Deadlines */}
          <section className="home-panel home-upcoming">
            <div className="home-panel-header">
              <h2 className="home-panel-title">Upcoming Deadlines</h2>
              {upcoming.length > 0 && (
                <span className="home-panel-count">{upcoming.length}</span>
              )}
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
                      <span className={`home-deadline-marker${isLate ? ' home-deadline-marker--late' : isSoon ? ' home-deadline-marker--soon' : ''}`} />
                      <button
                        type="button"
                        className="home-deadline-body"
                        onClick={() => setEditingTask(t)}
                      >
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
                      {t.sprintNumber != null && (
                        <span className="home-task-sprint">S{t.sprintNumber}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Recent Activity */}
          <section className="home-panel home-activity">
            <div className="home-panel-header">
              <h2 className="home-panel-title">Recent Activity</h2>
            </div>

            {updates.length === 0 ? (
              <p className="home-empty">No activity recorded yet.</p>
            ) : (
              <ul className="home-feed">
                {updates.map(u => {
                  const m = u.groupMemberId
                    ? members.find(x => x.id === u.groupMemberId)
                    : null;
                  return (
                    <li key={u.id} className="home-feed-item">
                      <span className="home-feed-avatar">
                        {m ? (
                          <UserAvatar member={m} size="sm" />
                        ) : (
                          <span className="home-feed-system-dot" />
                        )}
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

      {/* ── Modals ── */}
      {editingTask && (
        <TaskFormModal
          task={editingTask}
          members={members}
          onSave={saveTask}
          onClose={() => setEditingTask(null)}
        />
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
              <button type="button" className="btn btn-primary" onClick={() => void saveLink()}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
