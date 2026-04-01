import { useEffect, useMemo, useState } from 'react';
import { bulkImportTasks, bulkImportSprintBundle } from '../../api/client';
import type {
  GroupMember,
  BulkImportTaskDto,
  BulkImportSprintGoalDto,
  TaskPriority,
  TaskStatus,
  TaskCategory,
} from '../../types';

interface Props {
  currentMember: GroupMember | null;
  onClose: () => void;
  onImported: () => void;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function buildAiPrompt(sprintCount: number, sprintDeadlines: string[], rubric: string): string {
  const deadlineLines = sprintDeadlines
    .map((d, i) => `- Sprint ${i + 1} ends on: ${d} (use this exact date as sprintDueDate for sprint ${i + 1}, and keep each task deadline in that sprint on or before this date)`)
    .join('\n');

  const jsonExample = `{
  "sprintGoals": [
    {
      "sprintNumber": 1,
      "goal": "Short sprint goal in one sentence",
      "sprintDueDate": "YYYY-MM-DD"
    }
  ],
  "tasks": [
    {
      "name": "Task title",
      "description": "Optional details (stored as notes)",
      "estimatedTime": "2 hours",
      "deadline": "YYYY-MM-DD",
      "priority": "High",
      "isRequired": true,
      "status": "NotStarted",
      "sprintNumber": 1,
      "category": "SprintBacklog",
      "tags": "optional",
      "subtaskNames": ["Step one", "Step two"],
      "assigneeNames": []
    }
  ]
}`;

  return `You are helping a student team plan a course project using fixed-length sprints.

SPRINT SETUP (use exactly — do not change these dates in sprintGoals):
- Number of sprints: ${sprintCount}
${deadlineLines}

Your job:
1. Write one clear sprint goal per sprint in "sprintGoals". Each entry must include sprintNumber (1..${sprintCount}), goal (text), and sprintDueDate matching the deadline above for that sprint.
2. Generate concrete tasks in "tasks". Every task must include "sprintNumber" (1..${sprintCount}) so it belongs to a sprint.
3. Each task's "deadline" must be YYYY-MM-DD and must be on or before the sprintDueDate for that task's sprint.
4. Prefer category "SprintBacklog" for normal sprint work; use "ProductBacklog" only if appropriate for pre-sprint items (still set sprintNumber if tied to a sprint).

OUTPUT FORMAT — return ONLY valid JSON (no markdown fences, no commentary) with this structure:

${jsonExample}

Rules:
- Root must be a single JSON object with keys "sprintGoals" (array) and "tasks" (array).
- sprintGoals.length should be ${sprintCount} (one per sprint).
- priority: only "High", "Medium", or "Low"
- status: only "NotStarted", "InProgress", or "Completed" (default new work to "NotStarted")
- subtaskNames and assigneeNames may be empty arrays
- assigneeNames: use member display names if known; otherwise []

---
PROJECT DESCRIPTION / RUBRIC (from the team):
${rubric.trim() || '(The user will add details here before sending to the AI — you may infer sensible tasks if this section is short.)'}
`;
}

const SAMPLE_OUTPUT = `{
  "sprintGoals": [
    {
      "sprintNumber": 1,
      "goal": "Finish research and requirements",
      "sprintDueDate": "2026-04-10"
    },
    {
      "sprintNumber": 2,
      "goal": "Build core features and test",
      "sprintDueDate": "2026-04-24"
    }
  ],
  "tasks": [
    {
      "name": "Draft requirements doc",
      "description": "Scope, users, success criteria",
      "estimatedTime": "3 hours",
      "deadline": "2026-04-08",
      "priority": "High",
      "isRequired": true,
      "status": "NotStarted",
      "sprintNumber": 1,
      "category": "SprintBacklog",
      "tags": "Docs",
      "subtaskNames": ["Outline", "Review with team"],
      "assigneeNames": []
    },
    {
      "name": "Implement API endpoints",
      "description": "CRUD for main entities",
      "estimatedTime": "8 hours",
      "deadline": "2026-04-22",
      "priority": "High",
      "isRequired": true,
      "status": "NotStarted",
      "sprintNumber": 2,
      "category": "SprintBacklog",
      "tags": "Backend",
      "subtaskNames": [],
      "assigneeNames": []
    }
  ]
}`;

function normalizeTask(raw: unknown, index: number): BulkImportTaskDto {
  if (!raw || typeof raw !== 'object') throw new Error(`Task ${index + 1}: expected an object.`);
  const o = raw as Record<string, unknown>;
  const name = String(o.name ?? '').trim();
  if (!name) throw new Error(`Task ${index + 1}: missing "name".`);

  const pr = String(o.priority ?? 'Medium');
  const priority: TaskPriority = pr === 'High' || pr === 'Low' ? pr : 'Medium';

  const stRaw = String(o.status ?? 'NotStarted');
  const status: TaskStatus =
    stRaw === 'Completed'
      ? 'Completed'
      : stRaw === 'InProgress' || stRaw === 'WorkingOnIt'
        ? 'InProgress'
        : 'NotStarted';

  let sprintNumber: number | undefined;
  if (o.sprintNumber != null && o.sprintNumber !== '') {
    const n = Number(o.sprintNumber);
    if (Number.isFinite(n) && n >= 1) sprintNumber = Math.floor(n);
  }

  const catRaw = String(o.category ?? '');
  const category: TaskCategory | undefined = [
    'ProductBacklog',
    'SprintGoal',
    'SprintBacklog',
    'Other',
  ].includes(catRaw)
    ? (catRaw as TaskCategory)
    : undefined;
  const defaultCategory: TaskCategory = sprintNumber != null ? 'SprintBacklog' : 'ProductBacklog';

  const notes =
    o.notes != null && String(o.notes).trim()
      ? String(o.notes)
      : o.description != null && String(o.description).trim()
        ? String(o.description)
        : undefined;

  let deadline: string | undefined;
  if (o.deadline != null && String(o.deadline).trim()) {
    deadline = String(o.deadline).slice(0, 10);
  }

  return {
    name,
    notes,
    estimatedTime: o.estimatedTime != null ? String(o.estimatedTime) : undefined,
    deadline,
    priority,
    isRequired: typeof o.isRequired === 'boolean' ? o.isRequired : true,
    status,
    tags: o.tags != null ? String(o.tags) : undefined,
    sprintNumber,
    category: category ?? defaultCategory,
    subtaskNames: Array.isArray(o.subtaskNames) ? o.subtaskNames.map(x => String(x)) : [],
    assigneeNames: Array.isArray(o.assigneeNames) ? o.assigneeNames.map(x => String(x)) : [],
  };
}

function normalizeSprintGoal(raw: unknown, index: number): BulkImportSprintGoalDto {
  if (!raw || typeof raw !== 'object') throw new Error(`Sprint goal ${index + 1}: expected an object.`);
  const o = raw as Record<string, unknown>;
  const n = Number(o.sprintNumber);
  if (!Number.isFinite(n) || n < 1) throw new Error(`Sprint goal ${index + 1}: invalid or missing "sprintNumber".`);
  let sprintDueDate: string | undefined;
  if (o.sprintDueDate != null && String(o.sprintDueDate).trim()) {
    sprintDueDate = String(o.sprintDueDate).slice(0, 10);
  }
  return {
    sprintNumber: Math.floor(n),
    goal: String(o.goal ?? '').trim(),
    sprintDueDate,
  };
}

export default function BulkImportModal({ currentMember, onClose, onImported }: Props) {
  const [step, setStep] = useState<'prompt' | 'paste' | 'preview'>('prompt');
  const [sprintCount, setSprintCount] = useState(3);
  const [deadlines, setDeadlines] = useState<string[]>(['', '', '']);
  const [rubric, setRubric] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [previewGoals, setPreviewGoals] = useState<BulkImportSprintGoalDto[]>([]);
  const [previewTasks, setPreviewTasks] = useState<BulkImportTaskDto[]>([]);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    setDeadlines(d => {
      const next = d.slice(0, sprintCount);
      while (next.length < sprintCount) next.push('');
      return next;
    });
  }, [sprintCount]);

  const fullPrompt = useMemo(
    () => buildAiPrompt(sprintCount, deadlines, rubric),
    [sprintCount, deadlines, rubric],
  );

  const deadlinesValid = deadlines.slice(0, sprintCount).every(d => DATE_RE.test(d));

  const handleParse = () => {
    setError('');
    try {
      const cleaned = pasteText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
      const parsed: unknown = JSON.parse(cleaned);

      let goals: BulkImportSprintGoalDto[] = [];
      let tasksRaw: unknown[];

      if (Array.isArray(parsed)) {
        tasksRaw = parsed;
      } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { tasks?: unknown }).tasks)) {
        const p = parsed as { tasks: unknown[]; sprintGoals?: unknown };
        tasksRaw = p.tasks;
        if (Array.isArray(p.sprintGoals)) {
          goals = p.sprintGoals.map((g, i) => normalizeSprintGoal(g, i));
        }
      } else {
        throw new Error('Expected a JSON array of tasks, or an object with a "tasks" array.');
      }

      if (tasksRaw.length === 0) throw new Error('No tasks found.');

      const tasks = tasksRaw.map((t, i) => normalizeTask(t, i));
      setPreviewGoals(goals);
      setPreviewTasks(tasks);
      setStep('preview');
    } catch (e: unknown) {
      setError(`Parse error: ${(e as Error).message}. Paste valid JSON from the AI.`);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setError('');
    try {
      if (previewGoals.length > 0) {
        await bulkImportSprintBundle(previewGoals, previewTasks, currentMember?.id);
      } else {
        await bulkImportTasks(previewTasks, currentMember?.id);
      }
      onImported();
    } catch {
      setError('Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  const copyPrompt = () => {
    void navigator.clipboard.writeText(fullPrompt);
  };

  const goToPaste = () => {
    setError('');
    if (!deadlinesValid) {
      setError(`Set a valid deadline (YYYY-MM-DD) for each of the ${sprintCount} sprints before continuing.`);
      return;
    }
    setStep('paste');
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">Bulk import tasks via AI</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {['Sprint setup & prompt', 'Paste AI output', 'Preview & import'].map((s, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '6px',
                  borderRadius: 6,
                  background:
                    (step === 'prompt' && i === 0) || (step === 'paste' && i === 1) || (step === 'preview' && i === 2)
                      ? 'var(--primary-light)'
                      : 'var(--bg)',
                  color:
                    (step === 'prompt' && i === 0) || (step === 'paste' && i === 1) || (step === 'preview' && i === 2)
                      ? 'var(--primary)'
                      : 'var(--text-muted)',
                  fontWeight: 500,
                  fontSize: 13,
                }}
              >
                {i + 1}. {s}
              </div>
            ))}
          </div>

          {step === 'prompt' && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                Set how many sprints you have and each sprint&apos;s end date. Add your rubric, then copy the prompt and
                send it to an AI. The response must be one JSON object with <code>sprintGoals</code> and{' '}
                <code>tasks</code>.
              </p>

              <div className="form-row">
                <label>Number of sprints</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={sprintCount}
                  onChange={e => setSprintCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                  style={{ maxWidth: 120 }}
                />
              </div>

              {Array.from({ length: sprintCount }, (_, i) => (
                <div key={i} className="form-row">
                  <label>Sprint {i + 1} deadline</label>
                  <input
                    type="date"
                    value={deadlines[i] ?? ''}
                    onChange={e => {
                      const next = [...deadlines];
                      next[i] = e.target.value;
                      setDeadlines(next);
                    }}
                  />
                </div>
              ))}

              <div className="form-row">
                <label>Project / rubric (included in the prompt)</label>
                <textarea
                  rows={5}
                  value={rubric}
                  onChange={e => setRubric(e.target.value)}
                  placeholder="Paste course requirements, rubric, or project description…"
                />
              </div>

              {error && <div className="form-error">{error}</div>}

              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                Full prompt (updates as you edit above):
              </p>
              <div
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border-dark)',
                  borderRadius: 8,
                  padding: 12,
                  fontFamily: 'monospace',
                  fontSize: 11,
                  whiteSpace: 'pre-wrap',
                  maxHeight: 200,
                  overflowY: 'auto',
                  marginBottom: 12,
                }}
              >
                {fullPrompt}
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={copyPrompt}>
                  Copy prompt
                </button>
              </div>
              <div className="divider" />
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                Example AI output shape:
              </p>
              <div
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border-dark)',
                  borderRadius: 8,
                  padding: 12,
                  fontFamily: 'monospace',
                  fontSize: 11,
                  whiteSpace: 'pre-wrap',
                  maxHeight: 220,
                  overflowY: 'auto',
                }}
              >
                {SAMPLE_OUTPUT}
              </div>
            </div>
          )}

          {step === 'paste' && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                Paste the AI&apos;s JSON below. Use the object with <code>sprintGoals</code> and <code>tasks</code>, or
                a plain array of tasks only (legacy).
              </p>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder='Paste JSON here…'
                style={{ minHeight: 280, fontFamily: 'monospace', fontSize: 12 }}
              />
              {error && <div className="form-error">{error}</div>}
            </div>
          )}

          {step === 'preview' && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                {previewGoals.length > 0 && (
                  <>
                    {previewGoals.length} sprint goal{previewGoals.length !== 1 ? 's' : ''} and{' '}
                  </>
                )}
                {previewTasks.length} task{previewTasks.length !== 1 ? 's' : ''} will be saved.
              </p>

              {previewGoals.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Sprint goals</div>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {previewGoals.map((g, i) => (
                      <li
                        key={i}
                        style={{
                          padding: '8px 10px',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          background: 'var(--bg)',
                          fontSize: 13,
                        }}
                      >
                        <strong>Sprint {g.sprintNumber}</strong>
                        {g.sprintDueDate && <span className="text-muted"> · due {g.sprintDueDate}</span>}
                        <div className="text-muted" style={{ marginTop: 4 }}>
                          {g.goal || '(empty goal)'}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Tasks</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
                {previewTasks.map((t, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '10px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      background: 'var(--bg)',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 13 }}>{t.name}</strong>
                      {t.sprintNumber != null && (
                        <span className="badge badge-required">Sprint {t.sprintNumber}</span>
                      )}
                      <span className={`badge badge-${t.priority?.toLowerCase()}`}>{t.priority}</span>
                      {t.isRequired ? (
                        <span className="badge badge-required">Required</span>
                      ) : (
                        <span className="badge badge-optional">Optional</span>
                      )}
                    </div>
                    {(t.notes || t.description) && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.notes ?? t.description}</div>
                    )}
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      {t.estimatedTime && <span>Est: {t.estimatedTime}</span>}
                      {t.deadline && <span>Due: {t.deadline}</span>}
                      {t.category && <span>{t.category}</span>}
                      {t.subtaskNames && t.subtaskNames.length > 0 && <span>{t.subtaskNames.length} subtasks</span>}
                    </div>
                  </div>
                ))}
              </div>
              {error && <div className="form-error mt-2">{error}</div>}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {step === 'prompt' && (
            <button type="button" className="btn btn-primary" onClick={goToPaste}>
              Next: paste AI output
            </button>
          )}
          {step === 'paste' && (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setStep('prompt')}>
                Back
              </button>
              <button type="button" className="btn btn-primary" disabled={!pasteText.trim()} onClick={handleParse}>
                Parse &amp; preview
              </button>
            </>
          )}
          {step === 'preview' && (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setStep('paste')}>
                Back
              </button>
              <button type="button" className="btn btn-primary" disabled={importing} onClick={handleImport}>
                {importing
                  ? 'Importing…'
                  : previewGoals.length > 0
                    ? `Import goals + ${previewTasks.length} tasks`
                    : `Import ${previewTasks.length} tasks`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
