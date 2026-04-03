import { useEffect, useMemo, useState } from 'react';
import { bulkImportTasks, bulkImportSprintBundle, updateProjectSettings, getProjectSettings } from '../../api/client';
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
    .map(
      (d, i) =>
        `- Sprint ${i + 1} ends on: **${d}** → sprintGoals[${i}].sprintDueDate must be exactly \`${d}\`. All tasks with sprintNumber ${i + 1} must have deadline ≤ this date.`,
    )
    .join('\n');

  const timelineHint = sprintDeadlines
    .filter(Boolean)
    .map((d, i) => `S${i + 1}≤${d}`)
    .join(' → ');

  const jsonExample = `{
  "productGoal": "One clear sentence: what the team is building and for whom",
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

  return `You are a project planner for a student software team. The sprint count and end dates below are **fixed by the instructor/admin** — copy them exactly into sprintGoals; do not invent different dates or sprint counts.

## Fixed sprint calendar (${sprintCount} sprints, chronological)
${deadlineLines}
Timeline constraint summary: ${timelineHint || '(see above)'}

## What you must produce
1. **productGoal** — One sentence: product outcome, primary users, and success in plain language.
2. **sprintGoals** — Exactly ${sprintCount} objects, sprintNumber 1..${sprintCount} in order. Each goal is a concrete outcome for that sprint. **sprintDueDate** must match the fixed date for that sprint above (YYYY-MM-DD).
3. **tasks** — A complete backlog that covers **everything** implied by the rubric/description: features, docs, testing, deployment, demos, presentations, reviews, and any graded deliverables. **Nothing important should be missing.** If the rubric lists sections or percentages, mirror those as tasks or subtasks where sensible.

## Chronological logic (critical)
- **Sprint order:** Earlier sprints should contain prerequisites: research, design, setup, spikes, scaffolding, data model, APIs. Later sprints: integration, hardening, UX polish, bug bashes, rehearsal, final demo, submission tasks.
- **Task deadlines:** Each task's \`deadline\` must be a valid YYYY-MM-DD **on or before** the sprintDueDate of its \`sprintNumber\`. Prefer spreading work through the sprint (earlier tasks due mid-sprint, milestones near sprint end) rather than piling everything on the last day unless the rubric says otherwise.
- **Within a sprint:** Order tasks in a sensible sequence (dependencies respected implicitly: e.g. don't put "deploy app" only in sprint 1 if the rubric expects a working build in sprint 3).
- **Completeness check:** Before you finish, mentally verify: every rubric bullet, milestone, and artifact type appears in at least one task or subtask; add tasks if anything was skipped.

## JSON rules
- Return **only** valid JSON (no markdown code fences, no commentary before or after).
- Root object keys: "productGoal" (string), "sprintGoals" (array length ${sprintCount}), "tasks" (array).
- Every task must have \`sprintNumber\` in 1..${sprintCount}.
- priority: "High" | "Medium" | "Low" only. status: "NotStarted" | "InProgress" | "Completed" (default new work "NotStarted").
- category: prefer "SprintBacklog"; "ProductBacklog" only if truly pre–sprint 1 (rare).
- subtaskNames / assigneeNames may be []. assigneeNames: real member names if known, else [].

## Output shape (example structure only — use real dates from the fixed calendar above)

${jsonExample}

---
## PROJECT DESCRIPTION / RUBRIC (primary source — mine this for full coverage)
${rubric.trim() || '(No rubric pasted yet — infer a sensible breakdown from typical course project expectations, still respecting the fixed sprint dates.)'}
`;
}

