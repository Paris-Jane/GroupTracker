import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TaskItem, GroupMember } from '../../types';
import {
  startPokerSession,
  getActivePokerSession,
  pokerMarkReady,
  pokerStartVoting,
  pokerSubmitVote,
  pokerNextTask,
  pokerApplyEvaluation,
  pokerModeValue,
  fetchPokerSessionAllVotes,
  assignTask,
  type PokerSessionState,
  type PokerVoteRow,
} from '../../api/client';

const DECK = [0, 1, 2, 3, 5, 8, 13] as const;

type Flow = 'menu' | 'vote' | 'results';

function aggregatePokerRows(
  queue: number[],
  votes: PokerVoteRow[],
  members: GroupMember[],
): {
  taskId: number;
  byMember: { memberId: number; memberName: string; value: number | null }[];
  mode: number | null;
  modeMemberIds: number[];
}[] {
  const byTask = new Map<number, Map<number, number | null>>();
  for (const tid of queue) byTask.set(tid, new Map());
  for (const v of votes) {
    const m = byTask.get(v.taskItemId);
    if (m) m.set(v.memberId, v.value);
  }
  return queue.map(taskId => {
    const m = byTask.get(taskId) ?? new Map();
    const byMember = members.map(mem => ({
      memberId: mem.id,
      memberName: mem.name,
      value: m.get(mem.id) ?? null,
    }));
    const mode = pokerModeValue(byMember.map(x => ({ value: x.value })));
    const modeMemberIds =
      mode == null ? [] : byMember.filter(x => x.value === mode).map(x => x.memberId);
    return { taskId, byMember, mode, modeMemberIds };
  });
}

