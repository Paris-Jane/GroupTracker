import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TaskItem, GroupMember } from '../../types';
import {
  startPickSession,
  getActivePickSession,
  pickMarkReady,
  pickStartRating,
  pickSubmitRating,
  pickNextTask,
  fetchPickSessionAllRatings,
  assignTask,
  type PickSessionState,
  type PickRatingRow,
} from '../../api/client';

type Flow = 'menu' | 'pick' | 'results';

function aggregatePickRows(
  queue: number[],
  ratings: PickRatingRow[],
  members: GroupMember[],
): {
  taskId: number;
  byMember: { memberId: number; memberName: string; rating: number | null }[];
  maxRating: number | null;
  topMemberIds: number[];
}[] {
  const byTask = new Map<number, Map<number, number | null>>();
  for (const tid of queue) byTask.set(tid, new Map());
  for (const r of ratings) {
    const m = byTask.get(r.taskItemId);
    if (m) m.set(r.memberId, r.rating);
  }
  return queue.map(taskId => {
    const m = byTask.get(taskId) ?? new Map();
    const byMember = members.map(mem => ({
      memberId: mem.id,
      memberName: mem.name,
      rating: m.get(mem.id) ?? null,
    }));
    const numeric = byMember.map(x => x.rating).filter((x): x is number => x != null);
    const maxRating = numeric.length ? Math.max(...numeric) : null;
    const topMemberIds =
      maxRating == null ? [] : byMember.filter(x => x.rating === maxRating).map(x => x.memberId);
    return { taskId, byMember, maxRating, topMemberIds };
  });
}

