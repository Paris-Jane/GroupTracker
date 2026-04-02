import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { isAdminUser } from '../lib/admin';
import {
  getMembersForAdmin,
  updateMember,
  getProjectSettings,
  updateProjectSettings,
  adminBulkReset,
} from '../api/client';
import type { AdminMember, AdminBulkResetOptions } from '../types';
import ConfirmDialog from '../components/common/ConfirmDialog';

export default function AdminPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [sprintCount, setSprintCount] = useState(6);
  const [deadlines, setDeadlines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSprints, setSavingSprints] = useState(false);
  const [resetOpts, setResetOpts] = useState<AdminBulkResetOptions>({});
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isAdminUser(user)) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [m, s] = await Promise.all([getMembersForAdmin(), getProjectSettings()]);
        if (cancelled) return;
        setMembers(m);
        const n = s.sprintCount ?? 6;
        setSprintCount(n);
        const d = [...(s.sprintDeadlines ?? [])];
        while (d.length < n) d.push('');
        setDeadlines(d.slice(0, n));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!isAdminUser(user)) {
    return <Navigate to="/" replace />;
  }

  const saveMember = async (row: AdminMember, patch: Partial<AdminMember> & { password?: string }) => {
    setMessage('');
    await updateMember(row.id, {
      name: patch.name ?? row.name,
      username: patch.username ?? row.username,
      color: patch.color ?? row.color,
      avatarInitial: patch.avatarInitial ?? row.avatarInitial,
      ...(patch.password !== undefined && patch.password.trim() ? { password: patch.password.trim() } : {}),
    });
    setMembers(await getMembersForAdmin());
    setMessage('User saved.');
  };

  const saveSprints = async () => {
    setSavingSprints(true);
    setMessage('');
    try {
      const trimmed = deadlines.slice(0, sprintCount).map(d => d.trim());
      await updateProjectSettings({
        sprintCount,
        sprintDeadlines: trimmed,
      });
      setMessage('Sprint settings saved.');
    } finally {
      setSavingSprints(false);
    }
  };

  const onSprintCountChange = (n: number) => {
    const next = Math.max(1, Math.min(50, n));
    setSprintCount(next);
    setDeadlines(prev => {
      const copy = [...prev];
      while (copy.length < next) copy.push('');
      return copy.slice(0, next);
    });
  };

  const runReset = async () => {
    if (resetting) return;
    const any =
      resetOpts.tasks ||
      resetOpts.quickLinks ||
      resetOpts.resourceItems ||
      resetOpts.sprintGoalsAndReviews ||
      resetOpts.loginItems ||
      resetOpts.textNotes ||
      resetOpts.scheduleItems ||
      resetOpts.pokerAndPickSessions;
    if (!any) {
      setMessage('Select at least one item to reset.');
      setResetConfirm(false);
      return;
    }
    setResetting(true);
    setMessage('');
    try {
      await adminBulkReset(resetOpts);
      setResetConfirm(false);
      setResetOpts({});
      setMessage('Reset completed.');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="page admin-page">
      <header className="page-title-block">
        <div>
          <h1 className="page-title">Admin</h1>
          <p className="page-subtitle">Users, sprint configuration, and data reset</p>
        </div>
      </header>

      {message ? <p className="form-error admin-page-msg">{message}</p> : null}

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <>
          <section className="panel admin-section">
            <h2 className="panel-heading">Users</h2>
            <p className="text-muted text-sm mb-3">Edit display name, login username, password, and avatar color.</p>
            <div className="admin-user-list">
              {members.map(m => (
                <AdminUserRow key={m.id} member={m} onSave={saveMember} />
              ))}
            </div>
          </section>

          <section className="panel admin-section">
            <h2 className="panel-heading">Sprints</h2>
            <p className="text-muted text-sm mb-3">Number of sprints shown on the Sprint page and optional deadline per sprint (YYYY-MM-DD).</p>
            <div className="form-row admin-sprint-count">
              <label>Number of sprints</label>
              <input
                type="number"
                min={1}
                max={50}
                value={sprintCount}
                onChange={e => onSprintCountChange(Number(e.target.value))}
              />
            </div>
            <div className="admin-deadlines-grid">
              {Array.from({ length: sprintCount }, (_, i) => (
                <div key={i} className="form-row">
                  <label>Sprint {i + 1} deadline</label>
                  <input
                    type="date"
                    value={deadlines[i] ?? ''}
                    onChange={e => {
                      const next = [...deadlines];
                      next[i] = e.target.value;
                      setDeadlines(next);
                    }}
                  />
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-primary btn-sm mt-2" disabled={savingSprints} onClick={saveSprints}>
              {savingSprints ? 'Saving…' : 'Save sprint settings'}
            </button>
          </section>

          <section className="panel admin-section">
            <h2 className="panel-heading">Reset data</h2>
            <p className="text-muted text-sm mb-3">Select what to delete, then confirm. This cannot be undone.</p>
            <div className="admin-reset-grid">
              {(
                [
                  ['tasks', 'All tasks (and subtasks, assignments, ratings)'],
                  ['quickLinks', 'All quick links'],
                  ['resourceItems', 'All resource rows (project, class, other)'],
                  ['sprintGoalsAndReviews', 'Sprint goals & sprint reviews'],
                  ['loginItems', 'Saved logins'],
                  ['textNotes', 'Text notes'],
                  ['scheduleItems', 'Schedule items'],
                  ['pokerAndPickSessions', 'Planning poker & pick sessions'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="admin-reset-row">
                  <input
                    type="checkbox"
                    checked={!!resetOpts[key as keyof AdminBulkResetOptions]}
                    onChange={e => setResetOpts(o => ({ ...o, [key]: e.target.checked }))}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={() => setResetConfirm(true)}>
              Run reset…
            </button>
          </section>
        </>
      )}

      {resetConfirm && (
        <ConfirmDialog
          title="Reset data"
          message="Permanently delete the selected data? This cannot be undone."
          confirmLabel={resetting ? 'Working…' : 'Reset'}
          onConfirm={() => {
            if (!resetting) void runReset();
          }}
          onCancel={() => setResetConfirm(false)}
        />
      )}
    </div>
  );
}

function AdminUserRow({
  member,
  onSave,
}: {
  member: AdminMember;
  onSave: (m: AdminMember, patch: Partial<AdminMember> & { password?: string }) => void | Promise<void>;
}) {
  const [name, setName] = useState(member.name);
  const [username, setUsername] = useState(member.username ?? '');
  const [password, setPassword] = useState('');
  const [color, setColor] = useState(member.color ?? '#4A6FA5');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setName(member.name);
    setUsername(member.username ?? '');
    setColor(member.color ?? '#4A6FA5');
    setPassword('');
  }, [member]);

  return (
    <div className="admin-user-row">
      <div className="form-row">
        <label>Name</label>
        <input value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className="form-row">
        <label>Username</label>
        <input value={username} onChange={e => setUsername(e.target.value)} autoComplete="off" />
      </div>
      <div className="form-row">
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Leave blank to keep current"
          autoComplete="new-password"
        />
      </div>
      <div className="form-row admin-user-color-row">
        <label>Color</label>
        <input type="color" value={color.length === 7 ? color : '#4A6FA5'} onChange={e => setColor(e.target.value)} />
        <input value={color} onChange={e => setColor(e.target.value)} className="admin-color-text" />
      </div>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={pending || !name.trim() || !username.trim()}
        onClick={async () => {
          setPending(true);
          try {
            await onSave(member, { name: name.trim(), username: username.trim(), color, password });
            setPassword('');
          } finally {
            setPending(false);
          }
        }}
      >
        Save user
      </button>
    </div>
  );
}
