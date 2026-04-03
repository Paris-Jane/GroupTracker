import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TaskItem, GroupMember } from '../../types';
import {
  fetchSprintPickRatingsForMember,
  saveSprintPickRatings,
  fetchSprintPickRatingsAggregated,
  assignTask,
  type PickRatingRow,
} from '../../api/client';

type Flow = 'menu' | 'rank' | 'results';

const COMFORT_CARDS = [1, 2, 3, 4, 5] as const;

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

function normalizeMemberId(id: number | null): number | null {
  if (id == null) return null;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
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
  const memberId = useMemo(() => normalizeMemberId(currentMemberId), [currentMemberId]);

  const [flow, setFlow] = useState<Flow>('menu');
  const [draft, setDraft] = useState<Record<number, number | ''>>({});
  const [draftLoading, setDraftLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [resultsRows, setResultsRows] = useState<ReturnType<typeof aggregatePickRows>>([]);
  const [resultsLoading, setResultsLoading] = useState(false);

  const sortedTasks = useMemo(
    () => [...sprintTasks].sort((a, b) => a.name.localeCompare(b.name)),
    [sprintTasks],
  );
  const taskOrder = useMemo(() => sortedTasks.map(t => t.id), [sortedTasks]);
  const taskMap = useMemo(() => new Map(sprintTasks.map(t => [t.id, t])), [sprintTasks]);

  const sortedTasksRef = useRef(sortedTasks);
  sortedTasksRef.current = sortedTasks;

  const sprintNumberRef = useRef(sprintNumber);
  const taskOrderRef = useRef(taskOrder);
  const membersRef = useRef(members);
  sprintNumberRef.current = sprintNumber;
  taskOrderRef.current = taskOrder;
  membersRef.current = members;

  const effectiveDraft = useMemo(() => {
    const out: Record<number, number | ''> = { ...draft };
    for (const t of sortedTasks) {
      if (!(t.id in out)) out[t.id] = '';
    }
    return out;
  }, [draft, sortedTasks]);

  useEffect(() => {
    if (!open) {
      setFlow('menu');
      setDraft({});
      setSaveError('');
      setResultsRows([]);
      setDraftLoading(false);
      setSaving(false);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open || flow !== 'rank' || memberId == null) return;
    let cancelled = false;
    setDraftLoading(true);
    fetchSprintPickRatingsForMember(sprintNumber, memberId)
      .then(m => {
        if (cancelled) return;
        const tasks = sortedTasksRef.current;
        const next: Record<number, number | ''> = {};
        for (const t of tasks) {
          const v = m.get(t.id);
          next[t.id] = v ?? '';
        }
        setDraft(next);
      })
      .catch(() => {
        if (!cancelled) {
          const tasks = sortedTasksRef.current;
          const next: Record<number, number | ''> = {};
          for (const t of tasks) next[t.id] = '';
          setDraft(next);
        }
      })
      .finally(() => {
        if (!cancelled) setDraftLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, flow, sprintNumber, memberId]);

  /** Refs keep this stable so parent re-renders (tasks/members) do not retrigger loading + blink. */
  const loadResults = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setResultsLoading(true);
    try {
      const ratings = await fetchSprintPickRatingsAggregated(sprintNumberRef.current);
      setResultsRows(aggregatePickRows(taskOrderRef.current, ratings, membersRef.current));
    } finally {
      if (!silent) setResultsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && flow === 'results') void loadResults({ silent: false });
  }, [open, flow, loadResults]);

  useEffect(() => {
    if (!open || flow !== 'results') return;
    const t = setInterval(() => void loadResults({ silent: true }), 8000);
    return () => clearInterval(t);
  }, [open, flow, loadResults]);

  const saveRankings = async () => {
    if (memberId == null) return;
    setSaveError('');
    setSaving(true);
    try {
      const entries = sortedTasks.map(t => {
        const v = effectiveDraft[t.id];
        const rating = v === '' || v === undefined ? null : Number(v);
        return {
          taskItemId: t.id,
          rating: rating != null && !Number.isNaN(rating) ? rating : null,
        };
      });
      await saveSprintPickRatings(sprintNumber, memberId, entries);
      onTasksChanged?.();
      setFlow('results');
    } catch {
      setSaveError('Could not save. Check your connection and try again.');
    } finally {
      setSaving(false);
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
        How comfortable are you taking each task? Tap a card (1 = low, 5 = high). Save when done — reopen anytime to
        edit.
      </p>
      {memberId == null ? (
        <p className="text-sm text-muted">Sign in to rank tasks.</p>
      ) : sortedTasks.length === 0 ? (
        <p className="text-sm text-muted">No tasks in this sprint yet.</p>
      ) : (
        <>
          {draftLoading ? (
            <p className="text-sm text-muted mb-2" aria-live="polite">
              Loading saved ratings…
            </p>
          ) : null}
          <ul className="sprint-game-rank-list">
            {sortedTasks.map(t => (
              <li key={t.id} className="sprint-game-rank-item">
                <div className="sprint-game-rank-panel">
                  <span className="sprint-game-rank-task-name">{t.name}</span>
                  <div className="sprint-pick-comfort-row sprint-game-deck" aria-label="Comfort level">
                    {COMFORT_CARDS.map(n => (
                      <button
                        key={n}
                        type="button"
                        className={`sprint-game-tile${effectiveDraft[t.id] === n ? ' sprint-game-tile--on' : ''}`}
                        onClick={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDraft(d => ({ ...d, [t.id]: n }));
                        }}
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="sprint-game-tile sprint-game-tile-clear"
                      onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDraft(d => ({ ...d, [t.id]: '' }));
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {saveError ? <div className="form-error mt-2">{saveError}</div> : null}
          <div className="mt-3">
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveRankings()}>
              {saving ? 'Saving…' : 'Save rankings'}
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
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={resultsLoading}
          onClick={() => void loadResults({ silent: false })}
        >
          Refresh
        </button>
      </div>
      {taskOrder.length === 0 ? (
        <p className="text-sm text-muted">No tasks in this sprint.</p>
      ) : resultsLoading && resultsRows.length === 0 ? (
        <p className="text-sm text-muted">Loading…</p>
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
                    <span className="text-xs game-results-top-badge">Top: {row.maxRating}/5</span>
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
                {row.topMemberIds.length > 0 && memberId != null ? (
                  <div className="game-results-assign flex gap-2 flex-wrap mt-2">
                    {row.topMemberIds.map(mid => (
                      <button
                        key={mid}
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={saving}
                        onClick={async () => {
                          setSaving(true);
                          try {
                            await assignTask(row.taskId, [mid], memberId);
                            onTasksChanged?.();
                          } finally {
                            setSaving(false);
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

  return createPortal(
    <div className="modal-overlay modal-overlay--portal">
      <div className="modal modal-lg" role="dialog" aria-modal="true" aria-labelledby="pick-modal-title">
        <div className="modal-header">
          <span className="modal-title" id="pick-modal-title">
            Pick tasks · Sprint {sprintNumber}
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          {flow === 'menu' ? menuView : flow === 'rank' ? rankView : resultsView}
        </div>
      </div>
    </div>,
    document.body,
  );
}