export default function PlanningPokerModal({
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
  onTasksChanged: () => void;
}) {
  const memberCount = Math.max(1, members.length);
  const [flow, setFlow] = useState<Flow>('menu');
  const [state, setState] = useState<PokerSessionState | null>(null);
  const [configAll, setConfigAll] = useState(true);
  const [configSprint, setConfigSprint] = useState('1');
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resultsRows, setResultsRows] = useState<ReturnType<typeof aggregatePokerRows>>([]);
  const [resultsSessionId, setResultsSessionId] = useState<number | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  const refresh = useCallback(async () => {
    const st = await getActivePokerSession(memberCount);
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
      const st = await getActivePokerSession(memberCount);
      if (!st) {
        setResultsSessionId(null);
        setResultsRows([]);
        return;
      }
      const { taskQueue, votes } = await fetchPokerSessionAllVotes(st.id);
      setResultsSessionId(st.id);
      setResultsRows(aggregatePokerRows(taskQueue, votes, members));
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
      await startPokerSession(configAll, sprint, tasks);
      await refresh();
    } finally {
      setStarting(false);
    }
  };

  const run = async (fn: () => Promise<PokerSessionState | null>) => {
    setBusy(true);
    try {
      const next = await fn();
      setState(next);
      if (next?.phase === 'complete') {
        onTasksChanged();
      }
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const currentTask = state?.currentTaskId ? taskMap.get(state.currentTaskId) : null;
  const myVote = state && currentMemberId ? state.votes.find(v => v.memberId === currentMemberId) : undefined;
  const mode = state ? pokerModeValue(state.votes) : null;

  const menuView = (
    <div className="pick-poker-menu">
      <p className="text-sm text-muted mb-3">
        <strong>Vote</strong> — planning poker on each task. <strong>View results</strong> — see all votes, the consensus (mode), and assign or apply evaluation.
      </p>
      <div className="pick-poker-menu-actions">
        <button type="button" className="btn btn-primary" onClick={() => setFlow('vote')}>
          Vote (session)
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
        <p className="text-sm text-muted">No active planning poker session. Start one from Vote (session).</p>
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
                  {row.mode != null ? (
                    <span className="text-xs game-results-top-badge">Mode: {row.mode}</span>
                  ) : (
                    <span className="text-xs text-muted">No consensus yet</span>
                  )}
                </div>
                <div className="game-results-grid">
                  {row.byMember.map(cell => (
                    <div
                      key={cell.memberId}
                      className={`game-results-cell${row.modeMemberIds.includes(cell.memberId) && cell.value != null ? ' game-results-cell--top' : ''}`}
                    >
                      <span className="game-results-name">{cell.memberName}</span>
                      <span className="game-results-value">{cell.value ?? '—'}</span>
                    </div>
                  ))}
                </div>
                {currentMemberId ? (
                  <div className="game-results-assign flex gap-2 flex-wrap mt-2">
                    {row.mode != null ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busy}
                        onClick={async () => {
                          const m = row.mode;
                          if (m == null) return;
                          setBusy(true);
                          try {
                            await pokerApplyEvaluation(row.taskId, m, currentMemberId ?? undefined);
                            onTasksChanged();
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Set evaluation to {row.mode}
                      </button>
                    ) : null}
                    {row.modeMemberIds.map(mid => (
                      <button
                        key={mid}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await assignTask(row.taskId, [mid], currentMemberId ?? undefined);
                            onTasksChanged();
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

  const voteSessionView = state?.phase === 'complete' ? (
    <div>
      <p className="text-sm mb-3">This planning poker session is finished. Review results or start a new session.</p>
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
      <p className="text-sm text-muted mb-3">Start a shared session. Everyone with this app open sees the same task queue.</p>
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
            Mark when you&apos;re ready. Anyone can press <strong>Start voting</strong> when the team is set (works with any number of players).
          </p>
          <p className="text-xs text-muted mb-2">Ready: {state.readyMemberIds.length}</p>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!currentMemberId || busy}
              onClick={() =>
                currentMemberId && void run(() => pokerMarkReady(state.id, currentMemberId, memberCount))
              }
            >
              I&apos;m ready
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy}
              onClick={() => void run(() => pokerStartVoting(state.id, memberCount))}
            >
              Start voting
            </button>
          </div>
        </div>
      )}

      {state.phase === 'voting' && currentTask && (
        <div>
          {!currentMemberId ? (
            <p className="text-sm text-muted">Sign in to vote.</p>
          ) : (
            <>
              <p className="text-sm mb-2">Choose a card. Values are hidden until everyone votes.</p>
              <div className="poker-deck">
                {DECK.map(v => (
                  <button
                    key={v}
                    type="button"
                    className={`btn btn-secondary btn-sm ${myVote?.value === v ? 'btn-primary' : ''}`}
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        pokerSubmitVote(state.id, currentTask.id, currentMemberId, v, memberCount),
                      )
                    }
                  >
                    {v}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {state.phase === 'revealed' && currentTask && (
        <div>
          <p className="text-sm mb-2">Votes</p>
          <ul className="text-sm mb-3">
            {state.votes.map(v => {
              const name = members.find(m => m.id === v.memberId)?.name ?? `Member ${v.memberId}`;
              return (
                <li key={v.memberId}>
                  {name}: <strong>{v.value ?? '—'}</strong>
                </li>
              );
            })}
          </ul>
          {mode != null && (
            <p className="text-sm mb-3">
              Mode: <strong>{mode}</strong>
            </p>
          )}
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy || mode == null}
              onClick={async () => {
                if (mode == null) return;
                setBusy(true);
                try {
                  await pokerApplyEvaluation(currentTask.id, mode, currentMemberId ?? undefined);
                  onTasksChanged();
                  await run(() => pokerNextTask(state.id, memberCount));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Apply to task &amp; next
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy}
              onClick={() => void run(() => pokerNextTask(state.id, memberCount))}
            >
              Skip (next task)
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">Planning poker</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          {flow === 'menu' ? menuView : flow === 'results' ? resultsView : voteSessionView}
        </div>
      </div>
    </div>
  );
}
