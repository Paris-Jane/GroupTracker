import { useCallback, useEffect, useState } from 'react';
import {
  getRubricRequirements,
  createRubricRequirement,
  updateRubricRequirement,
  deleteRubricRequirement,
  setRubricRequirementCompleted,
} from '../api/client';
import { supabase } from '../lib/supabase';
import type { GroupMember, RubricRequirement, RubricSection } from '../types';
import { RUBRIC_SECTIONS } from '../types';
import RubricBulkImportModal from '../components/rubric/RubricBulkImportModal';

interface Props {
  currentMember: GroupMember | null;
  members: GroupMember[];
}

const SECTION_HEADINGS: Record<RubricSection, string> = {
  '401': '401',
  '413': '413',
  '414': '414',
  '455': '455',
  presentation: 'Presentation',
};

function RequirementEditModal({
  initial,
  defaultSection,
  onClose,
  onSave,
}: {
  initial: RubricRequirement | null;
  defaultSection: RubricSection;
  onClose: () => void;
  onSave: (d: { section: RubricSection; body: string }) => void | Promise<void>;
}) {
  const [section, setSection] = useState<RubricSection>(initial?.section ?? defaultSection);
  const [body, setBody] = useState(initial?.body ?? '');
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{initial ? 'Edit requirement' : 'Add requirement'}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <label htmlFor="rubric-section">Section</label>
            <select
              id="rubric-section"
              value={section}
              onChange={e => setSection(e.target.value as RubricSection)}
            >
              {RUBRIC_SECTIONS.map(s => (
                <option key={s} value={s}>
                  {SECTION_HEADINGS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="rubric-body">Requirement</label>
            <textarea
              id="rubric-body"
              rows={5}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="What the team must satisfy for the rubric"
            />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!body.trim()}
            onClick={() => void onSave({ section, body: body.trim() })}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RubricPage({ currentMember }: Props) {
  const [items, setItems] = useState<RubricRequirement[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<{ initial: RubricRequirement | null; defaultSection: RubricSection } | null>(
    null,
  );

  const load = useCallback(() => {
    setLoadError(null);
    getRubricRequirements()
      .then(setItems)
      .catch(e => setLoadError((e as Error).message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel('rubric_requirements_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rubric_requirements' },
        () => {
          getRubricRequirements()
            .then(setItems)
            .catch(() => {});
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const bySection = (s: RubricSection) => items.filter(r => r.section === s);

  const handleToggle = (r: RubricRequirement, done: boolean) => {
    setLoadError(null);
    setItems(prev => prev.map(x => (x.id === r.id ? { ...x, isCompleted: done } : x)));
    void setRubricRequirementCompleted(r.id, done).catch(() => {
      setItems(prev => prev.map(x => (x.id === r.id ? { ...x, isCompleted: !done } : x)));
      setLoadError('Could not save checkbox. Try again.');
    });
  };

  const handleSaveEdit = async (d: { section: RubricSection; body: string }) => {
    if (!editDraft) return;
    try {
      if (editDraft.initial) {
        const updated = await updateRubricRequirement(editDraft.initial.id, d);
        setItems(prev => prev.map(x => (x.id === updated.id ? updated : x)));
      } else {
        const created = await createRubricRequirement(d);
        setItems(prev => [...prev, created].sort(sortRubricRows));
      }
      setEditDraft(null);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  };

  const handleDelete = async (r: RubricRequirement) => {
    if (!window.confirm('Delete this requirement for everyone?')) return;
    try {
      await deleteRubricRequirement(r.id);
      setItems(prev => prev.filter(x => x.id !== r.id));
    } catch (e) {
      setLoadError((e as Error).message);
    }
  };

  return (
    <div className="page">
      <div className="page-title-block page-title-block--split">
        <div>
          <h1 className="page-title">Rubric</h1>
          <p className="page-subtitle">
            Checklist by course area. Checked items are shared for the whole team (everyone sees the same progress).
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setBulkOpen(true)}>
            Bulk add (AI)
          </button>
        </div>
      </div>

      {loadError ? <p className="form-error mb-3">{loadError}</p> : null}

      <div className="rubric-columns">
        {RUBRIC_SECTIONS.map(section => (
          <section key={section} className="rubric-column card">
            <div className="rubric-column-head">
              <h2 className="panel-heading rubric-column-title">{SECTION_HEADINGS[section]}</h2>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => setEditDraft({ initial: null, defaultSection: section })}
              >
                + Add
              </button>
            </div>
            <ul className="rubric-item-list">
              {bySection(section).length === 0 ? (
                <li className="empty-hint text-sm">No items yet.</li>
              ) : (
                bySection(section).map(r => (
                  <li key={r.id} className="rubric-item-row">
                    <div className="rubric-item-main">
                      <input
                        id={`rubric-check-${r.id}`}
                        type="checkbox"
                        className="rubric-item-checkbox"
                        checked={r.isCompleted}
                        onChange={e => handleToggle(r, e.target.checked)}
                      />
                      <label
                        htmlFor={`rubric-check-${r.id}`}
                        className={`rubric-item-text${r.isCompleted ? ' rubric-item-text--done' : ''}`}
                      >
                        {r.body}
                      </label>
                    </div>
                    <div className="rubric-item-actions">
                      <button type="button" className="btn btn-ghost btn-xs" onClick={() => setEditDraft({ initial: r, defaultSection: section })}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-danger"
                        onClick={() => void handleDelete(r)}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>
        ))}
      </div>

      {bulkOpen && currentMember ? (
        <RubricBulkImportModal currentMember={currentMember} onClose={() => setBulkOpen(false)} onImported={load} />
      ) : null}

      {editDraft ? (
        <RequirementEditModal
          initial={editDraft.initial}
          defaultSection={editDraft.defaultSection}
          onClose={() => setEditDraft(null)}
          onSave={handleSaveEdit}
        />
      ) : null}
    </div>
  );
}

function sortRubricRows(a: RubricRequirement, b: RubricRequirement): number {
  if (a.section !== b.section) return a.section.localeCompare(b.section);
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.id - b.id;
}
