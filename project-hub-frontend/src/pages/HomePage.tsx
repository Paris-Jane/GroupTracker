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

function formatDay(d: string) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function isToday(iso?: string) {
  if (!iso) return false;
  return new Date(iso).toDateString() === new Date().toDateString();
}

function nextStatus(s: TaskStatus): TaskStatus {
  if (s === 'NotStarted') return 'InProgress';
  if (s === 'InProgress') return 'Completed';
  return 'NotStarted';
}

function linkDisplayUrl(raw?: string): string {
  if (!raw?.trim()) return 'Set URL (right-click)';
  try {
    const u = raw.includes('://') ? raw : `https://${raw}`;
    return new URL(u).hostname.replace(/^www\./, '') || raw;
  } catch {
    return raw.slice(0, 28) + (raw.length > 28 ? '…' : '');
  }
}

type LinkEditKind = 'website' | 'github';

function StatLinkCard({
  kind,
  url,
  onEdit,
}: {
  kind: LinkEditKind;
  url?: string;
  onEdit: (k: LinkEditKind) => void;
}) {
  const open = () => {
    const u = url?.trim();
    if (u) {
      const href = /^https?:\/\//i.test(u) ? u : `https://${u}`;
      window.open(href, '_blank', 'noopener,noreferrer');
    } else {
      onEdit(kind);
    }
  };

  return (
    <button
      type="button"
      className={`stat-link-card stat-link-card--${kind}`}
      onClick={open}
      onContextMenu={e => {
        e.preventDefault();
        onEdit(kind);
      }}
      title={url ? `${kind === 'website' ? 'Website' : 'GitHub'} — right-click to edit URL` : 'Click to add URL, or right-click to edit'}
    >
      <span className="stat-link-card-kicker">{kind === 'website' ? 'Project site' : 'Repository'}</span>
      <span className="stat-link-card-label">{kind === 'website' ? 'Website' : 'GitHub'}</span>
      <span className="stat-link-card-url">{linkDisplayUrl(url)}</span>
    </button>
  );
}

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
    getRecentUpdates(10).then(setUpdates);
    getProjectSettings().then(setSettings);
    getMembers().then(setMembers);
  };
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!linkEdit || !settings) return;
    setUrlDraft(linkEdit === 'website' ? (settings.websiteUrl ?? '') : (settings.githubUrl ?? ''));
  }, [linkEdit, settings]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const inProgress = tasks.filter(t => t.status === 'InProgress').length;
    const pct = total ? Math.round((completed / total) * 100) : 0;
    return { completed, inProgress, pct };
  }, [tasks]);

  const mineSorted = useMemo(() => {
    if (!user) return [];
    const list = tasks.filter(t => t.assignments.some(a => a.groupMemberId === user.id));
    const rank = (t: TaskItem) => {
      if (t.status === 'InProgress') return 0;
      if (t.status === 'NotStarted') return 1;
      return 2;
    };
    return [...list].sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      return (a.deadline ?? '').localeCompare(b.deadline ?? '');
    });
  }, [tasks, user]);

  const cycleStatus = async (t: TaskItem) => {
    if (!user) return;
    await updateTaskStatus(t.id, nextStatus(t.status), user.id);
    load();
  };

  const saveTask = async (data: CreateTaskDto & { assigneeIds: number[]; subtaskNames: string[] }) => {
    if (!editingTask || !user) return;
    const { assigneeIds: ids, subtaskNames: subs, ...rest } = data;
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

  return (
    <div className="page">
      <header className="page-title-block">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Your project at a glance</p>
        </div>
      </header>

      <section className="stat-strip stat-strip--home" aria-label="Summary and project links">
        <div className="stat-item">
          <span className="stat-item-value">{stats.pct}%</span>
          <span className="stat-item-label">Complete</span>
        </div>
        <div className="stat-item">
          <span className="stat-item-value">{stats.completed}</span>
          <span className="stat-item-label">Done</span>
        </div>
        <div className="stat-item">
          <span className="stat-item-value">{stats.inProgress}</span>
          <span className="stat-item-label">In progress</span>
        </div>
        <StatLinkCard kind="website" url={settings?.websiteUrl} onEdit={setLinkEdit} />
        <StatLinkCard kind="github" url={settings?.githubUrl} onEdit={setLinkEdit} />
      </section>

      <div className="home-dashboard-split">
        <section className="panel panel--focus home-my-tasks-panel">
          <h2 className="panel-heading">My tasks</h2>
          {mineSorted.length === 0 ? (
            <p className="panel-empty">No tasks assigned to you.</p>
          ) : (
            <ul className="home-task-list">
              {mineSorted.map(t => {
                const overdue = t.deadline && t.status !== 'Completed' && new Date(t.deadline) < new Date();
                const done = t.status === 'Completed';
                const cycleClass =
                  t.status === 'Completed' ? 'done' : t.status === 'InProgress' ? 'progress' : 'todo';
                return (
                  <li
                    key={t.id}
                    className={`home-task-row${overdue ? ' home-task-row--overdue' : ''}${done ? ' home-task-row--completed' : ''}`}
                  >
                    <button
                      type="button"
                      className={`home-status-cycle home-status-cycle--${cycleClass}`}
                      onClick={e => {
                        e.stopPropagation();
                        void cycleStatus(t);
                      }}
                      aria-label={`Cycle status (currently ${t.status})`}
                      title="To do → In progress → Done"
                    />
                    <button type="button" className="home-task-row-hit" onClick={() => setEditingTask(t)}>
                      <div className="home-task-main">
                        <span className="home-task-name">{t.name}</span>
                      </div>
                      <div className="home-task-meta">
                        {t.deadline && (
                          <span className={overdue ? 'text-danger' : 'text-muted'}>
                            {formatDay(t.deadline)}
                            {isToday(t.deadline) && ' · today'}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="panel home-updates-panel">
          <h2 className="panel-heading">Recent updates</h2>
          {updates.length === 0 ? (
            <p className="panel-empty">No activity yet.</p>
          ) : (
            <ul className="feed-minimal">
              {updates.map(u => {
                const m = u.groupMemberId ? members.find(x => x.id === u.groupMemberId) : null;
                return (
                  <li key={u.id} className="feed-minimal-item">
                    {m ? <UserAvatar member={m} size="sm" /> : <span className="feed-minimal-dot" />}
                    <div>
                      <p className="feed-minimal-msg">{u.message}</p>
                      <p className="feed-minimal-meta">
                        <span>{u.taskName}</span>
                        <span className="text-muted">{new Date(u.createdAt).toLocaleDateString()}</span>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {editingTask && (
        <TaskFormModal task={editingTask} members={members} onSave={saveTask} onClose={() => setEditingTask(null)} />
      )}

      {linkEdit && (
        <div className="modal-overlay" onClick={() => setLinkEdit(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{linkEdit === 'website' ? 'Website URL' : 'GitHub URL'}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLinkEdit(null)}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <p className="text-muted text-sm mb-2">Paste a full URL (https://…). Leave empty to clear.</p>
              <input
                value={urlDraft}
                onChange={e => setUrlDraft(e.target.value)}
                placeholder={linkEdit === 'website' ? 'https://your-project.site' : 'https://github.com/org/repo'}
                autoFocus
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
