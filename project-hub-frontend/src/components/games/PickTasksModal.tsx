import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TaskItem, GroupMember } from '../../types';
import {
  fetchSprintPickRatingsForMember,
  saveSprintPickRatings,
  fetchSprintPickRatingsAggregated,
  assignTask,
  type PickRatingRow,
} from '../../api/client';

type Flow = 'menu' | 'rank' | 'results';

const RANK_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

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
  sprintNumber,
  sprintTasks,
  members,
  currentMemberId,
  onTasksChanged,
}: {
  open: boolean;
  onClose: () => void;
  sprintNumber: number;
  sprintTasks: TaskItem[];
  members: GroupMember[];
  currentMemberId: number | null;
  onTasksChanged?: () => void;
}) {
  const [flow, setFlow] = useState<Flow>('menu');
  const [draft, setDraft] = useState<Record<number, number | ''>>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [resultsRows, setResultsRows] = useState<ReturnType<typeof aggregatePickRows>>([]);
  const [resultsLoading, setResultsLoading] = useState(false);

  const sortedTasks = useMemo(
    () => [...sprintTasks].sort((a, b) => a.name.localeCompare(b.name)),
    [sprintTasks],
  );
  const taskOrder = useMemo(() => sortedTasks.map(t => t.id), [sortedTasks]);
  const taskMap = useMemo(() => new Map(sprintTasks.map(t => [t.id, t])), [sprintTasks]);

  useEffect(() => {
    if (!open) {
      setFlow('menu');
      setDraft({});
      setSaveError('');
      setResultsRows([]);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open || flow !== 'rank' || !currentMemberId) return;
    let cancelled = false;
    setBusy(true);
    fetchSprintPickRatingsForMember(sprintNumber, currentMemberId)
      .then(m => {
        if (cancelled) return;
        const next: Record<number, number | ''> = {};
        for (const t of sortedTasks) {
          const v = m.get(t.id);
          next[t.id] = v ?? '';
        }
        setDraft(next);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, flow, sprintNumber, currentMemberId, sortedTasks]);

  const loadResults = useCallback(async () => {
    setResultsLoading(true);
    try {
      const ratings = await fetchSprintPickRatingsAggregated(sprintNumber);
      setResultsRows(aggregatePickRows(taskOrder, ratings, members));
    } finally {
      setResultsLoading(false);
    }
  }, [sprintNumber, taskOrder, members]);

  useEffect(() => {
    if (open && flow === 'results') void loadResults();
  }, [open, flow, loadResults]);

  useEffect(() => {
    if (!open || flow !== 'results') return;
    const t = setInterval(() => void loadResults(), 4000);
    return () => clearInterval(t);
  }, [open, flow, loadResults]);

  const saveRankings = async () => {
    if (!currentMemberId) return;
    setSaveError('');
    setBusy(true);
    try {
      const entries = sortedTasks.map(t => {
        const v = draft[t.id];
        const rating = v === '' || v === undefined ? null : Number(v);
        return {
          taskItemId: t.id,
          rating: rating != null && !Number.isNaN(rating) ? rating : null,
        };
      });
      await saveSprintPickRatings(sprintNumber, currentMemberId, entries);
      onTasksChanged?.();
    } catch {
      setSaveError('Could not save. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const menuView = (
    <div className="pick-poker-menu">
      <p className="text-sm text-muted mb-3">
        Sprint <strong>{sprintNumber}</strong> only — {sortedTasks.length} task{sortedTasks.length !== 1 ? 's' : ''} on
        the board. Anyone can rank anytime; your answers are saved for you only.
      </p>
      <div className="pick-poker-menu-actions">
        <button type="button" className="btn btn-primary" onClick={() => setFlow('rank')}>
          Rank tasks
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setFlow('results')}>
          View results
        </button>
      </div>
    </div>
  );

  const rankView = (
    <div>
      <div className="flex gap-2 flex-wrap mb-3">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFlow('menu')}>
          ← Back
        </button>
      </div>
      <p className="text-sm text-muted mb-3">
        How comfortable are you taking each task? (1 = low, 10 = high). Save when done — reopen anytime to edit.
      </p>
      {!currentMemberId ? (
        <p className="text-sm text-muted">Sign in to rank tasks.</p>
      ) : sortedTasks.length === 0 ? (
        <p className="text-sm text-muted">No tasks in this sprint yet.</p>
      ) : busy && Object.keys(draft).length === 0 ? (
        <p className="text-sm text-muted">Loading your rankings…</p>
      ) : (
        <>
          <ul className="sprint-game-rank-list">
            {sortedTasks.map(t => (
              <li key={t.id} className="sprint-game-rank-row card">
                <span className="sprint-game-rank-task-name">{t.name}</span>
                <label className="sprint-game-rank-label text-xs text-muted">
                  Comfort (1–10)
                  <select
                    className="select-compact mt-1"
                    value={draft[t.id] === '' || draft[t.id] === undefined ? '' : String(draft[t.id])}
                    onChange={e => {
                      const v = e.target.value;
                      setDraft(d => ({ ...d, [t.id]: v === '' ? '' : Number(v) }));
                    }}
                    disabled={busy}
                  >
                    <option value="">—</option>
                    {RANK_OPTIONS.map(n => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </li>
            ))}
          </ul>
          {saveError ? <div className="form-error mt-2">{saveError}</div> : null}
          <div className="mt-3">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void saveRankings()}>
              {busy ? 'Saving…' : 'Save rankings'}
            </button>
          </div>
        </>
      )}
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
      ) : taskOrder.length === 0 ? (
        <p className="text-sm text-muted">No tasks in this sprint.</p>
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

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">Pick tasks · Sprint {sprintNumber}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          {flow === 'menu' ? menuView : flow === 'rank' ? rankView : resultsView}
        </div>
      </div>
    </div>
  );
}