const SAMPLE_OUTPUT = `{
  "productGoal": "A course project web app that helps teams track sprints, tasks, and reviews in one place.",
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

const STEP_TABS: { step: 'prompt' | 'paste' | 'preview'; label: string }[] = [
  { step: 'prompt', label: 'Sprint setup & prompt' },
  { step: 'paste', label: 'Paste AI output' },
  { step: 'preview', label: 'Preview & import' },
];

export default function BulkImportModal({ currentMember, onClose, onImported }: Props) {
  const [step, setStep] = useState<'prompt' | 'paste' | 'preview'>('prompt');
  const [sprintCount, setSprintCount] = useState(1);
  const [deadlines, setDeadlines] = useState<string[]>(['']);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsLoadError, setSettingsLoadError] = useState<string | null>(null);
  const [rubric, setRubric] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [previewGoals, setPreviewGoals] = useState<BulkImportSprintGoalDto[]>([]);
  const [previewTasks, setPreviewTasks] = useState<BulkImportTaskDto[]>([]);
  const [previewProductGoal, setPreviewProductGoal] = useState('');
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSettingsLoadError(null);
    getProjectSettings()
      .then(s => {
        if (cancelled) return;
        const n = Math.max(1, Math.min(50, s.sprintCount ?? 6));
        const d = [...(s.sprintDeadlines ?? [])];
        while (d.length < n) d.push('');
        setSprintCount(n);
        setDeadlines(d.slice(0, n));
        setSettingsLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setSettingsLoadError('Could not load project settings. Check your connection and try again.');
          setSettingsLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fullPrompt = useMemo(
    () => buildAiPrompt(sprintCount, deadlines, rubric),
    [sprintCount, deadlines, rubric],
  );

  const deadlinesValid = deadlines.slice(0, sprintCount).every(d => DATE_RE.test(d));

  const goToStep = (s: 'prompt' | 'paste' | 'preview') => {
    setError('');
    setStep(s);
  };

  const handleParse = () => {
    setError('');
    try {
      const cleaned = pasteText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
      const parsed: unknown = JSON.parse(cleaned);

      let goals: BulkImportSprintGoalDto[] = [];
      let tasksRaw: unknown[];
      let productGoalFromJson = '';

      if (Array.isArray(parsed)) {
        tasksRaw = parsed;
      } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { tasks?: unknown }).tasks)) {
        const p = parsed as { tasks: unknown[]; sprintGoals?: unknown; productGoal?: unknown };
        tasksRaw = p.tasks;
        if (Array.isArray(p.sprintGoals)) {
          goals = p.sprintGoals.map((g, i) => normalizeSprintGoal(g, i));
        }
        if (typeof p.productGoal === 'string' && p.productGoal.trim()) {
          productGoalFromJson = p.productGoal.trim();
        }
      } else {
        throw new Error('Expected a JSON array of tasks, or an object with a "tasks" array.');
      }

      if (tasksRaw.length === 0) throw new Error('No tasks found.');

      const tasks = tasksRaw.map((t, i) => normalizeTask(t, i));
      setPreviewGoals(goals);
      setPreviewTasks(tasks);
      setPreviewProductGoal(productGoalFromJson);
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
        await bulkImportSprintBundle(previewGoals, previewTasks, currentMember?.id, {
          productGoal: previewProductGoal || undefined,
        });
      } else {
        await bulkImportTasks(previewTasks, currentMember?.id);
        if (previewProductGoal.trim()) {
          await updateProjectSettings({ productGoal: previewProductGoal.trim() });
        }
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
      setError(
        `Each sprint needs a deadline in Admin (Project settings). All ${sprintCount} sprint end dates must be set as YYYY-MM-DD before you continue.`,
      );
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
          <div className="bulk-import-steps" role="tablist" aria-label="Import steps">
            {STEP_TABS.map(({ step: tabStep, label }, i) => {
              const active = step === tabStep;
              return (
                <button
                  key={tabStep}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`bulk-import-step-tab${active ? ' bulk-import-step-tab--active' : ''}`}
                  onClick={() => goToStep(tabStep)}
                >
                  <span className="bulk-import-step-num">{i + 1}</span>
                  {label}
                </button>
              );
            })}
          </div>

          {step === 'prompt' && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                Sprint count and end dates come from <strong>Admin → project settings</strong> (not editable here). Add
                your rubric or project description, then copy the prompt for your AI. The response must be one JSON
                object with <code>sprintGoals</code> and <code>tasks</code>.
              </p>

              {!settingsLoaded ? (
                <p className="text-muted text-sm">Loading sprint settings…</p>
              ) : settingsLoadError ? (
                <div className="form-error mb-3">{settingsLoadError}</div>
              ) : (
                <div
                  className="bulk-import-admin-summary panel"
                  style={{ marginBottom: 16, padding: '12px 14px', fontSize: 13 }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Sprint plan (from admin)</div>
                  <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
                    {Array.from({ length: sprintCount }, (_, i) => (
                      <li key={i}>
                        Sprint {i + 1}
                        {deadlines[i] && DATE_RE.test(deadlines[i]) ? (
                          <> — ends <code>{deadlines[i]}</code></>
                        ) : (
                          <span className="text-danger"> — deadline missing or invalid (set in Admin)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {!deadlinesValid ? (
                    <p className="form-error mt-2 mb-0" style={{ fontSize: 12 }}>
                      Ask your admin to set every sprint end date (YYYY-MM-DD) before you can continue to paste AI
                      output.
                    </p>
                  ) : null}
                </div>
              )}

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
              {!deadlinesValid ? (
                <div className="form-error mb-3" style={{ fontSize: 13 }}>
                  Sprint deadlines are incomplete in Admin. Fix them before importing, or the prompt and JSON dates will
                  not match your project.
                </div>
              ) : null}
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
              {previewTasks.length === 0 ? (
                <p className="text-muted text-sm mb-3">
                  Nothing to preview yet. Go to <strong>Paste AI output</strong>, paste JSON, then use{' '}
                  <strong>Parse &amp; preview</strong>.
                </p>
              ) : null}
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                {previewGoals.length > 0 && (
                  <>
                    {previewGoals.length} sprint goal{previewGoals.length !== 1 ? 's' : ''} and{' '}
                  </>
                )}
                {previewTasks.length} task{previewTasks.length !== 1 ? 's' : ''} will be saved.
                {previewProductGoal && ' Product goal will be updated.'}
              </p>

              {previewProductGoal && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Product goal</div>
                  <div
                    style={{
                      padding: '10px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      background: 'var(--bg)',
                      fontSize: 13,
                      lineHeight: 1.45,
                    }}
                  >
                    {previewProductGoal}
                  </div>
                </div>
              )}

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
            <button
              type="button"
              className="btn btn-primary"
              disabled={!settingsLoaded || !!settingsLoadError || !deadlinesValid}
              onClick={goToPaste}
            >
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
              <button
                type="button"
                className="btn btn-primary"
                disabled={importing || previewTasks.length === 0}
                onClick={handleImport}
              >
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
