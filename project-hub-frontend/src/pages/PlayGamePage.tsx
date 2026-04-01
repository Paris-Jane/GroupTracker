import { useEffect, useState } from 'react';
import { getTasks, submitRating, getGameResults, assignTask } from '../api/client';
import type { TaskItem, TaskRatingSummary, GroupMember } from '../types';
import Avatar from '../components/common/Avatar';

interface Props {
  currentMember: GroupMember | null;
  members: GroupMember[];
}

type GameView = 'intro' | 'rating' | 'results';

// ── Rating flow ──────────────────────────────────────────────────────────────

function RatingFlow({ tasks, currentMember, onDone }: { tasks: TaskItem[]; currentMember: GroupMember; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [ratings, setRatings] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const task = tasks[index];
  const current = ratings[task?.id] ?? 5;
  const done = index >= tasks.length;

  const handleSubmitAll = async () => {
    setSubmitting(true);
    for (const [taskId, val] of Object.entries(ratings)) {
      await submitRating(Number(taskId), currentMember.id, val);
    }
    onDone();
  };

  if (done) {
    return (
      <div className="card" style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>All tasks rated!</div>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
          You've rated {Object.keys(ratings).length} tasks. Submit your ratings to the group.
        </p>
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 20, textAlign: 'left' }}>
          {tasks.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span>{t.name}</span>
              <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{ratings[t.id] ?? '—'}/10</span>
            </div>
          ))}
        </div>
        <button className="btn btn-primary" disabled={submitting} onClick={handleSubmitAll}>
          {submitting ? 'Submitting…' : 'Submit My Ratings'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      {/* Progress */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
          <span>Task {index + 1} of {tasks.length}</span>
          <span>{Math.round((index / tasks.length) * 100)}% done</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(index / tasks.length) * 100}%` }} />
        </div>
      </div>

      <div className="card" style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>
          Rate your ability to complete this task
        </div>
        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>{task.name}</div>
        {task.description && (
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>{task.description}</p>
        )}
        {task.estimatedTime && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>⏱ Estimated: {task.estimatedTime}</div>
        )}

        {/* Rating slider */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--primary)', marginBottom: 8, lineHeight: 1 }}>
            {current}
            <span style={{ fontSize: 20, color: 'var(--text-muted)' }}>/10</span>
          </div>
          <input
            type="range" min={1} max={10} value={current}
            onChange={e => setRatings(r => ({ ...r, [task.id]: Number(e.target.value) }))}
            style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer', height: 'auto' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            <span>1 — Not confident</span>
            <span>10 — Very confident</span>
          </div>
        </div>

        {/* Quick rating buttons */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
          {[1,2,3,4,5,6,7,8,9,10].map(n => (
            <button
              key={n}
              onClick={() => setRatings(r => ({ ...r, [task.id]: n }))}
              style={{
                width: 36, height: 36, borderRadius: 6, border: '2px solid',
                borderColor: current === n ? 'var(--primary)' : 'var(--border-dark)',
                background: current === n ? 'var(--primary)' : 'var(--surface)',
                color: current === n ? '#fff' : 'var(--text)',
                fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}
            >{n}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            className="btn btn-secondary"
            disabled={index === 0}
            onClick={() => setIndex(i => i - 1)}
          >← Back</button>
          <button
            className="btn btn-primary"
            onClick={() => {
              if (!ratings[task.id]) setRatings(r => ({ ...r, [task.id]: current }));
              setIndex(i => i + 1);
            }}
          >
            {index === tasks.length - 1 ? 'Finish →' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Results / Assignment screen ──────────────────────────────────────────────

function ResultsScreen({ members, onAssigned }: { members: GroupMember[]; onAssigned: () => void }) {
  const [summaries, setSummaries] = useState<TaskRatingSummary[]>([]);
  const [assigning, setAssigning] = useState<Record<number, boolean>>({});

  useEffect(() => { getGameResults().then(data => setSummaries(data.filter(s => s.ratings.length > 0))); }, []);

  if (summaries.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📊</div>
        <div className="empty-title">No ratings yet</div>
        <div>Have group members rate tasks first to see results.</div>
      </div>
    );
  }

  const handleAssign = async (taskId: number, memberId: number) => {
    setAssigning(a => ({ ...a, [taskId]: true }));
    await assignTask(taskId, [memberId]);
    setSummaries(s => s.map(r => r.taskItemId === taskId ? { ...r, currentAssigneeId: memberId } : r));
    setAssigning(a => ({ ...a, [taskId]: false }));
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Rating Results</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Review who rated highest for each task and make assignments.
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {summaries.map(s => (
          <div key={s.taskItemId} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{s.taskName}</div>
                {s.highestScoringMemberName && (
                  <div style={{ fontSize: 13, color: 'var(--success)' }}>
                    🏆 Top scorer: <strong>{s.highestScoringMemberName}</strong>
                  </div>
                )}
              </div>
              {s.currentAssigneeId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Avatar
                    initial={members.find(m => m.id === s.currentAssigneeId)?.avatarInitial}
                    color={members.find(m => m.id === s.currentAssigneeId)?.color}
                    size="sm"
                  />
                  <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>Assigned</span>
                </div>
              )}
            </div>

            {/* Rating bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {s.ratings
                .sort((a, b) => b.ratingValue - a.ratingValue)
                .map(r => {
                  const member = members.find(m => m.id === r.groupMemberId);
                  const isTop = r.groupMemberId === s.highestScoringMemberId;
                  return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar initial={member?.avatarInitial} color={member?.color} size="sm" name={r.memberName} />
                      <span style={{ width: 120, fontSize: 13, fontWeight: isTop ? 600 : 400 }}>{r.memberName}</span>
                      <div style={{ flex: 1, height: 20, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${r.ratingValue * 10}%`,
                          background: isTop ? 'var(--success)' : (member?.color ?? 'var(--primary)'),
                          borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6,
                          transition: 'width .5s',
                        }}>
                          <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>{r.ratingValue}</span>
                        </div>
                      </div>
                      <button
                        className="btn btn-secondary btn-xs"
                        disabled={!!assigning[s.taskItemId]}
                        style={{ flexShrink: 0, borderColor: s.currentAssigneeId === r.groupMemberId ? 'var(--success)' : '' }}
                        onClick={() => handleAssign(s.taskItemId, r.groupMemberId)}
                      >
                        {s.currentAssigneeId === r.groupMemberId ? '✓ Assigned' : 'Assign'}
                      </button>
                    </div>
                  );
                })}
            </div>

            {/* Auto-assign top scorer */}
            {s.highestScoringMemberId && s.currentAssigneeId !== s.highestScoringMemberId && (
              <button
                className="btn btn-secondary btn-sm"
                disabled={!!assigning[s.taskItemId]}
                onClick={() => handleAssign(s.taskItemId, s.highestScoringMemberId!)}
              >
                Assign to top scorer ({s.highestScoringMemberName})
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Play Game Page ──────────────────────────────────────────────────────

export default function PlayGamePage({ currentMember, members }: Props) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [view, setView] = useState<GameView>('intro');

  useEffect(() => {
    getTasks().then(data => setTasks(data.filter(t => t.status !== 'Completed')));
  }, []);

  return (
    <div>
      <div className="top-bar">
        <span className="top-bar-title">🎮 Play Game — Task Assignment</span>
        {view !== 'intro' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={`btn btn-sm ${view === 'rating' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('rating')}>Rate Tasks</button>
            <button className={`btn btn-sm ${view === 'results' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('results')}>Results</button>
          </div>
        )}
      </div>

      <div className="page-body">
        {view === 'intro' && (
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🎮</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Fair Task Assignment Game</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
                Each group member rates 1–10 how well they could complete each task.
                After everyone has rated, see who scored highest for each task and make assignments fairly.
              </p>

              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 32 }}>
                {members.map(m => (
                  <div key={m.id} style={{ textAlign: 'center' }}>
                    <Avatar initial={m.avatarInitial} color={m.color} size="lg" />
                    <div style={{ fontSize: 12, marginTop: 4 }}>{m.name}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, textAlign: 'left', marginBottom: 24 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>How it works:</div>
                <ol style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
                  <li>Each member selects their name and rates each task 1–10</li>
                  <li>After everyone rates, go to Results</li>
                  <li>Assign tasks to the highest-rated person (or override)</li>
                </ol>
              </div>

              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
                {tasks.length} incomplete task{tasks.length !== 1 ? 's' : ''} to rate
              </div>

              {!currentMember ? (
                <p style={{ color: 'var(--danger)', fontSize: 14 }}>Select a group member from the sidebar to continue.</p>
              ) : tasks.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No incomplete tasks to rate.</p>
              ) : (
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                  <button className="btn btn-primary" onClick={() => setView('rating')}>
                    Start Rating as {currentMember.name}
                  </button>
                  <button className="btn btn-secondary" onClick={() => setView('results')}>
                    View Results
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'rating' && currentMember && tasks.length > 0 && (
          <RatingFlow
            tasks={tasks}
            currentMember={currentMember}
            onDone={() => setView('results')}
          />
        )}

        {view === 'results' && (
          <ResultsScreen members={members} onAssigned={() => {}} />
        )}
      </div>
    </div>
  );
}
