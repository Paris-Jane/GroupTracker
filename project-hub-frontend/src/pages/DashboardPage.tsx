import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTasks, getRecentUpdates, getLinks, getReservations } from '../api/client';
import type { TaskItem, TaskUpdate, QuickLink, RoomReservation, GroupMember } from '../types';
import { StatusBadge, PriorityBadge } from '../components/common/StatusBadge';
import Avatar from '../components/common/Avatar';

interface Props {
  currentMember: GroupMember | null;
  members: GroupMember[];
}

function formatDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function isOverdue(deadline?: string, status?: string) {
  if (!deadline || status === 'Completed') return false;
  return new Date(deadline) < new Date();
}

function isThisWeek(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + 7);
  return d >= now && d <= weekEnd;
}

export default function DashboardPage({ currentMember, members }: Props) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [updates, setUpdates] = useState<TaskUpdate[]>([]);
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [reservations, setReservations] = useState<RoomReservation[]>([]);

  useEffect(() => {
    getTasks().then(setTasks);
    getRecentUpdates(15).then(setUpdates);
    getLinks().then(setLinks);
    getReservations().then(setReservations);
  }, []);

  const myTasks = currentMember
    ? tasks.filter(t => t.assignments.some(a => a.groupMemberId === currentMember.id))
    : [];

  const upcoming = tasks
    .filter(t => t.deadline && t.status !== 'Completed' && isThisWeek(t.deadline))
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());

  const thisWeekRooms = reservations.filter(r => isThisWeek(r.date));

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'Completed').length;
  const overdueTasks = tasks.filter(t => isOverdue(t.deadline, t.status)).length;
  const inProgressTasks = tasks.filter(t => t.status === 'WorkingOnIt').length;

  return (
    <div>
      <div className="top-bar">
        <span className="top-bar-title">Dashboard</span>
        {currentMember && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avatar initial={currentMember.avatarInitial} color={currentMember.color} size="sm" />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Welcome, {currentMember.name}</span>
          </div>
        )}
      </div>

      <div className="page-body">

        {/* ── Summary cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <SummaryCard label="Total Tasks" value={totalTasks} icon="📋" color="var(--primary)" />
          <SummaryCard label="Completed" value={completedTasks} icon="✅" color="var(--success)" />
          <SummaryCard label="In Progress" value={inProgressTasks} icon="⚡" color="var(--warning)" />
          <SummaryCard label="Overdue" value={overdueTasks} icon="⚠️" color="var(--danger)" />
        </div>

        {/* ── Overall progress ── */}
        {totalTasks > 0 && (
          <div className="card mb-4" style={{ marginBottom: 24 }}>
            <div className="flex-between mb-2">
              <span className="card-title">Overall Progress</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {completedTasks} / {totalTasks} tasks completed
              </span>
            </div>
            <div className="progress-bar">
              <div
                className={`progress-fill${completedTasks === totalTasks ? ' complete' : ''}`}
                style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
              />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {Math.round((completedTasks / totalTasks) * 100)}% done
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

          {/* ── My Tasks ── */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">My Tasks</span>
              <Link to="/tasks" style={{ fontSize: 13 }}>View all →</Link>
            </div>
            {myTasks.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px' }}>
                <div>No tasks assigned to you yet.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {myTasks.slice(0, 5).map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13, color: isOverdue(t.deadline, t.status) ? 'var(--danger)' : 'var(--text)' }}>
                        {t.name}
                      </div>
                      {t.deadline && (
                        <div style={{ fontSize: 12, color: isOverdue(t.deadline, t.status) ? 'var(--danger)' : 'var(--text-muted)' }}>
                          Due {formatDate(t.deadline)} {isOverdue(t.deadline, t.status) && '(overdue)'}
                        </div>
                      )}
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                ))}
                {myTasks.length > 5 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>+{myTasks.length - 5} more</div>}
              </div>
            )}
          </div>

          {/* ── Upcoming Deadlines ── */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Upcoming Deadlines</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Next 7 days</span>
            </div>
            {upcoming.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px' }}>
                <div>No deadlines this week.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {upcoming.map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(t.deadline)}</div>
                    </div>
                    <PriorityBadge priority={t.priority} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* ── Recent Updates ── */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Recent Activity</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Last 15 updates</span>
            </div>
            {updates.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px' }}>
                <div>No recent activity.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 280, overflowY: 'auto' }}>
                {updates.map(u => (
                  <div key={u.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    {u.memberName ? (
                      <Avatar
                        initial={members.find(m => m.id === u.groupMemberId)?.avatarInitial ?? u.memberName[0]}
                        color={u.memberColor ?? '#aaa'}
                        size="sm"
                      />
                    ) : (
                      <span style={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', borderRadius: '50%', fontSize: 12, flexShrink: 0 }}>⚙️</span>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13 }}>
                        {u.memberName && <strong>{u.memberName}</strong>}
                        {u.memberName ? ' — ' : ''}{u.message}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {u.taskName} · {formatDateTime(u.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* ── Quick Links preview ── */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Quick Links</span>
                <Link to="/resources" style={{ fontSize: 13 }}>Manage →</Link>
              </div>
              {links.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No links saved yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {links.slice(0, 5).map(l => (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14 }}>🔗</span>
                      <div>
                        <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 500 }}>{l.title}</a>
                        {l.category && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>{l.category}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── This week's reservations ── */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Room Reservations</span>
                <Link to="/resources" style={{ fontSize: 13 }}>Manage →</Link>
              </div>
              {thisWeekRooms.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No rooms reserved this week.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {thisWeekRooms.map(r => (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{r.roomName}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {formatDate(r.date)} · {r.startTime}–{r.endTime} · {r.reservedBy}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}
