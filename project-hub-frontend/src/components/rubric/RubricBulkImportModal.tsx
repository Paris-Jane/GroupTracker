import { useMemo, useState, type CSSProperties } from 'react';
import { bulkImportRubricRequirements } from '../../api/client';
import type { GroupMember, RubricSection, BulkImportRubricItemDto } from '../../types';
import { RUBRIC_SECTIONS } from '../../types';

interface Props {
  currentMember: GroupMember | null;
  onClose: () => void;
  onImported: () => void;
}

export function buildRubricAiPrompt(): string {
  const example = `{
  "items": [
    { "section": "401", "text": "Clear problem statement and stakeholders" },
    { "section": "413", "text": "Security analysis addresses STRIDE" },
    { "section": "414", "text": "Threat model is updated each sprint" },
    { "section": "455", "text": "Model metrics and validation reported" },
    { "section": "presentation", "text": "Demo fits time limit" }
  ]
}`;

  return `You are helping a student software team build a checklist from a course rubric.

## Inputs
The user attaches rubric PDFs, syllabi, or project specs in the chat. Use those as the only source of truth.

## Output
Return **only** valid JSON (no markdown fences, no commentary).

Root object:
- **items**: array of objects. Each object must have:
  - **section**: exactly one of: "401", "413", "414", "455", "presentation"
  - **text**: one checklist line (what the team must satisfy)

Map rubric criteria to the section they belong to (course number or final presentation). Split long bullets into separate items when they are independent requirements.

## Example shape (replace with real content from attachments)

${example}
`;
}

const SECTION_ALIASES: Record<string, RubricSection> = {
  pm401: '401',
  project401: '401',
  hilton: '413',
  hilton413: '413',
  cyber: '414',
  cyber414: '414',
  mlr: '455',
  mlr455: '455',
  present: 'presentation',
  pres: 'presentation',
};

function normalizeRubricSection(raw: unknown): RubricSection {
  const key = String(raw ?? '').trim().toLowerCase();
  if (RUBRIC_SECTIONS.includes(key as RubricSection)) return key as RubricSection;
  const compact = key.replace(/\s+/g, '');
  if (SECTION_ALIASES[compact]) return SECTION_ALIASES[compact];
  if (SECTION_ALIASES[key]) return SECTION_ALIASES[key];
  throw new Error(`Unknown section "${String(raw)}". Use 401, 413, 414, 455, or presentation.`);
}

function normalizeRubricItem(raw: unknown, index: number): BulkImportRubricItemDto {
  if (!raw || typeof raw !== 'object') throw new Error(`Item ${index + 1}: expected an object.`);
  const o = raw as Record<string, unknown>;
  const section = normalizeRubricSection(o.section);
  const text =
    o.text != null && String(o.text).trim()
      ? String(o.text).trim()
      : o.body != null && String(o.body).trim()
        ? String(o.body).trim()
        : '';
  if (!text) throw new Error(`Item ${index + 1}: missing "text" or "body".`);
  return { section, text, body: text };
}

const STEPS: { step: 'prompt' | 'paste' | 'preview'; label: string }[] = [
  { step: 'prompt', label: 'Prompt' },
  { step: 'paste', label: 'Paste AI output' },
  { step: 'preview', label: 'Preview & import' },
];

const pasteTextareaStyle: CSSProperties = { minHeight: 280, fontFamily: 'monospace', fontSize: 12, width: '100%' };

export default function RubricBulkImportModal({ currentMember, onClose, onImported }: Props) {
  const [step, setStep] = useState<'prompt' | 'paste' | 'preview'>('prompt');
  const [pasteText, setPasteText] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);
  const [preview, setPreview] = useState<BulkImportRubricItemDto[]>([]);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);

  const fullPrompt = useMemo(() => buildRubricAiPrompt(), []);

  const goToStep = (s: 'prompt' | 'paste' | 'preview') => {
    setError('');
    setStep(s);
  };

  const handleParse = () => {
    setError('');
    try {
      const trimmed = pasteText.trim();
      const json = JSON.parse(trimmed) as unknown;
      let arr: unknown[];
      if (Array.isArray(json)) arr = json;
      else if (json && typeof json === 'object' && Array.isArray((json as { items?: unknown }).items)) {
        arr = (json as { items: unknown[] }).items;
      } else {
        throw new Error('Expected JSON array or { "items": [...] }.');
      }
      const items = arr.map((row, i) => normalizeRubricItem(row, i));
      setPreview(items);
      goToStep('preview');
    } catch (e) {
      setError((e as Error).message || 'Invalid JSON.');
    }
  };

  const handleImport = async () => {
    if (!currentMember) return;
    setImporting(true);
    setError('');
    try {
      await bulkImportRubricRequirements(preview.map(p => ({ section: p.section, body: p.text ?? p.body ?? '' })));
      onImported();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">Bulk add rubric (AI)</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div className="bulk-import-steps" role="tablist" aria-label="Import steps">
            {STEPS.map(({ step: tabStep, label }, i) => {
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
              <p className="text-sm text-muted mb-3">
                Copy the prompt, paste it into your AI tool, and <strong>attach</strong> your rubric or syllabus. When
                the model returns JSON, go to <strong>Paste AI output</strong>.
              </p>
              <div className="flex gap-2 flex-wrap mb-3">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(fullPrompt);
                    setPromptCopied(true);
                    window.setTimeout(() => setPromptCopied(false), 2000);
                  }}
                >
                  {promptCopied ? 'Copied!' : 'Copy prompt'}
                </button>
              </div>
              <p className="text-xs text-muted mb-2">Prompt text:</p>
              <pre className="bulk-import-prompt-pre">{fullPrompt}</pre>
            </div>
          )}

          {step === 'paste' && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                Paste JSON: a plain array of objects, or <code>{'{ "items": [...] }'}</code>. Each object needs{' '}
                <code>section</code> (401, 413, 414, 455, or presentation) and <code>text</code> (or <code>body</code>).
              </p>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder='{ "items": [ { "section": "401", "text": "..." } ] }'
                style={pasteTextareaStyle}
              />
              {error ? <div className="form-error mt-2">{error}</div> : null}
            </div>
          )}

          {step === 'preview' && (
            <div>
              <p className="text-sm text-muted mb-3">
                {preview.length} requirement{preview.length === 1 ? '' : 's'} will be added.
              </p>
              <ul className="rubric-bulk-preview-list">
                {preview.map((p, i) => (
                  <li key={i} className="rubric-bulk-preview-item">
                    <span className="rubric-bulk-preview-section">{p.section}</span>
                    <span className="rubric-bulk-preview-text">{p.text ?? p.body}</span>
                  </li>
                ))}
              </ul>
              {error ? <div className="form-error mt-2">{error}</div> : null}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {step === 'prompt' && (
            <button type="button" className="btn btn-primary" onClick={() => goToStep('paste')}>
              Next: paste AI output
            </button>
          )}
          {step === 'paste' && (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => goToStep('prompt')}>
                Back
              </button>
              <button type="button" className="btn btn-primary" disabled={!pasteText.trim()} onClick={handleParse}>
                Parse &amp; preview
              </button>
            </>
          )}
          {step === 'preview' && (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => goToStep('paste')}>
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={importing || preview.length === 0}
                onClick={() => void handleImport()}
              >
                {importing ? 'Importing…' : `Import ${preview.length} requirements`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
