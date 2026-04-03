import { useEffect, useState, useMemo, type ReactNode } from 'react';
import {
  getLinks,
  createLink,
  updateLink,
  deleteLink,
  reorderQuickLinks,
  getResourceRows,
  createResourceRow,
  updateResourceRow,
  deleteResourceRow,
  reorderResourceRows,
  getLoginItems,
  saveLoginItem,
  deleteLoginItem,
  getTextNotes,
  saveTextNote,
  deleteTextNote,
} from '../api/client';
import type {
  QuickLink,
  ResourceItemRow,
  LoginItem,
  TextNote,
  GroupMember,
  ResourceSection,
  ClassLinkCategory,
} from '../types';

interface Props {
  currentMember: GroupMember | null;
  members: GroupMember[];
}

const CLASS_LABELS: Record<ClassLinkCategory, string> = {
  PM401: '401 Project',
  Hilton413: '413 Hilton',
  Cyber414: '414 Cyber',
  MLR455: '455 Machine',
};

type ManageScope =
  | { kind: 'quick' }
  | { kind: 'resource'; section: 'ProjectResource' | 'Other' }
  | { kind: 'class'; cat: ClassLinkCategory };

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="panel-heading">{children}</h2>;
}

function copyText(text: string) {
  void navigator.clipboard.writeText(text);
}

