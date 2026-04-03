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

function buildAiPrompt(sprintCount: number): string {
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

  return `You are a project planner for a student software team.

## Inputs (files — not pasted in this message)
The user will **attach** their project description, rubric, syllabus, requirements, or other documents as **files** in the AI chat. You do **not** receive that text in this prompt body. Read every attachment carefully; they are the primary source of truth for scope, grading criteria, and deadlines mentioned there.

## What you must produce
1. **productGoal** — One sentence: product outcome, primary users, and success in plain language.
2. **sprintGoals** — Exactly ${sprintCount} objects, sprintNumber 1..${sprintCount} in order. Each goal is a concrete outcome for that sprint. Include **sprintDueDate** as YYYY-MM-DD for each sprint when the attachments specify dates; otherwise infer sensible end-of-sprint dates that stay consistent across goals and tasks.
3. **tasks** — A complete backlog covering **everything** in the attachments: features, docs, testing, deployment, demos, presentations, reviews, and graded deliverables. **Nothing important should be missing.**

## Chronological logic
- Earlier sprints: research, design, setup, spikes, scaffolding. Later sprints: integration, polish, demos, submission.
- Each task \`deadline\` should be YYYY-MM-DD on or before the **sprintDueDate** of its \`sprintNumber\` when those dates exist.

## JSON rules
- Return **only** valid JSON (no markdown fences, no commentary).
- Root keys: "productGoal" (string), "sprintGoals" (array length ${sprintCount}), "tasks" (array).
- Every task: \`sprintNumber\` in 1..${sprintCount}.
- priority: "High" | "Medium" | "Low". status: "NotStarted" | "InProgress" | "Completed" (default "NotStarted").
- category: prefer "SprintBacklog". subtaskNames / assigneeNames may be [].

## Example shape (structure only — replace with content from the attachments)

${jsonExample}
`;
}

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
  { step: 'prompt', label: 'Prompt' },
  { step: 'paste', label: 'Paste AI output' },
  { step: 'preview', label: 'Preview & import' },
];

