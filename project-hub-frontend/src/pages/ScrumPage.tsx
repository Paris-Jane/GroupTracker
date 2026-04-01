import { useEffect, useMemo, useState } from 'react';
import {
  getTasks,
  getProjectSettings,
  updateProjectSettings,
  getSprintGoals,
  upsertSprintGoal,
  getSprintReviews,
  addSprintReview,
  toggleAcceptedByPO,
} from '../api/client';
import type { GroupMember, TaskItem, TaskStatus } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import UserAvatar from '../components/common/UserAvatar';

interface Props {
  currentMember: GroupMember | null;
  members: GroupMember[];
}

function colForStatus(s: TaskStatus): 'backlog' | 'progress' | 'done' {
  if (s === 'Completed') return 'done';
  if (s === 'InProgress') return 'progress';
  return 'backlog';
}

export default function ScrumPage({ currentMember, members }: Props) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof getProjectSettings>> | null>(null);
  const [sprintGoals, setSprintGoals] = useState<Awaited<ReturnType<typeof getSprintGoals>>>([]);
  const [sprintNum, setSprintNum] = useState(1);
  const [goalDraft, setGoalDraft] = useState('');
  const [dueDraft, setDueDraft] = useState('');
  const [reviews, setReviews] = useState<Awaited<ReturnType<typeof getSprintReviews>>>([]);
  const [reviewBody, setReviewBody] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [productGoalLocal, setProductGoalLocal] = useState('');
  const [websiteLocal, setWebsiteLocal] = useState('');
  const [githubLocal, setGithubLocal] = useState('');

  const loadTasks = () => getTasks().then(setTasks);
  const loadGoals = () => getSprintGoals().then(setSprintGoals);
  const loadSettings = () =>
    getProjectSettings().then(s => {
      setSettings(s);
      setProductGoalLocal(s.productGoal);
      setWebsiteLocal(s.websiteUrl ?? '');
      setGithubLocal(s.githubUrl ?? '');
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

  const currentGoal = sprintGoals.find(g => g.sprintNumber === sprintNum);
  useEffect(() => {
    setGoalDraft(currentGoal?.goal ?? '');
    setDueDraft(currentGoal?.sprintDueDate?.split('T')[0] ?? '');
  }, [currentGoal?.goal, currentGoal?.sprintDueDate, sprintNum]);

  const sprintTasks = useMemo(
    () => tasks.filter(t => t.sprintNumber === sprintNum),
    [tasks, sprintNum],
  );

  const columns = useMemo(() => {
    const backlog: TaskItem[] = [];
    const progress: TaskItem[] = [];
    const done: TaskItem[] = [];
    for (const t of sprintTasks) {
      const c = colForStatus(t.status);
      if (c === 'done') done.push(t);
      else if (c === 'progress') progress.push(t);
      else backlog.push(t);
    }
    return { backlog, progress, done };
  }, [sprintTasks]);

  const doneCount = columns.done.length;
  const totalSprint = sprintTasks.length;

  const saveGoal = async () => {
    await upsertSprintGoal({
      sprintNumber: sprintNum,
      goal: goalDraft.trim(),
      sprintDueDate: dueDraft || undefined,
    });
    loadGoals();
  };

  const saveProductMeta = async () => {
    setSavingSettings(true);
    try {
      const next = await updateProjectSettings({
        productGoal: productGoalLocal,
        websiteUrl: websiteLocal || undefined,
        githubUrl: githubLocal || undefined,
      });
      setSettings(next);
    } finally {
      setSavingSettings(false);
    }
  };

  const submitReview = async () => {
    if (!currentMember || !reviewBody.trim()) return;
    await addSprintReview(sprintNum, currentMember.id, reviewBody.trim());
    setReviewBody('');
    loadReviews();
  };

  const maxSprint = useMemo(() => {
    const fromTasks = tasks.map(t => t.sprintNumber ?? 0);
    const fromGoals = sprintGoals.map(g => g.sprintNumber);
    const m = Math.max(1, ...fromTasks, ...fromGoals, sprintNum);
    return m;
  }, [tasks, sprintGoals, sprintNum]);

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1>Scrum</h1>
        <p className="page-lead">Product goal, sprint focus, backlog columns, and reviews</p>
      </header>

      {settings && (
        <section className="card-section">
          <h2 className="section-title">Product</h2>
          <div className="form-row">
            <label>Product goal</label>
            <textarea
              rows={3}
              value={productGoalLocal}
              onChange={e => setProductGoalLocal(e.target.value)}
              disabled={savingSettings}
            />
          </div>
          <div className="form-grid mb-3">
            <div className="form-row">
              <label>Website URL</label>
              <input
                value={websiteLocal}
                onChange={e => setWebsiteLocal(e.target.value)}
                disabled={savingSettings}
                placeholder="https://"
              />
            </div>
            <div className="form-row">
              <label>GitHub URL</label>
              <input
                value={githubLocal}
                onChange={e => setGithubLocal(e.target.value)}
                disabled={savingSettings}
                placeholder="https://github.com/…"
              />
            </div>
          </div>
          <button type="button" className="btn btn-primary btn-sm" disabled={savingSettings} onClick={saveProductMeta}>
            {savingSettings ? 'Saving…' : 'Save product settings'}
          </button>
        </section>
      )}

      <section className="card-section">
        <div className="flex-between mb-3 flex-wrap gap-2">
          <h2 className="section-title mb-0">Sprint</h2>
          <div className="flex gap-2 items-center">
            <label className="text-sm text-muted mb-0" style={{ fontWeight: 500 }}>
              Sprint #
            </label>
            <select
              value={sprintNum}
              onChange={e => setSprintNum(Number(e.target.value))}
              style={{ width: 'auto' }}
            >
              {Array.from({ length: maxSprint + 2 }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-sm text-muted mb-3">
          Progress for this sprint: {doneCount} / {totalSprint || '—'} tasks marked complete
        </p>
        <div className="form-row">
          <label>Sprint goal</label>
          <textarea rows={2} value={goalDraft} onChange={e => setGoalDraft(e.target.value)} placeholder="What are we shipping this sprint?" />
        </div>
        <div className="form-row">
          <label>Sprint due date</label>
          <input type="date" value={dueDraft} onChange={e => setDueDraft(e.target.value)} />
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={saveGoal}>
          Save sprint goal
        </button>
      </section>

      <section className="card-section">
        <h2 className="section-title mb-3">Board (this sprint)</h2>
        <div className="scrum-board">
          {(
            [
              ['Sprint backlog', columns.backlog],
              ['In progress', columns.progress],
              ['Done', columns.done],
            ] as const
          ).map(([title, list]) => (
            <div key={title} className="scrum-column">
              <div className="scrum-column-head">{title}</div>
              <div className="scrum-column-body">
                {list.length === 0 ? (
                  <p className="empty-hint text-sm">No tasks</p>
                ) : (
                  list.map(t => (
                    <div key={t.id} className="scrum-card">
                      <div className="flex-between gap-2 mb-1">
                        <span className="font-medium text-sm">{t.name}</span>
                        <StatusBadge status={t.status} />
                      </div>
                      {t.definitionOfDone && (
                        <p className="text-xs text-muted mb-2">DoD: {t.definitionOfDone}</p>
                      )}
                      <label className="flex gap-2 items-center text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={t.acceptedByPO}
                          onChange={async e => {
                            await toggleAcceptedByPO(t.id, e.target.checked, currentMember?.id);
                            loadTasks();
                          }}
                          style={{ width: 'auto' }}
                        />
                        Accepted by PO
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card-section">
        <h2 className="section-title mb-3">Sprint reviews</h2>
        <div className="form-row">
          <label>Add review ({members.find(m => m.id === currentMember?.id)?.name ?? 'sign in'})</label>
          <textarea
            rows={3}
            value={reviewBody}
            onChange={e => setReviewBody(e.target.value)}
            placeholder="What went well, what to improve…"
            disabled={!currentMember}
          />
        </div>
        <button type="button" className="btn btn-primary btn-sm mb-4" disabled={!currentMember || !reviewBody.trim()} onClick={submitReview}>
          Post review
        </button>
        <ul className="reviews-list">
          {reviews.map(r => (
            <li key={r.id} className="review-item">
              <div className="flex gap-2 items-center mb-1">
                <UserAvatar member={{ name: r.memberName, color: r.memberColor, avatarInitial: r.memberAvatarInitial }} size="sm" />
                <span className="text-sm font-medium">{r.memberName}</span>
                <span className="text-xs text-muted">{new Date(r.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{r.content}</p>
            </li>
          ))}
        </ul>
        {reviews.length === 0 && <p className="empty-hint text-sm">No reviews for this sprint yet.</p>}
      </section>
    </div>
  );
}
