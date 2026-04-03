import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TaskItem, GroupMember } from '../../types';
import {
  fetchSprintPickRatingsForMember,
  saveSprintPickRatings,
  fetchSprintPickRatingsAggregated,
  assignTask,
} from '../../api/client';
import PickTaskCard from './pick/PickTaskCard';
import { aggregatePickRows, sameSortedMemberIds, type PickResultsRow } from './pick/pickResultsUtils';

type Flow = 'menu' | 'rank' | 'results';

const COMFORT_CARDS = [1, 2, 3, 4, 5] as const;

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
  onTasksChanged?: () => void | Promise<void>;
}) {
  const memberId = useMemo(() => normalizeMemberId(currentMemberId), [currentMemberId]);

  const [flow, setFlow] = useState<Flow>('menu');
  const [draft, setDraft] = useState<Record<number, number | ''>>({});
  const [draftLoading, setDraftLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [resultsRows, setResultsRows] = useState<PickResultsRow[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  /** Pending assignee picks per task; undefined key → use server `task.assignments`. */
  const [assignDraft, setAssignDraft] = useState<Record<number, number[] | undefined>>({});
  const [assignSavePending, setAssignSavePending] = useState<Record<number, boolean>>({});
  const [assignError, setAssignError] = useState('');
  const assignDraftRef = useRef(assignDraft);
  assignDraftRef.current = assignDraft;

  const sortedTasks = useMemo(
    () => [...sprintTasks].sort((a, b) => a.name.localeCompare(b.name)),
    [sprintTasks],
  );
  const taskOrder = useMemo(() => sortedTasks.map(t => t.id), [sortedTasks]);
  const taskMap = useMemo(() => new Map(sprintTasks.map(t => [t.id, t])), [sprintTasks]);

  const sortedTasksRef = useRef(sortedTasks);
  sortedTasksRef.current = sortedTasks;
  const taskMapRef = useRef(taskMap);
  taskMapRef.current = taskMap;

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
      setAssignDraft({});
      setAssignSavePending({});
      setAssignError('');
      return;
    }
  }, [open]);

  useEffect(() => {
    if (flow !== 'results') setAssignDraft({});
  }, [flow]);

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

  const toggleAssignSelection = useCallback((taskId: number, toggleMemberId: number) => {
    setAssignError('');
    setAssignDraft(prev => {
      const task = taskMapRef.current.get(taskId);
      const server = task?.assignments.map(a => Number(a.groupMemberId)) ?? [];
      const base = prev[taskId] !== undefined ? prev[taskId]! : server;
      const next = base.includes(toggleMemberId)
        ? base.filter(id => id !== toggleMemberId)
        : [...base, toggleMemberId];
      if (sameSortedMemberIds(next, server)) {
        if (prev[taskId] === undefined) return prev;
        const { [taskId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [taskId]: next };
    });
  }, []);

  const discardAssignDraft = useCallback((taskId: number) => {
    setAssignDraft(prev => {
      const { [taskId]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const saveAssigneesForTask = useCallback(
    async (taskId: number) => {
      if (memberId == null) return;
      const draft = assignDraftRef.current[taskId];
      if (draft === undefined) return;
      setAssignSavePending(p => ({ ...p, [taskId]: true }));
      setAssignError('');
      try {
        await assignTask(taskId, draft, memberId);
        await Promise.resolve(onTasksChanged?.());
        setAssignDraft(prev => {
          const { [taskId]: _, ...rest } = prev;
          return rest;
        });
      } catch {
        setAssignError('Could not save assignees. Check your connection and try again.');
      } finally {
        setAssignSavePending(p => {
          const { [taskId]: _, ...rest } = p;
          return rest;
        });
      }
    },
    [memberId, onTasksChanged],
  );

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
      await Promise.resolve(onTasksChanged?.());
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
      {assignError ? <div className="form-error mb-2">{assignError}</div> : null}
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
              const serverIds = task.assignments.map(a => Number(a.groupMemberId));
              const draft = assignDraft[row.taskId];
              const selectedIds = draft ?? serverIds;
              const assignDirty = draft !== undefined && !sameSortedMemberIds(draft, serverIds);
              return (
                <PickTaskCard
                  key={row.taskId}
                  row={row}
                  task={task}
                  members={members}
                  selectedMemberIds={selectedIds}
                  serverMemberIds={serverIds}
                  assignDirty={assignDirty}
                  currentMemberId={memberId}
                  savePending={!!assignSavePending[row.taskId]}
                  onToggleMember={mid => toggleAssignSelection(row.taskId, mid)}
                  onSaveAssignees={() => void saveAssigneesForTask(row.taskId)}
                  onDiscardAssignees={() => discardAssignDraft(row.taskId)}
                />
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
