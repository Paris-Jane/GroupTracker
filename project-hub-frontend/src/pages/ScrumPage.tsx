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
import UserAvatar from '../components/common/UserAvatar';
import Avatar from '../components/common/Avatar';

interface Props {
  currentMember: GroupMember | null;
}

function colForStatus(s: TaskStatus): 'todo' | 'progress' | 'done' {
  if (s === 'Completed') return 'done';
  if (s === 'InProgress') return 'progress';
  return 'todo';
}

export default function ScrumPage({ currentMember }: Props) {
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
    return Math.max(1, ...fromTasks, ...fromGoals, sprintNum);
  }, [tasks, sprintGoals, sprintNum]);

  return (
    <div className="page">
      <header className="page-title-block">
        <h1 className="page-title">Scrum</h1>
        <p className="page-subtitle">Sprint board, goals, and reviews</p>
      </header>

      {settings && (
        <section className="panel">
          <h2 className="panel-heading">Product</h2>
          <div className="form-row">
            <label>Goal</label>
            <textarea
              rows={2}
              value={productGoalLocal}
              onChange={e => setProductGoalLocal(e.target.value)}
              disabled={savingSettings}
            />
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label>Website</label>
              <input value={websiteLocal} onChange={e => setWebsiteLocal(e.target.value)} disabled={savingSettings} placeholder="https://…" />
            </div>
            <div className="form-row">
              <label>GitHub</label>
              <input value={githubLocal} onChange={e => setGithubLocal(e.target.value)} disabled={savingSettings} placeholder="https://…" />
            </div>
          </div>
          <button type="button" className="btn btn-primary btn-sm" disabled={savingSettings} onClick={saveProductMeta}>
            {savingSettings ? 'Saving…' : 'Save'}
          </button>
        </section>
      )}

      <section className="panel">
        <div className="flex-between flex-wrap gap-2 mb-3">
          <h2 className="panel-heading mb-0">Sprint {sprintNum}</h2>
          <select
            className="select-compact"
            value={sprintNum}
            onChange={e => setSprintNum(Number(e.target.value))}
            aria-label="Sprint number"
          >
            {Array.from({ length: maxSprint + 2 }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>
                Sprint {n}
              </option>
            ))}
          </select>
        </div>
        <p className="text-muted text-sm mb-3">
          {doneCount} of {totalSprint || '—'} tasks complete
        </p>
        <div className="form-grid">
          <div className="form-row">
            <label>Sprint goal</label>
            <textarea rows={2} value={goalDraft} onChange={e => setGoalDraft(e.target.value)} placeholder="Focus for this sprint" />
          </div>
          <div className="form-row">
            <label>Sprint due</label>
            <input type="date" value={dueDraft} onChange={e => setDueDraft(e.target.value)} />
          </div>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={saveGoal}>
          Save sprint goal
        </button>
      </section>

      <section className="panel panel--flush">
        <h2 className="panel-heading px-panel">Board</h2>
        <div className="scrum-board scrum-board--minimal">
          {(
            [
              ['To do', columns.todo],
              ['In progress', columns.progress],
              ['Done', columns.done],
            ] as const
          ).map(([title, list]) => (
            <div key={title} className="scrum-col">
              <div className="scrum-col-head">
                {title}
                <span className="scrum-col-count">{list.length}</span>
              </div>
              <div className="scrum-col-body">
                {list.length === 0 ? (
                  <p className="scrum-col-empty">Empty</p>
                ) : (
                  list.map(t => (
                    <div key={t.id} className="scrum-task-card">
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
                      <label className="scrum-po">
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
          onClick={submitReview}
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
    </div>
  );
}
