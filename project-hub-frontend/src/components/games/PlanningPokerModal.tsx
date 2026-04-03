import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TaskItem, GroupMember } from '../../types';
import {
  fetchSprintPokerVotesForMember,
  saveSprintPokerVotes,
  fetchSprintPokerVotesAggregated,
  pokerApplyEvaluation,
} from '../../api/client';
import PokerTaskCard from './poker/PokerTaskCard';
import { aggregatePokerRows, type PokerResultsRow } from './poker/pokerResultsUtils';

const DECK = [0, 1, 2, 3, 5, 8, 13] as const;

type Flow = 'menu' | 'play' | 'results';

function normalizeMemberId(id: number | null): number | null {
  if (id == null) return null;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
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
  onTasksChanged: () => void | Promise<void>;
}) {
  const memberId = useMemo(() => normalizeMemberId(currentMemberId), [currentMemberId]);

  const [flow, setFlow] = useState<Flow>('menu');
  const [draft, setDraft] = useState<Record<number, number | ''>>({});
  const [saveError, setSaveError] = useState('');
  const [resultsRows, setResultsRows] = useState<PokerResultsRow[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [applyBusy, setApplyBusy] = useState<Record<number, boolean>>({});

  const sortedTasks = useMemo(
    () => [...sprintTasks].sort((a, b) => a.name.localeCompare(b.name)),
    [sprintTasks],
  );
  const taskOrder = useMemo(() => sortedTasks.map(t => t.id), [sortedTasks]);
  const taskMap = useMemo(() => new Map(sprintTasks.map(t => [t.id, t])), [sprintTasks]);

  const [draftLoading, setDraftLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
      setApplyBusy({});
    }
  }, [open]);

  useEffect(() => {
    if (!open || flow !== 'play' || memberId == null) return;
    let cancelled = false;
    setDraftLoading(true);
    fetchSprintPokerVotesForMember(sprintNumber, memberId)
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

  const loadResults = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setResultsLoading(true);
    try {
      const votes = await fetchSprintPokerVotesAggregated(sprintNumberRef.current);
      setResultsRows(aggregatePokerRows(taskOrderRef.current, votes, membersRef.current));
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

  const handleApplyEvaluation = useCallback(
    async (taskId: number, value: number) => {
      if (memberId == null) return;
      setApplyBusy(b => ({ ...b, [taskId]: true }));
      try {
        await pokerApplyEvaluation(taskId, value, memberId);
        await Promise.resolve(onTasksChanged());
      } finally {
        setApplyBusy(b => {
          const { [taskId]: _, ...rest } = b;
          return rest;
        });
      }
    },
    [memberId, onTasksChanged],
  );

  const saveVotes = async () => {
    if (memberId == null) return;
    setSaveError('');
    setSaving(true);
    try {
      const entries = sortedTasks.map(t => {
        const v = effectiveDraft[t.id];
        const value = v === '' || v === undefined ? null : Number(v);
        return {
          taskItemId: t.id,
          value: value != null && !Number.isNaN(value) ? value : null,
        };
      });
      await saveSprintPokerVotes(sprintNumber, memberId, entries);
      await Promise.resolve(onTasksChanged());
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
      {memberId == null ? (
        <p className="text-sm text-muted">Sign in to play poker.</p>
      ) : sortedTasks.length === 0 ? (
        <p className="text-sm text-muted">No tasks in this sprint yet.</p>
      ) : (
        <>
          {draftLoading ? (
            <p className="text-sm text-muted mb-2" aria-live="polite">
              Loading saved estimates…
            </p>
          ) : null}
          <ul className="sprint-game-rank-list">
            {sortedTasks.map(t => (
              <li key={t.id} className="sprint-game-rank-item">
                <div className="sprint-game-rank-panel">
                  <span className="sprint-game-rank-task-name">{t.name}</span>
                  <div className="sprint-poker-deck-row sprint-game-deck">
                    {DECK.map(v => (
                      <button
                        key={v}
                        type="button"
                        className={`sprint-game-tile${effectiveDraft[t.id] === v ? ' sprint-game-tile--on' : ''}`}
                        onClick={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDraft(d => ({ ...d, [t.id]: v }));
                        }}
                      >
                        {v}
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
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveVotes()}>
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
        <ul className="pick-results-list">
          {resultsRows
            .filter(row => taskMap.has(row.taskId))
            .map(row => {
              const task = taskMap.get(row.taskId)!;
              return (
                <PokerTaskCard
                  key={row.taskId}
                  row={row}
                  task={task}
                  members={members}
                  currentMemberId={memberId}
                  applying={!!applyBusy[row.taskId]}
                  onApplyEstimate={value => void handleApplyEvaluation(row.taskId, value)}
                />
              );
            })}
        </ul>
      )}
    </div>
  );

  return createPortal(
    <div className="modal-overlay modal-overlay--portal">
      <div className="modal modal-lg" role="dialog" aria-modal="true" aria-labelledby="poker-modal-title">
        <div className="modal-header">
          <span className="modal-title" id="poker-modal-title">
            Planning poker · Sprint {sprintNumber}
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          {flow === 'menu' ? menuView : flow === 'play' ? playView : resultsView}
        </div>
      </div>
    </div>,
    document.body,
  );
}
