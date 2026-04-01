import { useState } from 'react';
import { bulkImportTasks } from '../../api/client';
import type { GroupMember, BulkImportTaskDto } from '../../types';

interface Props {
  members: GroupMember[];
  currentMember: GroupMember | null;
  onClose: () => void;
  onImported: () => void;
}

// The strict JSON format the AI must return
const AI_PROMPT = `You are helping a student group organize their project tasks.
Based on the project description / rubric below, generate a list of tasks in exactly this JSON format:

[
  {
    "name": "Task name",
    "description": "Brief description",
    "estimatedTime": "X hours",
    "deadline": "YYYY-MM-DD",
    "priority": "High|Medium|Low",
    "isRequired": true,
    "status": "NotStarted",
    "tags": "optional,tags",
    "subtaskNames": ["Subtask 1", "Subtask 2"],
    "assigneeNames": []
  }
]

Rules:
- Output ONLY the JSON array, no markdown, no extra text.
- Use only these priority values: High, Medium, Low
- Use only these status values: NotStarted, WorkingOnIt, Completed
- subtaskNames and assigneeNames may be empty arrays
- Dates must be YYYY-MM-DD format

---
PASTE YOUR RUBRIC/DESCRIPTION BELOW:
`;

const SAMPLE_OUTPUT = `[
  {
    "name": "Literature review",
    "description": "Research 5+ academic sources on the topic.",
    "estimatedTime": "3 hours",
    "deadline": "2025-04-15",
    "priority": "High",
    "isRequired": true,
    "status": "NotStarted",
    "tags": "Research",
    "subtaskNames": ["Find sources", "Summarize each source", "Write synthesis"],
    "assigneeNames": []
  },
  {
    "name": "Build prototype",
    "description": "Create a working MVP based on the design.",
    "estimatedTime": "5 hours",
    "deadline": "2025-04-20",
    "priority": "High",
    "isRequired": true,
    "status": "NotStarted",
    "tags": "Development",
    "subtaskNames": ["Set up project", "Implement core feature", "Test & fix bugs"],
    "assigneeNames": []
  }
]`;

export default function BulkImportModal({ members, currentMember, onClose, onImported }: Props) {
  const [step, setStep] = useState<'prompt' | 'paste' | 'preview'>('prompt');
  const [pasteText, setPasteText] = useState('');
  const [preview, setPreview] = useState<BulkImportTaskDto[]>([]);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);

  const handleParse = () => {
    setError('');
    try {
      // Strip markdown code fences if present
      const cleaned = pasteText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) throw new Error('Expected a JSON array.');
      if (parsed.length === 0) throw new Error('Array is empty.');
      // Basic validation of first item
      if (!parsed[0].name) throw new Error('Each task must have a "name" field.');
      setPreview(parsed as BulkImportTaskDto[]);
      setStep('preview');
    } catch (e: unknown) {
      setError(`Parse error: ${(e as Error).message}. Make sure you pasted valid JSON from the AI.`);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      await bulkImportTasks(preview, currentMember?.id);
      onImported();
    } catch {
      setError('Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">⚡ Bulk Import Tasks via AI</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Step indicator */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {['Copy Prompt', 'Paste AI Output', 'Preview & Import'].map((s, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center', padding: '6px', borderRadius: 6,
                background: (step === 'prompt' && i === 0) || (step === 'paste' && i === 1) || (step === 'preview' && i === 2)
                  ? 'var(--primary-light)' : 'var(--bg)',
                color: (step === 'prompt' && i === 0) || (step === 'paste' && i === 1) || (step === 'preview' && i === 2)
                  ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: 500, fontSize: 13,
              }}>
                {i + 1}. {s}
              </div>
            ))}
          </div>

          {/* ── Step 1: Show prompt ── */}
          {step === 'prompt' && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                Copy the prompt below, paste it into ChatGPT, Claude, or any AI, then add your rubric/project description at the bottom. The AI will return a JSON list of tasks.
              </p>
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border-dark)', borderRadius: 8, padding: 12, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 240, overflowY: 'auto', marginBottom: 12 }}>
                {AI_PROMPT}
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => navigator.clipboard.writeText(AI_PROMPT)}>
                  📋 Copy Prompt
                </button>
              </div>
              <div className="divider" />
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                Expected AI output format (example):
              </p>
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border-dark)', borderRadius: 8, padding: 12, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 180, overflowY: 'auto' }}>
                {SAMPLE_OUTPUT}
              </div>
            </div>
          )}

          {/* ── Step 2: Paste AI output ── */}
          {step === 'paste' && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                Paste the AI's JSON response below. It should be a JSON array starting with <code>[</code>.
              </p>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder='Paste AI JSON output here…'
                style={{ minHeight: 260, fontFamily: 'monospace', fontSize: 12 }}
              />
              {error && <div className="form-error">{error}</div>}
            </div>
          )}

          {/* ── Step 3: Preview ── */}
          {step === 'preview' && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                Review the {preview.length} task{preview.length !== 1 ? 's' : ''} before importing:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                {preview.map((t, i) => (
                  <div key={i} style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                      <strong style={{ fontSize: 13 }}>{t.name}</strong>
                      <span className={`badge badge-${t.priority?.toLowerCase()}`}>{t.priority}</span>
                      {t.isRequired ? <span className="badge badge-required">Required</span> : <span className="badge badge-optional">Optional</span>}
                    </div>
                    {t.description && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.description}</div>}
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      {t.estimatedTime && <span>⏱ {t.estimatedTime}</span>}
                      {t.deadline && <span>📅 {t.deadline}</span>}
                      {t.subtaskNames && t.subtaskNames.length > 0 && <span>📌 {t.subtaskNames.length} subtasks</span>}
                    </div>
                  </div>
                ))}
              </div>
              {error && <div className="form-error mt-2">{error}</div>}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          {step === 'prompt' && (
            <button className="btn btn-primary" onClick={() => setStep('paste')}>
              Next: Paste Output →
            </button>
          )}
          {step === 'paste' && (
            <>
              <button className="btn btn-secondary" onClick={() => setStep('prompt')}>← Back</button>
              <button className="btn btn-primary" disabled={!pasteText.trim()} onClick={handleParse}>
                Parse Tasks →
              </button>
            </>
          )}
          {step === 'preview' && (
            <>
              <button className="btn btn-secondary" onClick={() => setStep('paste')}>← Edit</button>
              <button className="btn btn-primary" disabled={importing} onClick={handleImport}>
                {importing ? 'Importing…' : `Import ${preview.length} Tasks`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
