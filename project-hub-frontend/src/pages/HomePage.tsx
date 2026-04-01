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
import UserAvatar from '../components/common/UserAvatar';
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

function statusShort(s: TaskStatus) {
  if (s === 'InProgress') return 'In progress';
  if (s === 'Completed') return 'Done';
  return 'To do';
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
    getRecentUpdates(12).then(setUpdates);
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

  const upcomingDeadlines = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return tasks
      .filter(t => t.deadline && t.status !== 'Completed' && new Date(t.deadline) >= start)
      .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
      .slice(0, 10);
  }, [tasks]);

  const cycleStatus = async (t: TaskItem) => {
    if (!user) return;
    await updateTaskStatus(t.id, nextStatus(t.status), user.id);
    load();
  };

  return (
    <div className="page">
      <header className="page-title-block">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of your project</p>
        </div>
        {(settings?.websiteUrl || settings?.githubUrl) && (
          <div className="page-title-links">
            {settings?.websiteUrl && (
              <a href={settings.websiteUrl} target="_blank" rel="noreferrer">
                Website
              </a>
            )}
            {settings?.websiteUrl && settings?.githubUrl && <span className="page-title-links-sep">·</span>}
            {settings?.githubUrl && (
              <a href={settings.githubUrl} target="_blank" rel="noreferrer">
                GitHub
              </a>
            )}
          </div>
        )}
      </header>

      <section className="stat-strip" aria-label="Task statistics">
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
        <div className="stat-item stat-item--alert">
          <span className="stat-item-value">{stats.overdue}</span>
          <span className="stat-item-label">Overdue</span>
        </div>
        <div className="stat-item">
          <span className="stat-item-value">{stats.total}</span>
          <span className="stat-item-label">Total</span>
        </div>
      </section>

      <section className="panel panel--focus">
        <h2 className="panel-heading">My tasks</h2>
        {mine.length === 0 ? (
          <p className="panel-empty">No tasks assigned to you.</p>
        ) : (
          <ul className="home-task-list">
            {mine.map(t => {
              const overdue = t.deadline && t.status !== 'Completed' && new Date(t.deadline) < new Date();
              return (
                <li key={t.id} className={`home-task-row${overdue ? ' home-task-row--overdue' : ''}`}>
                  <div className="home-task-main">
                    <span className="home-task-name">{t.name}</span>
                    <span className={`home-task-status home-task-status--${t.status}`}>{statusShort(t.status)}</span>
                  </div>
                  <div className="home-task-meta">
                    {t.deadline && (
                      <span className={overdue ? 'text-danger' : 'text-muted'}>
                        {formatDay(t.deadline)}
                        {isToday(t.deadline) && ' · today'}
                      </span>
                    )}
                    <div className="home-task-avatars">
                      {t.assignments.map(a => {
                        const m = members.find(x => x.id === a.groupMemberId);
                        return m ? <UserAvatar key={a.id} member={m} size="sm" /> : null;
                      })}
                    </div>
                  </div>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => cycleStatus(t)}>
                    Mark: {t.status === 'Completed' ? 'reopen' : t.status === 'NotStarted' ? 'start' : 'done'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="panel-grid-2">
        <section className="panel">
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

        <section className="panel">
          <h2 className="panel-heading">Upcoming deadlines</h2>
          {upcomingDeadlines.length === 0 ? (
            <p className="panel-empty">No upcoming deadlines.</p>
          ) : (
            <ul className="deadline-list">
              {upcomingDeadlines.map(t => (
                <li key={t.id} className="deadline-list-item">
                  <div>
                    <span className="deadline-list-title">{t.name}</span>
                    {t.sprintNumber != null && (
                      <span className="text-muted text-xs"> Sprint {t.sprintNumber}</span>
                    )}
                  </div>
                  <time className={isToday(t.deadline) ? 'deadline-list-date deadline-list-date--soon' : 'deadline-list-date'}>
                    {t.deadline && formatDay(t.deadline)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {links.length > 0 && (
        <section className="panel panel--compact">
          <h2 className="panel-heading">Quick links</h2>
          <ul className="quick-links-inline">
            {links.slice(0, 8).map(l => (
              <li key={l.id}>
                <a href={l.url} target="_blank" rel="noreferrer">
                  {l.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
