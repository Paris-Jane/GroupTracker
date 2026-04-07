import { useCallback, useEffect, useState } from 'react';
import {
  getRubricRequirements,
  createRubricRequirement,
  updateRubricRequirement,
  deleteRubricRequirement,
  setRubricRequirementProgressStatus,
} from '../api/client';
import { supabase } from '../lib/supabase';
import TaskStatusDot from '../components/common/TaskStatusDot';
import type { GroupMember, RubricRequirement, RubricSection, TaskStatus } from '../types';
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

function nextRubricProgressStatus(s: TaskStatus): TaskStatus {
  if (s === 'NotStarted') return 'InProgress';
  if (s === 'InProgress') return 'Completed';
  return 'NotStarted';
}

function rubricSectionProgressStats(rows: RubricRequirement[]) {
  const total = rows.length;
  const completed = rows.filter(r => r.progressStatus === 'Completed').length;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  return { total, completed, pct };
}

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

function RubricSectionManageModal({
  sectionTitle,
  items,
  onClose,
  onEdit,
  onDelete,
}: {
  sectionTitle: string;
  items: RubricRequirement[];
  onClose: () => void;
  onEdit: (r: RubricRequirement) => void;
  onDelete: (r: RubricRequirement) => void | Promise<void>;
}) {
  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">Manage — {sectionTitle}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          {items.length === 0 ? (
            <p className="empty-hint">No requirements in this section yet.</p>
          ) : (
            <ul className="manage-links-list">
              {items.map(r => (
                <li key={r.id} className="manage-links-row">
                  <span className="manage-links-primary">{r.body}</span>
                  <div className="manage-links-actions">
                    <button type="button" className="btn btn-ghost btn-xs" onClick={() => onEdit(r)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-danger"
                      onClick={() => void onDelete(r)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
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
  const [manageSection, setManageSection] = useState<RubricSection | null>(null);
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

  const handleCycleProgress = (r: RubricRequirement) => {
    const prev = r.progressStatus;
    const next = nextRubricProgressStatus(prev);
    setLoadError(null);
    setItems(prevItems => prevItems.map(x => (x.id === r.id ? { ...x, progressStatus: next } : x)));
    void setRubricRequirementProgressStatus(r.id, next).catch(() => {
      setItems(prevItems => prevItems.map(x => (x.id === r.id ? { ...x, progressStatus: prev } : x)));
      setLoadError('Could not save progress. Try again.');
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
            Same flow as home tasks: click the dot once for in progress, twice for done, three times to reset. Progress
            is shared for the whole team.
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
        {RUBRIC_SECTIONS.map(section => {
          const sectionRows = bySection(section);
          const sp = rubricSectionProgressStats(sectionRows);
          return (
            <section key={section} className="rubric-column card">
              <div className="rubric-column-head">
                <h2 className="panel-heading rubric-column-title">{SECTION_HEADINGS[section]}</h2>
                <span className="rubric-column-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => setEditDraft({ initial: null, defaultSection: section })}
                  >
                    + Add
                  </button>
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => setManageSection(section)}>
                    Manage
                  </button>
                </span>
              </div>
              {sp.total > 0 ? (
                <div className="rubric-column-progress">
                  <div className="home-progress-bar">
                    <div
                      className={`home-progress-fill${sp.pct === 100 ? ' home-progress-fill--complete' : ''}`}
                      style={{ width: `${sp.pct}%` }}
                    />
                  </div>
                  <div className="rubric-column-progress-label">
                    {sp.completed} of {sp.total} done ({sp.pct}%)
                  </div>
                </div>
              ) : null}
              <ul className="rubric-item-list">
                {sectionRows.length === 0 ? (
                  <li className="empty-hint text-sm">No items yet.</li>
                ) : (
                  sectionRows.map(r => (
                    <li
                      key={r.id}
                      className={`rubric-item-row${r.progressStatus === 'Completed' ? ' rubric-item-row--done' : ''}`}
                    >
                      <div className="rubric-item-main">
                        <TaskStatusDot status={r.progressStatus} onClick={() => handleCycleProgress(r)} />
                        <span
                          className={`rubric-item-text${
                            r.progressStatus === 'Completed'
                              ? ' rubric-item-text--done'
                              : r.progressStatus === 'InProgress'
                                ? ' rubric-item-text--progress'
                                : ''
                          }`}
                        >
                          {r.body}
                        </span>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </section>
          );
        })}
      </div>

      {bulkOpen && currentMember ? (
        <RubricBulkImportModal currentMember={currentMember} onClose={() => setBulkOpen(false)} onImported={load} />
      ) : null}

      {manageSection != null ? (
        <RubricSectionManageModal
          sectionTitle={SECTION_HEADINGS[manageSection]}
          items={bySection(manageSection)}
          onClose={() => setManageSection(null)}
          onEdit={r => {
            setManageSection(null);
            setEditDraft({ initial: r, defaultSection: r.section });
          }}
          onDelete={handleDelete}
        />
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
