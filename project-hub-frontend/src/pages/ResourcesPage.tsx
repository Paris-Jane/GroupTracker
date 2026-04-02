import { useEffect, useState } from 'react';
import {
  getLinks,
  createLink,
  updateLink,
  deleteLink,
  getResourceRows,
  createResourceRow,
  updateResourceRow,
  deleteResourceRow,
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
  PM401: '401 PM',
  Hilton413: '413 Hilton',
  Cyber414: '414 Cyber',
  MLR455: '455 MLR',
};

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
      <header className="page-title-block">
        <h1 className="page-title">Resources</h1>
        <p className="page-subtitle">Links, logins, and notes</p>
      </header>

      <section className="panel">
        <div className="flex-between mb-3">
          <SectionTitle>Quick links</SectionTitle>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditingLink('new')}>
            Add link
          </button>
        </div>
        {links.length === 0 ? (
          <p className="empty-hint">No quick links yet.</p>
        ) : (
          <ul className="resource-link-list">
            {links.map(l => (
              <li key={l.id} className="resource-link-row">
                <a href={l.url} target="_blank" rel="noreferrer" className="resource-link-title">
                  {l.title}
                </a>
                <span className="text-muted text-sm">{l.category}</span>
                <div className="resource-actions">
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => setEditingLink(l)}>
                    Edit
                  </button>
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => deleteLink(l.id).then(load)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ResourceBlock
        title="Project resources"
        items={bySection('ProjectResource')}
        onAdd={() => setEditingResource({ section: 'ProjectResource' })}
        onEdit={r => setEditingResource(r)}
        onDelete={id => deleteResourceRow(id).then(load)}
      />

      <ResourceBlock
        title="Other"
        items={bySection('Other')}
        onAdd={() => setEditingResource({ section: 'Other' })}
        onEdit={r => setEditingResource(r)}
        onDelete={id => deleteResourceRow(id).then(load)}
      />

      <section className="panel">
        <div className="flex-between mb-3">
          <SectionTitle>Class links</SectionTitle>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setEditingResource({ section: 'ClassLink', classCategory: 'PM401', title: '' })}
          >
            Add class link
          </button>
        </div>
        {(Object.keys(CLASS_LABELS) as ClassLinkCategory[]).map(cat => {
          const items = classLinks.filter(r => r.classCategory === cat);
          return (
            <div key={cat} className="mb-4">
              <h3 className="subsection-title">{CLASS_LABELS[cat]}</h3>
              {items.length === 0 ? (
                <p className="empty-hint text-sm">None yet.</p>
              ) : (
                <ul className="resource-link-list">
                  {items.map(r => (
                    <li key={r.id} className="resource-link-row">
                      {r.url ? (
                        <a href={r.url} target="_blank" rel="noreferrer" className="resource-link-title">
                          {r.title}
                        </a>
                      ) : (
                        <span className="resource-link-title">{r.title}</span>
                      )}
                      <div className="resource-actions">
                        <button type="button" className="btn btn-ghost btn-xs" onClick={() => setEditingResource(r)}>
                          Edit
                        </button>
                        <button type="button" className="btn btn-ghost btn-xs" onClick={() => deleteResourceRow(r.id).then(load)}>
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
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

      {editingLink && (
        <LinkModal
          link={editingLink === 'new' ? null : editingLink}
          onClose={() => setEditingLink(null)}
          onSave={async d => {
            if (editingLink === 'new') await createLink(d);
            else await updateLink(editingLink.id, d);
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
            const { id, ...rest } = row;
            if (id != null) {
              await updateResourceRow(id, rest);
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

function ResourceBlock({
  title,
  items,
  onAdd,
  onEdit,
  onDelete,
}: {
  title: string;
  items: ResourceItemRow[];
  onAdd: () => void;
  onEdit: (r: ResourceItemRow) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <section className="panel">
      <div className="flex-between mb-3">
        <SectionTitle>{title}</SectionTitle>
        <button type="button" className="btn btn-primary btn-sm" onClick={onAdd}>
          Add
        </button>
      </div>
      {items.length === 0 ? (
        <p className="empty-hint">No entries.</p>
      ) : (
        <ul className="resource-link-list">
          {items.map(r => (
            <li key={r.id} className="resource-link-row">
              {r.url ? (
                <a href={r.url} target="_blank" rel="noreferrer" className="resource-link-title">
                  {r.title}
                </a>
              ) : (
                <span className="resource-link-title">{r.title}</span>
              )}
              {r.description && <span className="text-sm text-muted">{r.description}</span>}
              <div className="resource-actions">
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => onEdit(r)}>
                  Edit
                </button>
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => onDelete(r.id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LinkModal({
  link,
  onClose,
  onSave,
}: {
  link: QuickLink | null;
  onClose: () => void;
  onSave: (d: Omit<QuickLink, 'id' | 'createdAt' | 'updatedAt'>) => void | Promise<void>;
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
          <button type="button" className="btn btn-primary" disabled={!title.trim() || !url.trim()} onClick={() => onSave({ title, url, category: category || undefined, notes: notes || undefined })}>
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
  onSave: (row: Omit<ResourceItemRow, 'id' | 'createdAt' | 'updatedAt'> & { id?: number }) => void | Promise<void>;
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
            onClick={() =>
              onSave({
                ...(typeof initial.id === 'number' ? { id: initial.id } : {}),
                title,
                description: description || undefined,
                url: url || undefined,
                notes: notes || undefined,
                section,
                classCategory: section === 'ClassLink' ? (classCategory as ClassLinkCategory) : undefined,
              })
            }
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