export default function PickTasksModal({
  open,
  onClose,
  tasks,
  members,
  currentMemberId,
  onTasksChanged,
}: {
  open: boolean;
  onClose: () => void;
  tasks: TaskItem[];
  members: GroupMember[];
  currentMemberId: number | null;
  onTasksChanged?: () => void;
}) {
  const memberCount = Math.max(1, members.length);
  const [flow, setFlow] = useState<Flow>('menu');
  const [state, setState] = useState<PickSessionState | null>(null);
  const [configAll, setConfigAll] = useState(true);
  const [configSprint, setConfigSprint] = useState('1');
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resultsRows, setResultsRows] = useState<ReturnType<typeof aggregatePickRows>>([]);
  const [resultsSessionId, setResultsSessionId] = useState<number | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  const refresh = useCallback(async () => {
    const st = await getActivePickSession(memberCount);
    setState(st);
  }, [memberCount]);

  useEffect(() => {
    if (!open) {
      setState(null);
      setFlow('menu');
      setResultsRows([]);
      setResultsSessionId(null);
      return;
    }
    void refresh();
    const t = setInterval(() => void refresh(), 2000);
    return () => clearInterval(t);
  }, [open, refresh]);

  const loadResults = useCallback(async () => {
    setResultsLoading(true);
    try {
      const st = await getActivePickSession(memberCount);
      if (!st) {
        setResultsSessionId(null);
        setResultsRows([]);
        return;
      }
      const { taskQueue, ratings } = await fetchPickSessionAllRatings(st.id);
      setResultsSessionId(st.id);
      setResultsRows(aggregatePickRows(taskQueue, ratings, members));
    } finally {
      setResultsLoading(false);
    }
  }, [memberCount, members]);

  useEffect(() => {
    if (open && flow === 'results') void loadResults();
  }, [open, flow, loadResults]);

  const queuePreview = useMemo(
    () => tasks.filter(t => configAll || t.sprintNumber === Number(configSprint)),
    [tasks, configAll, configSprint],
  );

  const startNew = async () => {
    if (queuePreview.length === 0) return;
    setStarting(true);
    try {
      const sprint = configAll ? null : Number(configSprint) || null;
      await startPickSession(configAll, sprint, tasks);
      await refresh();
    } finally {
      setStarting(false);
    }
  };

  const run = async (fn: () => Promise<PickSessionState | null>) => {
    setBusy(true);
    try {
      const next = await fn();
      setState(next);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const currentTask = state?.currentTaskId ? taskMap.get(state.currentTaskId) : null;
  const myRating =
    state && currentMemberId ? state.ratings.find(r => r.memberId === currentMemberId) : undefined;
  const avg =
    state && state.phase === 'revealed'
      ? (() => {
          const vals = state.ratings.map(r => r.rating).filter((x): x is number => x != null);
          if (!vals.length) return null;
          return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
        })()
      : null;

  const menuView = (
    <div className="pick-poker-menu">
      <p className="text-sm text-muted mb-3">
        <strong>Pick</strong> — rank how much you want each task (1–10). <strong>View results</strong> — see everyone’s
        ratings and assign tasks; highest rank is highlighted.
      </p>
      <div className="pick-poker-menu-actions">
        <button type="button" className="btn btn-primary" onClick={() => setFlow('pick')}>
          Rank tasks (Pick)
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setFlow('results')}>
          View results
        </button>
      </div>
    </div>
  );

  const resultsView = (
    <div>
      <div className="flex gap-2 flex-wrap mb-3">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFlow('menu')}>
          ← Back
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={resultsLoading} onClick={() => void loadResults()}>
          Refresh
        </button>
      </div>
      {resultsLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !resultsSessionId ? (
        <p className="text-sm text-muted">No active pick session. Start one from Rank tasks (Pick), or wait until a session exists.</p>
      ) : resultsRows.length === 0 ? (
        <p className="text-sm text-muted">No tasks in this session yet.</p>
      ) : (
        <ul className="game-results-list">
          {resultsRows.map(row => {
            const t = taskMap.get(row.taskId);
            const name = t?.name ?? `Task #${row.taskId}`;
            return (
              <li key={row.taskId} className="game-results-card card">
                <div className="game-results-card-head">
                  <span className="font-medium">{name}</span>
                  {row.maxRating != null && row.topMemberIds.length > 0 ? (
                    <span className="text-xs game-results-top-badge">Top: {row.maxRating}/10</span>
                  ) : null}
                </div>
                <div className="game-results-grid">
                  {row.byMember.map(cell => (
                    <div
                      key={cell.memberId}
                      className={`game-results-cell${row.topMemberIds.includes(cell.memberId) && cell.rating != null ? ' game-results-cell--top' : ''}`}
                    >
                      <span className="game-results-name">{cell.memberName}</span>
                      <span className="game-results-value">{cell.rating ?? '—'}</span>
                    </div>
                  ))}
                </div>
                {row.topMemberIds.length > 0 && currentMemberId ? (
                  <div className="game-results-assign flex gap-2 flex-wrap mt-2">
                    {row.topMemberIds.map(mid => (
                      <button
                        key={mid}
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await assignTask(row.taskId, [mid], currentMemberId ?? undefined);
                            onTasksChanged?.();
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Assign to {members.find(m => m.id === mid)?.name ?? mid}
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  const pickSessionView = state?.phase === 'complete' ? (
    <div>
      <p className="text-sm mb-3">This pick session is finished. You can review results or start a new session.</p>
      <div className="flex gap-2 flex-wrap mb-3">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setFlow('results')}>
          View results
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFlow('menu')}>
          ← Menu
        </button>
      </div>
    </div>
  ) : !state ? (
    <>
      <div className="mb-3">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFlow('menu')}>
          ← Back
        </button>
      </div>
      <p className="text-sm text-muted mb-3">Rate how much you want to work on each task (1–10). Results show when everyone has rated.</p>
      <div className="form-row">
        <label className="flex gap-2 items-center font-normal cursor-pointer">
          <input type="radio" checked={configAll} onChange={() => setConfigAll(true)} style={{ width: 'auto' }} />
          All tasks
        </label>
        <label className="flex gap-2 items-center font-normal cursor-pointer">
          <input type="radio" checked={!configAll} onChange={() => setConfigAll(false)} style={{ width: 'auto' }} />
          One sprint
        </label>
      </div>
      {!configAll && (
        <div className="form-row">
          <label>Sprint number</label>
          <input type="number" min={1} value={configSprint} onChange={e => setConfigSprint(e.target.value)} />
        </div>
      )}
      <p className="text-xs text-muted mb-3">{queuePreview.length} task(s) in queue.</p>
      <button
        type="button"
        className="btn btn-primary"
        disabled={queuePreview.length === 0 || starting}
        onClick={() => void startNew()}
      >
        {starting ? 'Starting…' : 'Start session'}
      </button>
    </>
  ) : (
    <>
      <div className="mb-3">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFlow('menu')}>
          ← Menu
        </button>
      </div>
      <p className="text-sm text-muted mb-2">
        Task {state.currentIndex + 1} of {state.taskQueue.length}
        {!state.filterAllTasks && state.sprintNumber != null && ` · Sprint ${state.sprintNumber}`}
      </p>
      {currentTask ? (
        <div className="card mb-3">
          <div className="font-medium">{currentTask.name}</div>
          {currentTask.notes && <p className="text-sm text-muted mt-1">{currentTask.notes}</p>}
        </div>
      ) : (
        <p className="empty-hint">No current task.</p>
      )}

      {state.phase === 'ready' && (
        <div>
          <p className="text-sm mb-2">
            Mark when you&apos;re ready. Anyone can press <strong>Start rating</strong> when the team is set (works with any number of players).
          </p>
          <p className="text-xs text-muted mb-2">Ready: {state.readyMemberIds.length}</p>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!currentMemberId || busy}
              onClick={() =>
                currentMemberId && void run(() => pickMarkReady(state.id, currentMemberId, memberCount))
              }
            >
              I&apos;m ready
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy}
              onClick={() => void run(() => pickStartRating(state.id, memberCount))}
            >
              Start rating
            </button>
          </div>
        </div>
      )}

      {state.phase === 'rating' && currentTask && (
        <div>
          {!currentMemberId ? (
            <p className="text-sm text-muted">Sign in to rate.</p>
          ) : (
            <>
              <p className="text-sm mb-2">How much do you want this task? (1 = low, 10 = high)</p>
              <div className="poker-deck flex-wrap">
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    type="button"
                    className={`btn btn-secondary btn-sm ${myRating?.rating === n ? 'btn-primary' : ''}`}
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        pickSubmitRating(state.id, currentTask.id, currentMemberId, n, memberCount),
                      )
                    }
                  >
                    {n}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {state.phase === 'revealed' && currentTask && (
        <div>
          <p className="text-sm mb-2">Ratings</p>
          <ul className="text-sm mb-3">
            {state.ratings.map(r => {
              const name = members.find(m => m.id === r.memberId)?.name ?? `Member ${r.memberId}`;
              return (
                <li key={r.memberId}>
                  {name}: <strong>{r.rating ?? '—'}</strong>
                </li>
              );
            })}
          </ul>
          {avg != null && (
            <p className="text-sm mb-3">
              Average: <strong>{avg}</strong>
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy}
            onClick={() => void run(() => pickNextTask(state.id, memberCount))}
          >
            Next task
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">Pick tasks</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          {flow === 'menu' ? menuView : flow === 'results' ? resultsView : pickSessionView}
        </div>
      </div>
    </div>
  );
}