export default function BulkImportModal({ currentMember, onClose, onImported }: Props) {
  const [step, setStep] = useState<'prompt' | 'paste' | 'preview'>('prompt');
  const [sprintCount, setSprintCount] = useState(1);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsLoadError, setSettingsLoadError] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);
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
        setSprintCount(n);
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

  const fullPrompt = useMemo(() => buildAiPrompt(sprintCount), [sprintCount]);

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
      const tasksToImport = previewTasks.map(t => ({ ...t, name: t.name.trim() })).filter(t => t.name);
      if (tasksToImport.length === 0) {
        setError('Add at least one task with a name before importing.');
        return;
      }
      if (previewGoals.length > 0) {
        await bulkImportSprintBundle(previewGoals, tasksToImport, currentMember?.id, {
          productGoal: previewProductGoal || undefined,
        });
      } else {
        await bulkImportTasks(tasksToImport, currentMember?.id);
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
    setPromptCopied(true);
    window.setTimeout(() => setPromptCopied(false), 2000);
  };

  const goToPaste = () => {
    setError('');
    setStep('paste');
  };

  const updatePreviewTask = (index: number, patch: Partial<BulkImportTaskDto>) => {
    setPreviewTasks(prev => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  };

  const updatePreviewGoal = (index: number, patch: Partial<BulkImportSprintGoalDto>) => {
    setPreviewGoals(prev => prev.map((g, i) => (i === index ? { ...g, ...patch } : g)));
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
              {!settingsLoaded ? (
                <p className="text-muted text-sm">Loading project settings…</p>
              ) : settingsLoadError ? (
                <div className="form-error mb-3">{settingsLoadError}</div>
              ) : (
                <>
                  <p className="text-sm text-muted mb-3">
                    Copy the prompt below, paste it into your AI tool, and <strong>attach</strong> your rubric, project
                    description, and any other files. When the model returns JSON, continue to <strong>Paste AI output</strong>.
                  </p>
                  {error && <div className="form-error mb-3">{error}</div>}
                  <div className="flex gap-2 flex-wrap mb-3">
                    <button type="button" className="btn btn-primary btn-sm" onClick={copyPrompt}>
                      {promptCopied ? 'Copied!' : 'Copy prompt'}
                    </button>
                  </div>
                  <p className="text-xs text-muted mb-2">Prompt text ({sprintCount} sprints in this project):</p>
                  <pre className="bulk-import-prompt-pre">{fullPrompt}</pre>
                </>
              )}
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
              {previewTasks.length === 0 ? (
                <p className="text-muted text-sm mb-3">
                  Nothing to preview yet. Go to <strong>Paste AI output</strong>, paste JSON, then use{' '}
                  <strong>Parse &amp; preview</strong>.
                </p>
              ) : null}
              <p className="text-sm text-muted mb-3">
                Edit anything below before importing.{' '}
                {previewGoals.length > 0 ? `${previewGoals.length} sprint goals and ` : ''}
                {previewTasks.length} task{previewTasks.length !== 1 ? 's' : ''} will be saved.
              </p>

              <div className="form-row">
                <label>Product goal</label>
                <textarea
                  rows={2}
                  value={previewProductGoal}
                  onChange={e => setPreviewProductGoal(e.target.value)}
                  placeholder="Optional product goal"
                />
              </div>

              {previewGoals.length > 0 && (
                <div className="mb-3">
                  <div className="text-sm font-semibold mb-2">Sprint goals</div>
                  <div className="bulk-import-edit-goals">
                    {previewGoals.map((g, i) => (
                      <div key={i} className="bulk-import-edit-goal card">
                        <label className="text-xs text-muted">Sprint {g.sprintNumber}</label>
                        <input
                          type="text"
                          value={g.goal}
                          onChange={e => updatePreviewGoal(i, { goal: e.target.value })}
                          placeholder="Goal"
                        />
                        <input
                          type="date"
                          value={g.sprintDueDate ?? ''}
                          onChange={e => updatePreviewGoal(i, { sprintDueDate: e.target.value || undefined })}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-sm font-semibold mb-2">Tasks</div>
              <div className="bulk-import-edit-tasks">
                {previewTasks.map((t, i) => (
                  <div key={i} className="bulk-import-edit-task card">
                    <input
                      className="bulk-import-edit-task-name"
                      value={t.name}
                      onChange={e => updatePreviewTask(i, { name: e.target.value })}
                      placeholder="Task name"
                    />
                    <textarea
                      rows={2}
                      value={t.notes ?? ''}
                      onChange={e => updatePreviewTask(i, { notes: e.target.value || undefined })}
                      placeholder="Notes"
                    />
                    <div className="bulk-import-edit-task-row">
                      <label className="text-xs text-muted">
                        Sprint #
                        <input
                          type="number"
                          min={1}
                          value={t.sprintNumber ?? ''}
                          onChange={e =>
                            updatePreviewTask(i, {
                              sprintNumber: e.target.value ? Number(e.target.value) : undefined,
                            })
                          }
                        />
                      </label>
                      <label className="text-xs text-muted">
                        Due
                        <input
                          type="date"
                          value={t.deadline ?? ''}
                          onChange={e => updatePreviewTask(i, { deadline: e.target.value || undefined })}
                        />
                      </label>
                      <label className="text-xs text-muted">
                        Priority
                        <select
                          value={t.priority}
                          onChange={e => updatePreviewTask(i, { priority: e.target.value as TaskPriority })}
                        >
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      </label>
                      <label className="text-xs text-muted flex gap-1 items-center">
                        <input
                          type="checkbox"
                          checked={t.isRequired}
                          onChange={e => updatePreviewTask(i, { isRequired: e.target.checked })}
                        />
                        Required
                      </label>
                    </div>
                    <input
                      type="text"
                      value={t.estimatedTime ?? ''}
                      onChange={e => updatePreviewTask(i, { estimatedTime: e.target.value || undefined })}
                      placeholder="Estimated time"
                    />
                    <input
                      type="text"
                      value={(t.subtaskNames ?? []).join(', ')}
                      onChange={e =>
                        updatePreviewTask(i, {
                          subtaskNames: e.target.value
                            .split(',')
                            .map(s => s.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="Subtasks (comma-separated)"
                    />
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
              disabled={!settingsLoaded || !!settingsLoadError}
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
