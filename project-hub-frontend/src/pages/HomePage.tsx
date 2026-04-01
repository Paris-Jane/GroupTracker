import { useEffect, useState, useMemo } from 'react';
import {
  getTasks,
  getRecentUpdates,
  getLinks,
  getProjectSettings,
  getMembers,
  updateTaskStatus,
} from '../api/client';
import type { TaskItem, TaskUpdate, QuickLink, GroupMember, TaskStatus } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import UserAvatar from '../components/common/UserAvatar';
import { useAuth } from '../auth/AuthContext';

function formatDay(d: string) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function isToday(iso?: string) {
  if (!iso) return false;
  const a = new Date(iso).toDateString();
  const b = new Date().toDateString();
  return a === b;
}

function nextStatus(s: TaskStatus): TaskStatus {
  if (s === 'NotStarted') return 'InProgress';
  if (s === 'InProgress') return 'Completed';
  return 'NotStarted';
}

function statusLabel(s: TaskStatus) {
  if (s === 'InProgress') return 'In Progress';
  if (s === 'Completed') return 'Completed';
  return 'Not Started';
}

export default function HomePage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [updates, setUpdates] = useState<TaskUpdate[]>([]);
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof getProjectSettings>> | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);

  const load = () => {
    getTasks().then(setTasks);
    getRecentUpdates(20).then(setUpdates);
    getLinks().then(setLinks);
    getProjectSettings().then(setSettings);
    getMembers().then(setMembers);
  };
  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const inProgress = tasks.filter(t => t.status === 'InProgress').length;
    const overdue = tasks.filter(
      t => t.deadline && t.status !== 'Completed' && new Date(t.deadline) < new Date(),
    ).length;
    const pct = total ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, overdue, pct };
  }, [tasks]);

  const mine = useMemo(() => {
    if (!user) return [];
    return tasks.filter(t => t.assignments.some(a => a.groupMemberId === user.id));
  }, [tasks, user]);

  const dueToday = useMemo(
    () => tasks.filter(t => t.deadline && isToday(t.deadline) && t.status !== 'Completed'),
    [tasks],
  );

  const cycleStatus = async (t: TaskItem) => {
    if (!user) return;
    const n = nextStatus(t.status);
    await updateTaskStatus(t.id, n, user.id);
    load();
  };

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1>Home</h1>
        <p className="page-lead">Dashboard for your group project</p>
      </header>

      <section className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Completion</div>
          <div className="stat-value">{stats.pct}%</div>
          <div className="stat-hint">of all tasks</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Completed</div>
          <div className="stat-value">{stats.completed}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">In progress</div>
          <div className="stat-value">{stats.inProgress}</div>
        </div>
        <div className="stat-card stat-card-warn">
          <div className="stat-label">Overdue</div>
          <div className="stat-value">{stats.overdue}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total tasks</div>
          <div className="stat-value">{stats.total}</div>
        </div>
      </section>

      <div className="quick-external">
        {settings?.websiteUrl ? (
          <a className="btn btn-secondary" href={settings.websiteUrl} target="_blank" rel="noreferrer">
            Project website
          </a>
        ) : null}
        {settings?.githubUrl ? (
          <a className="btn btn-secondary" href={settings.githubUrl} target="_blank" rel="noreferrer">
            GitHub
          </a>
        ) : null}
        {!settings?.websiteUrl && !settings?.githubUrl && (
          <span className="text-muted text-sm">Set website and GitHub URLs on the Scrum page (product settings).</span>
        )}
      </div>

      <section className="card-section">
        <h2 className="section-title">My assigned tasks</h2>
        {mine.length === 0 ? (
          <p className="empty-hint">No tasks assigned to you yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Sprint</th>
                  <th>Deadline</th>
                  <th>Status</th>
                  <th>Assigned</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {mine.map(t => (
                  <tr key={t.id} className={t.deadline && new Date(t.deadline) < new Date() && t.status !== 'Completed' ? 'row-overdue' : ''}>
                    <td className="cell-strong">{t.name}</td>
                    <td>{t.sprintNumber ?? '—'}</td>
                    <td>{t.deadline ? formatDay(t.deadline) : '—'}</td>
                    <td>
                      <StatusBadge status={t.status} />
                    </td>
                    <td>
                      <div className="avatar-row">
                        {t.assignments.map(a => {
                          const m = members.find(x => x.id === a.groupMemberId);
                          return m ? <UserAvatar key={a.id} member={m} size="sm" /> : null;
                        })}
                      </div>
                    </td>
                    <td>
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => cycleStatus(t)}>
                        {statusLabel(t.status)} → next
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="two-col">
        <section className="card-section">
          <h2 className="section-title">Recent updates</h2>
          {updates.length === 0 ? (
            <p className="empty-hint">No activity yet.</p>
          ) : (
            <ul className="feed-list">
              {updates.map(u => {
                const m = u.groupMemberId ? members.find(x => x.id === u.groupMemberId) : null;
                return (
                  <li key={u.id} className="feed-item">
                    {m ? <UserAvatar member={m} size="sm" /> : <span className="feed-dot" />}
                    <div>
                      <div className="feed-msg">{u.message}</div>
                      <div className="feed-meta">
                        <span className="cell-strong">{u.taskName}</span>
                        <span className="text-muted">{new Date(u.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card-section">
          <h2 className="section-title">Due today</h2>
          {dueToday.length === 0 ? (
            <p className="empty-hint">Nothing due today.</p>
          ) : (
            <ul className="simple-list">
              {dueToday.map(t => (
                <li key={t.id} className={new Date(t.deadline!) < new Date() ? 'text-danger' : ''}>
                  <span className="cell-strong">{t.name}</span>
                  <span className="text-muted">{t.sprintNumber != null ? `Sprint ${t.sprintNumber}` : ''}</span>
                </li>
              ))}
            </ul>
          )}
          <h2 className="section-title mt-4">Quick links</h2>
          {links.length === 0 ? (
            <p className="empty-hint">Add links on the Resources page.</p>
          ) : (
            <ul className="simple-list">
              {links.slice(0, 6).map(l => (
                <li key={l.id}>
                  <a href={l.url} target="_blank" rel="noreferrer">
                    {l.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
