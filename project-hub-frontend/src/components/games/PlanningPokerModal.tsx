import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TaskItem, GroupMember } from '../../types';
import {
  fetchSprintPokerVotesForMember,
  saveSprintPokerVotes,
  fetchSprintPokerVotesAggregated,
  pokerApplyEvaluation,
  pokerModeValue,
  assignTask,
  type PokerVoteRow,
} from '../../api/client';

const DECK = [0, 1, 2, 3, 5, 8, 13] as const;

type Flow = 'menu' | 'play' | 'results';

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
  onTasksChanged: () => void;
}) {
  const [flow, setFlow] = useState<Flow>('menu');
  const [draft, setDraft] = useState<Record<number, number | ''>>({});
  const [saveError, setSaveError] = useState('');
  const [resultsRows, setResultsRows] = useState<ReturnType<typeof aggregatePokerRows>>([]);
  const [resultsLoading, setResultsLoading] = useState(false);

  const sortedTasks = useMemo(
    () => [...sprintTasks].sort((a, b) => a.name.localeCompare(b.name)),
    [sprintTasks],
  );
  const sprintTaskIdsKey = useMemo(() => sortedTasks.map(t => t.id).join(','), [sortedTasks]);
  const taskOrder = useMemo(() => sortedTasks.map(t => t.id), [sortedTasks]);
  const taskMap = useMemo(() => new Map(sprintTasks.map(t => [t.id, t])), [sprintTasks]);

  const [draftLoading, setDraftLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setFlow('menu');
      setDraft({});
      setSaveError('');
      setResultsRows([]);
      setDraftLoading(false);
      setSaving(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || flow !== 'play' || !currentMemberId) return;
    let cancelled = false;
    setDraftLoading(true);
    fetchSprintPokerVotesForMember(sprintNumber, currentMemberId)
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
        if (!cancelled) setDraftLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, flow, sprintNumber, currentMemberId, sprintTaskIdsKey]);

  const loadResults = useCallback(async () => {
    setResultsLoading(true);
    try {
      const votes = await fetchSprintPokerVotesAggregated(sprintNumber);
      setResultsRows(aggregatePokerRows(taskOrder, votes, members));
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

  const saveVotes = async () => {
    if (!currentMemberId) return;
    setSaveError('');
    setSaving(true);
    try {
      const entries = sortedTasks.map(t => {
        const v = draft[t.id];
        const value = v === '' || v === undefined ? null : Number(v);
        return {
          taskItemId: t.id,
          value: value != null && !Number.isNaN(value) ? value : null,
        };
      });
      await saveSprintPokerVotes(sprintNumber, currentMemberId, entries);
      onTasksChanged();
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
        Sprint <strong>{sprintNumber}</strong> only — {sortedTasks.length} task{sortedTasks.length !== 1 ? 's' : ''}.
        Estimate difficulty using the planning-poker scale. Anyone can play anytime; your estimates are saved for you
        only.
      </p>
      <div className="pick-poker-menu-actions">
        <button type="button" className="btn btn-primary" onClick={() => setFlow('play')}>
          Play poker
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setFlow('results')}>
          View results
        </button>
      </div>
    </div>
  );

  const playView = (
    <div>
      <div className="flex gap-2 flex-wrap mb-3">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFlow('menu')}>
          ← Back
        </button>
      </div>
      <p className="text-sm text-muted mb-3">
        How difficult is each task? Choose 0, 1, 2, 3, 5, 8, or 13. Save when done — reopen anytime to edit.
      </p>
      {!currentMemberId ? (
        <p className="text-sm text-muted">Sign in to play poker.</p>
      ) : sortedTasks.length === 0 ? (
        <p className="text-sm text-muted">No tasks in this sprint yet.</p>
      ) : draftLoading && Object.keys(draft).length === 0 ? (
        <p className="text-sm text-muted">Loading your estimates…</p>
      ) : (
        <>
          <ul className="sprint-game-rank-list">
            {sortedTasks.map(t => (
              <li key={t.id} className="sprint-game-rank-row card">
                <span className="sprint-game-rank-task-name">{t.name}</span>
                <div className="sprint-poker-deck-row">
                  {DECK.map(v => (
                    <button
                      key={v}
                      type="button"
                      className={`btn btn-secondary btn-sm sprint-poker-card${draft[t.id] === v ? ' btn-primary' : ''}`}
                      onClick={() => setDraft(d => ({ ...d, [t.id]: v }))}
                      disabled={draftLoading}
                    >
                      {v}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setDraft(d => ({ ...d, [t.id]: '' }))}
                    disabled={draftLoading}
                  >
                    Clear
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {saveError ? <div className="form-error mt-2">{saveError}</div> : null}
          <div className="mt-3">
            <button type="button" className="btn btn-primary" disabled={draftLoading || saving} onClick={() => void saveVotes()}>
              {saving ? 'Saving…' : 'Save estimates'}
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
                        disabled={saving}
                        onClick={async () => {
                          const m = row.mode;
                          if (m == null) return;
                          setSaving(true);
                          try {
                            await pokerApplyEvaluation(row.taskId, m, currentMemberId ?? undefined);
                            onTasksChanged();
                          } finally {
                            setSaving(false);
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
                        disabled={saving}
                        onClick={async () => {
                          setSaving(true);
                          try {
                            await assignTask(row.taskId, [mid], currentMemberId ?? undefined);
                            onTasksChanged();
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

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">Planning poker · Sprint {sprintNumber}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          {flow === 'menu' ? menuView : flow === 'play' ? playView : resultsView}
        </div>
      </div>
    </div>
  );
}
