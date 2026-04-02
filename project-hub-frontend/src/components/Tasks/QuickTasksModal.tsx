import { useState } from 'react';
import { createTask } from '../../api/client';
interface Props {
  currentMemberId: number | null;
  onClose: () => void;
  onCreated: () => void;
}

export default function QuickTasksModal({ currentMemberId, onClose, onCreated }: Props) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    const lines = text
      .split('\n')
      .map(l => l.replace(/^\s*[-*•]\s*/, '').trim())
      .filter(Boolean);
    if (lines.length === 0) {
      setErr('Add at least one task (one per line).');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      for (const name of lines) {
        await createTask(
          {
            name,
            priority: 'Medium',
            isRequired: true,
            status: 'NotStarted',
            category: 'SprintBacklog',
            assigneeIds: currentMemberId ? [currentMemberId] : [],
            subtaskNames: [],
          },
          currentMemberId ?? undefined,
        );
      }
      onCreated();
      onClose();
    } catch {
      setErr('Could not save all tasks. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">Quick tasks</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <p className="text-muted text-sm mb-2">
            One task per line. Press <kbd className="quick-tasks-kbd">Enter</kbd> for a new line. Optional: start a line with{' '}
            <code>- </code> for a bullet.
          </p>
          {err ? <p className="form-error mb-2">{err}</p> : null}
          <textarea
            className="quick-tasks-textarea"
            rows={12}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={'Task one\nTask two\nTask three'}
            autoFocus
          />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save all tasks'}
          </button>
        </div>
      </div>
    </div>
  );
}