export default function ResourcesPage({}: Props) {
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [resources, setResources] = useState<ResourceItemRow[]>([]);
  const [logins, setLogins] = useState<LoginItem[]>([]);
  const [notes, setNotes] = useState<TextNote[]>([]);
  const [editingLink, setEditingLink] = useState<QuickLink | null | 'new'>(null);
  type ResourceDraft = Partial<ResourceItemRow> & { section: ResourceSection };
  const [editingResource, setEditingResource] = useState<ResourceDraft | ResourceItemRow | null>(null);
  const [editingLogin, setEditingLogin] = useState<LoginItem | 'new' | null>(null);
  const [editingNote, setEditingNote] = useState<TextNote | 'new' | null>(null);
  const [manageScope, setManageScope] = useState<ManageScope | null>(null);

  const load = () => {
    getLinks().then(setLinks);
    getResourceRows().then(setResources);
    getLoginItems().then(setLogins);
    getTextNotes().then(setNotes);
  };
  useEffect(() => {
    load();
  }, []);

  const bySection = (s: ResourceSection) => resources.filter(r => r.section === s);
  const classLinks = bySection('ClassLink');

  return (
    <div className="page">

      <div className="resources-url-row">
        <UrlResourceCard
          title="Quick links"
          onAdd={() => setEditingLink('new')}
          onManage={() => setManageScope({ kind: 'quick' })}
        >
          {links.length === 0 ? (
            <p className="empty-hint text-sm">No quick links yet.</p>
          ) : (
            <ul className="resource-url-only-list">
              {links.map(l => (
                <li key={l.id} className="resource-url-only-row">
                  {l.url ? (
                    <a href={l.url} target="_blank" rel="noreferrer" className="resource-url-only-link">
                      {l.url}
                    </a>
                  ) : (
                    <span className="resource-url-missing">No URL</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </UrlResourceCard>

        <UrlResourceCard
          title="Project resources"
          onAdd={() => setEditingResource({ section: 'ProjectResource' })}
          onManage={() => setManageScope({ kind: 'resource', section: 'ProjectResource' })}
        >
          {bySection('ProjectResource').length === 0 ? (
            <p className="empty-hint text-sm">No entries.</p>
          ) : (
            <ul className="resource-url-only-list">
              {bySection('ProjectResource').map(r => (
                <li key={r.id} className="resource-url-only-row">
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noreferrer" className="resource-url-only-link">
                      {r.url}
                    </a>
                  ) : (
                    <span className="resource-url-missing">No URL</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </UrlResourceCard>

        <UrlResourceCard
          title="Other"
          onAdd={() => setEditingResource({ section: 'Other' })}
          onManage={() => setManageScope({ kind: 'resource', section: 'Other' })}
        >
          {bySection('Other').length === 0 ? (
            <p className="empty-hint text-sm">No entries.</p>
          ) : (
            <ul className="resource-url-only-list">
              {bySection('Other').map(r => (
                <li key={r.id} className="resource-url-only-row">
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noreferrer" className="resource-url-only-link">
                      {r.url}
                    </a>
                  ) : (
                    <span className="resource-url-missing">No URL</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </UrlResourceCard>
      </div>

      <section className="panel resources-class-section">
        <SectionTitle>Class Resources</SectionTitle>
        <div className="resources-class-columns">
          {(Object.keys(CLASS_LABELS) as ClassLinkCategory[]).map(cat => {
            const items = classLinks.filter(r => r.classCategory === cat);
            return (
              <UrlResourceCard
                key={cat}
                title={CLASS_LABELS[cat]}
                onAdd={() => setEditingResource({ section: 'ClassLink', classCategory: cat, title: '' })}
                onManage={() => setManageScope({ kind: 'class', cat })}
              >
                {items.length === 0 ? (
                  <p className="empty-hint text-sm">None yet.</p>
                ) : (
                  <ul className="resource-url-only-list">
                    {items.map(r => (
                      <li key={r.id} className="resource-url-only-row">
                        {r.url ? (
                          <a href={r.url} target="_blank" rel="noreferrer" className="resource-url-only-link resource-class-title-link">
                            {r.title || r.url}
                          </a>
                        ) : (
                          <span className="resource-url-missing">{r.title || 'No URL'}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </UrlResourceCard>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="flex-between mb-3">
          <SectionTitle>Logins</SectionTitle>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditingLogin('new')}>
            Add login
          </button>
        </div>
        {logins.length === 0 ? (
          <p className="empty-hint">Store shared credentials here. Use copy buttons to paste safely.</p>
        ) : (
          <div className="login-grid">
            {logins.map(l => (
              <div key={l.id} className="login-tile">
                <div className="login-tile-head">{l.label}</div>
                {l.url && (
                  <a href={l.url} target="_blank" rel="noreferrer" className="text-sm">
                    Open site
                  </a>
                )}
                <div className="login-field">
                  <span className="text-muted text-xs">Username</span>
                  <code>{l.username}</code>
                  <button type="button" className="btn btn-secondary btn-xs" onClick={() => copyText(l.username)}>
                    Copy
                  </button>
                </div>
                <div className="login-field">
                  <span className="text-muted text-xs">Password</span>
                  <code>••••••••</code>
                  <button type="button" className="btn btn-secondary btn-xs" onClick={() => copyText(l.password)}>
                    Copy
                  </button>
                </div>
                {l.notes && <p className="text-sm text-muted">{l.notes}</p>}
                <div className="resource-actions mt-2">
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => setEditingLogin(l)}>
                    Edit
                  </button>
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => deleteLoginItem(l.id).then(load)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="flex-between mb-3">
          <SectionTitle>Notes</SectionTitle>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditingNote('new')}>
            Add note
          </button>
        </div>
        {notes.length === 0 ? (
          <p className="empty-hint">Free-form text for the team.</p>
        ) : (
          <div className="notes-stack">
            {notes.map(n => (
              <div key={n.id} className="note-card">
                <div className="flex-between">
                  <strong>{n.title}</strong>
                  <div>
                    <button type="button" className="btn btn-ghost btn-xs" onClick={() => setEditingNote(n)}>
                      Edit
                    </button>
                    <button type="button" className="btn btn-ghost btn-xs" onClick={() => deleteTextNote(n.id).then(load)}>
                      Delete
                    </button>
                  </div>
                </div>
                <pre className="note-body">{n.body}</pre>
                <div className="text-xs text-muted">Updated {new Date(n.updatedAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {manageScope?.kind === 'quick' && (
        <ManageListModal
          title="Manage quick links"
          reorderable
          rows={links.map(l => ({
            id: l.id,
            primary: l.url || '(no URL)',
            onEdit: () => {
              setManageScope(null);
              setEditingLink(l);
            },
            onDelete: () => deleteLink(l.id).then(load),
          }))}
          onReorder={async ids => {
            await reorderQuickLinks(ids);
            await load();
          }}
          onClose={() => setManageScope(null)}
        />
      )}

      {manageScope?.kind === 'resource' && (
        <ManageListModal
          title={manageScope.section === 'ProjectResource' ? 'Manage project resources' : 'Manage other links'}
          reorderable
          rows={bySection(manageScope.section).map(r => ({
            id: r.id,
            primary: r.url || '(no URL)',
            onEdit: () => {
              setManageScope(null);
              setEditingResource(r);
            },
            onDelete: () => deleteResourceRow(r.id).then(load),
          }))}
          onReorder={async ids => {
            await reorderResourceRows(ids);
            await load();
          }}
          onClose={() => setManageScope(null)}
        />
      )}

      {manageScope?.kind === 'class' && (
        <ManageListModal
          title={`Manage ${CLASS_LABELS[manageScope.cat]}`}
          reorderable
          rows={classLinks
            .filter(r => r.classCategory === manageScope.cat)
            .map(r => ({
              id: r.id,
              primary: r.url || r.title || '(no URL)',
              onEdit: () => {
                setManageScope(null);
                setEditingResource(r);
              },
              onDelete: () => deleteResourceRow(r.id).then(load),
            }))}
          onReorder={async ids => {
            await reorderResourceRows(ids);
            await load();
          }}
          onClose={() => setManageScope(null)}
        />
      )}

      {editingLink && (
        <LinkModal
          link={editingLink === 'new' ? null : editingLink}
          onClose={() => setEditingLink(null)}
          onSave={async d => {
            if (editingLink === 'new') await createLink(d);
            else
              await updateLink(editingLink.id, {
                ...d,
                sortOrder: d.sortOrder ?? editingLink.sortOrder,
              });
            setEditingLink(null);
            load();
          }}
        />
      )}

      {editingResource && (
        <ResourceModal
          initial={editingResource}
          onClose={() => setEditingResource(null)}
          onSave={async row => {
            const { id, sortOrder, ...rest } = row;
            if (id != null) {
              await updateResourceRow(id, { ...rest, sortOrder: sortOrder ?? 0 });
            } else {
              await createResourceRow(rest);
            }
            setEditingResource(null);
            load();
          }}
        />
      )}

      {editingLogin && (
        <LoginModal
          item={editingLogin === 'new' ? null : editingLogin}
          onClose={() => setEditingLogin(null)}
          onSave={async d => {
            await saveLoginItem(d);
            setEditingLogin(null);
            load();
          }}
        />
      )}

      {editingNote && (
        <NoteModal
          note={editingNote === 'new' ? null : editingNote}
          onClose={() => setEditingNote(null)}
          onSave={async d => {
            await saveTextNote(d);
            setEditingNote(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function UrlResourceCard({
  title,
  onAdd,
  onManage,
  children,
}: {
  title: string;
  onAdd: () => void;
  onManage: () => void;
  children: ReactNode;
}) {
  return (
    <div className="resource-url-card">
      <div className="resource-url-card-head">
        <h3 className="resource-url-card-title">{title}</h3>
        <span className="resource-url-card-actions">
          <button type="button" className="btn btn-ghost btn-xs" onClick={onAdd}>
            Add
          </button>
          <button type="button" className="btn btn-ghost btn-xs" onClick={onManage}>
            Manage
          </button>
        </span>
      </div>
      <div className="resource-url-card-body">{children}</div>
    </div>
  );
}

function ManageListModal({
  title,
  rows,
  reorderable,
  onReorder,
  onClose,
}: {
  title: string;
  rows: { id: number; primary: string; onEdit: () => void; onDelete: () => Promise<void> }[];
  reorderable?: boolean;
  onReorder?: (orderedIds: number[]) => void | Promise<void>;
  onClose: () => void;
}) {
  const initialOrder = useMemo(() => rows.map(r => r.id), [rows]);
  const [order, setOrder] = useState<number[]>(initialOrder);
  useEffect(() => {
    setOrder(initialOrder);
  }, [initialOrder]);

  const orderedRows = useMemo(
    () => order.map(id => rows.find(r => r.id === id)).filter(Boolean) as typeof rows,
    [order, rows],
  );

  const move = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= order.length) return;
    setOrder(o => {
      const copy = [...o];
      const t = copy[index];
      copy[index] = copy[next];
      copy[next] = t;
      return copy;
    });
  };

  const handleDone = async () => {
    if (reorderable && onReorder && order.length) await onReorder(order);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          {reorderable ? (
            <p className="text-muted text-sm mb-3">Use the arrows to change order, then choose Done to save.</p>
          ) : null}
          {rows.length === 0 ? (
            <p className="empty-hint">Nothing to manage.</p>
          ) : (
            <ul className="manage-links-list">
              {orderedRows.map((r, index) => (
                <li key={r.id} className="manage-links-row">
                  {reorderable ? (
                    <span className="manage-links-reorder">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                        aria-label="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        disabled={index === orderedRows.length - 1}
                        onClick={() => move(index, 1)}
                        aria-label="Move down"
                      >
                        ↓
                      </button>
                    </span>
                  ) : null}
                  <span className="manage-links-primary">{r.primary}</span>
                  <div className="manage-links-actions">
                    <button type="button" className="btn btn-ghost btn-xs" onClick={r.onEdit}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-danger"
                      onClick={() => void r.onDelete()}
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
          <button type="button" className="btn btn-primary" onClick={() => void handleDone()}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function LinkModal({
  link,
  onClose,
  onSave,
}: {
  link: QuickLink | null;
  onClose: () => void;
  onSave: (
    d: Omit<QuickLink, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder'> & { sortOrder?: number },
  ) => void | Promise<void>;
}) {
  const [title, setTitle] = useState(link?.title ?? '');
  const [url, setUrl] = useState(link?.url ?? '');
  const [category, setCategory] = useState(link?.category ?? '');
  const [notes, setNotes] = useState(link?.notes ?? '');
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{link ? 'Edit link' : 'New quick link'}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <label>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="form-row">
            <label>URL</label>
            <input value={url} onChange={e => setUrl(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Category</label>
            <input value={category} onChange={e => setCategory(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!url.trim()}
            onClick={() => {
              const base = {
                title: title.trim() || url.trim(),
                url: url.trim(),
                category: category || undefined,
                notes: notes || undefined,
              };
              onSave(link ? { ...base, sortOrder: link.sortOrder } : base);
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function ResourceModal({
  initial,
  onClose,
  onSave,
}: {
  initial: Partial<ResourceItemRow> & { section: ResourceSection };
  onClose: () => void;
  onSave: (
    row: Omit<ResourceItemRow, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder'> & {
      id?: number;
      sortOrder?: number;
    },
  ) => void | Promise<void>;
}) {
  const isNew = initial.id == null;
  const lockSection = isNew;
  const [title, setTitle] = useState(initial.title ?? '');
  const [description, setDescription] = useState(initial.description ?? '');
  const [url, setUrl] = useState(initial.url ?? '');
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [section, setSection] = useState<ResourceSection>(initial.section);
  const [classCategory, setClassCategory] = useState<ClassLinkCategory | ''>(initial.classCategory ?? 'PM401');

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">{isNew ? 'New resource' : 'Edit resource'}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          {!lockSection && (
            <div className="form-row">
              <label>Section</label>
              <select value={section} onChange={e => setSection(e.target.value as ResourceSection)}>
                <option value="ProjectResource">Project resource</option>
                <option value="Other">Other</option>
                <option value="ClassLink">Class Resources</option>
              </select>
            </div>
          )}
          {section === 'ClassLink' && (
            <div className="form-row">
              <label>Class</label>
              <select value={classCategory} onChange={e => setClassCategory(e.target.value as ClassLinkCategory)}>
                {(Object.keys(CLASS_LABELS) as ClassLinkCategory[]).map(c => (
                  <option key={c} value={c}>
                    {CLASS_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="form-row">
            <label>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="form-row">
            <label>URL</label>
            <input value={url} onChange={e => setUrl(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!title.trim()}
            onClick={() => {
              const base = {
                title,
                description: description || undefined,
                url: url || undefined,
                notes: notes || undefined,
                section,
                classCategory: section === 'ClassLink' ? (classCategory as ClassLinkCategory) : undefined,
              };
              onSave(
                typeof initial.id === 'number'
                  ? { ...base, id: initial.id, sortOrder: (initial as ResourceItemRow).sortOrder }
                  : { ...base },
              );
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function LoginModal({
  item,
  onClose,
  onSave,
}: {
  item: LoginItem | null;
  onClose: () => void;
  onSave: (d: Omit<LoginItem, 'id'> & { id?: number }) => void | Promise<void>;
}) {
  const [label, setLabel] = useState(item?.label ?? '');
  const [username, setUsername] = useState(item?.username ?? '');
  const [password, setPassword] = useState(item?.password ?? '');
  const [url, setUrl] = useState(item?.url ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [sortOrder, setSortOrder] = useState(item?.sortOrder ?? 0);
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{item ? 'Edit login' : 'New login'}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <label>Label</label>
            <input value={label} onChange={e => setLabel(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Username</label>
            <input value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div className="form-row">
            <label>URL</label>
            <input value={url} onChange={e => setUrl(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Sort order</label>
            <input type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!label.trim()}
            onClick={() => onSave({ id: item?.id, label, username, password, url: url || undefined, notes: notes || undefined, sortOrder })}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function NoteModal({
  note,
  onClose,
  onSave,
}: {
  note: TextNote | null;
  onClose: () => void;
  onSave: (d: { id?: number; title: string; body: string }) => void | Promise<void>;
}) {
  const [title, setTitle] = useState(note?.title ?? 'Note');
  const [body, setBody] = useState(note?.body ?? '');
  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">{note ? 'Edit note' : 'New note'}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <label>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Body</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={10} style={{ fontFamily: 'inherit' }} />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onSave({ id: note?.id, title, body })}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
