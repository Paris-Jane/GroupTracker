import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TaskItem, GroupMember } from '../../types';
import {
  startPickSession,
  getActivePickSession,
  pickMarkReady,
  pickStartRating,
  pickSubmitRating,
  pickNextTask,
  type PickSessionState,
} from '../../api/client';

export default function PickTasksModal({
  open,
  onClose,
  tasks,
  members,
  currentMemberId,
}: {
  open: boolean;
  onClose: () => void;
  tasks: TaskItem[];
  members: GroupMember[];
  currentMemberId: number | null;
}) {
  const memberCount = Math.max(1, members.length);
  const [state, setState] = useState<PickSessionState | null>(null);
  const [configAll, setConfigAll] = useState(true);
  const [configSprint, setConfigSprint] = useState('1');
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const st = await getActivePickSession(memberCount);
    setState(st);
  }, [memberCount]);

  useEffect(() => {
    if (!open) {
      setState(null);
      return;
    }
    void refresh();
    const t = setInterval(() => void refresh(), 2000);
    return () => clearInterval(t);
  }, [open, refresh]);

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
          {!state ? (
            <>
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
                        currentMemberId &&
                        void run(() => pickMarkReady(state.id, currentMemberId, memberCount))
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
          )}
        </div>
      </div>
    </div>
  );
}
