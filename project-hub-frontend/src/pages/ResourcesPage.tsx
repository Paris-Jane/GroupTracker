import { useEffect, useState } from 'react';
import {
  getLinks, createLink, updateLink, deleteLink,
  getResources, createResource, updateResource, deleteResource,
  getReservations, createReservation, updateReservation, deleteReservation,
} from '../api/client';
import type { QuickLink, ResourceItem, RoomReservation, GroupMember, ResourceType } from '../types';
import ConfirmDialog from '../components/common/ConfirmDialog';

interface Props {
  currentMember: GroupMember | null;
  members: GroupMember[];
}

// ── Quick Links ──────────────────────────────────────────────────────────────

function QuickLinksSection({ currentMember }: { currentMember: GroupMember | null }) {
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [editing, setEditing] = useState<QuickLink | null | 'new'>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = () => getLinks().then(setLinks);
  useEffect(() => { load(); }, []);

  // Group by category
  const grouped = links.reduce<Record<string, QuickLink[]>>((acc, l) => {
    const cat = l.category ?? 'Uncategorized';
    (acc[cat] ??= []).push(l);
    return acc;
  }, {});

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header">
        <span className="card-title">🔗 Quick Links</span>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>+ Add Link</button>
      </div>

      {links.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px' }}>
          <div className="empty-icon">🔗</div>
          <div className="empty-title">No links yet</div>
          <div>Add shared docs, research links, GitHub repos…</div>
        </div>
      ) : (
        Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{cat}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {items.map(l => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg)', borderRadius: 6 }}>
                  <span style={{ fontSize: 14 }}>🔗</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 500, fontSize: 13 }}>{l.title}</a>
                    {l.notes && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.notes}</div>}
                  </div>
                  <button className="btn btn-ghost btn-xs" onClick={() => setEditing(l)}>Edit</button>
                  <button className="btn btn-ghost btn-xs" style={{ color: 'var(--danger)' }} onClick={() => setDeletingId(l.id)}>Del</button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {editing && (
        <LinkForm
          link={editing === 'new' ? undefined : editing}
          onSave={async data => {
            if (editing === 'new') await createLink(data);
            else await updateLink(editing.id, data);
            setEditing(null); load();
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {deletingId !== null && (
        <ConfirmDialog
          message="Delete this link?"
          onConfirm={async () => { await deleteLink(deletingId); setDeletingId(null); load(); }}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  );
}

function LinkForm({ link, onSave, onClose }: {
  link?: QuickLink;
  onSave: (data: { title: string; url: string; category?: string; notes?: string }) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(link?.title ?? '');
  const [url, setUrl] = useState(link?.url ?? '');
  const [category, setCategory] = useState(link?.category ?? '');
  const [notes, setNotes] = useState(link?.notes ?? '');
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{link ? 'Edit Link' : 'Add Link'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row"><label>Title *</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Google Drive Folder" /></div>
          <div className="form-row"><label>URL *</label><input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" /></div>
          <div className="form-row"><label>Category</label><input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Project Files, Research" /></div>
          <div className="form-row"><label>Notes</label><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional description" /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!title.trim() || !url.trim()} onClick={() => onSave({ title, url, category: category || undefined, notes: notes || undefined })}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Resource Items ───────────────────────────────────────────────────────────

function ResourcesSection() {
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [editing, setEditing] = useState<ResourceItem | null | 'new'>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<ResourceType | ''>('');

  const load = () => getResources().then(setItems);
  useEffect(() => { load(); }, []);

  const visible = typeFilter ? items.filter(i => i.type === typeFilter) : items;

  const typeLabel = (t: string) => t === 'TeacherProvided' ? 'Teacher Provided' : 'Other';

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header">
        <span className="card-title">📚 Resources</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as ResourceType | '')} style={{ width: 'auto', fontSize: 13 }}>
            <option value="">All Types</option>
            <option value="TeacherProvided">Teacher Provided</option>
            <option value="Other">Other</option>
          </select>
          <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>+ Add Resource</button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px' }}>
          <div className="empty-icon">📚</div>
          <div className="empty-title">No resources yet</div>
          <div>Add teacher materials, references, guides…</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {visible.map(r => (
            <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '12px', background: 'var(--surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{r.title}</span>
                <span className={`badge ${r.type === 'TeacherProvided' ? 'badge-required' : 'badge-optional'}`} style={{ fontSize: 11 }}>
                  {typeLabel(r.type)}
                </span>
              </div>
              {r.category && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{r.category}</div>}
              {r.description && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>{r.description}</div>}
              {r.notes && <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 6 }}>{r.notes}</div>}
              {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>View →</a>}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button className="btn btn-secondary btn-xs" onClick={() => setEditing(r)}>Edit</button>
                <button className="btn btn-danger btn-xs" onClick={() => setDeletingId(r.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ResourceForm
          item={editing === 'new' ? undefined : editing}
          onSave={async data => {
            if (editing === 'new') await createResource(data);
            else await updateResource(editing.id, data);
            setEditing(null); load();
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {deletingId !== null && (
        <ConfirmDialog
          message="Delete this resource?"
          onConfirm={async () => { await deleteResource(deletingId); setDeletingId(null); load(); }}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  );
}

function ResourceForm({ item, onSave, onClose }: {
  item?: ResourceItem;
  onSave: (data: Omit<ResourceItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [type, setType] = useState<ResourceType>(item?.type ?? 'Other');
  const [category, setCategory] = useState(item?.category ?? '');
  const [url, setUrl] = useState(item?.url ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{item ? 'Edit Resource' : 'Add Resource'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row"><label>Title *</label><input value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div className="form-grid mb-3">
            <div><label>Type</label>
              <select value={type} onChange={e => setType(e.target.value as ResourceType)}>
                <option value="TeacherProvided">Teacher Provided</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div><label>Category</label><input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Grading, Templates" /></div>
          </div>
          <div className="form-row"><label>Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} /></div>
          <div className="form-row"><label>URL</label><input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" /></div>
          <div className="form-row"><label>Notes</label><input value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!title.trim()} onClick={() => onSave({ title, description, type, category: category || undefined, url: url || undefined, notes: notes || undefined })}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Room Reservations ────────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function ReservationsSection({ members, currentMember }: { members: GroupMember[]; currentMember: GroupMember | null }) {
  const [reservations, setReservations] = useState<RoomReservation[]>([]);
  const [editing, setEditing] = useState<RoomReservation | null | 'new'>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  const load = () => getReservations().then(setReservations);
  useEffect(() => { load(); }, []);

  // Week navigation
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + weekOffset * 7);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const resByDay = (day: Date) => {
    const ds = day.toISOString().split('T')[0];
    return reservations.filter(r => r.date.startsWith(ds));
  };

  return (
    <div className="card">
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="card-title">📅 Room Reservations</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-secondary btn-xs" onClick={() => setWeekOffset(w => w - 1)}>←</button>
            <button className="btn btn-secondary btn-xs" onClick={() => setWeekOffset(0)}>Today</button>
            <button className="btn btn-secondary btn-xs" onClick={() => setWeekOffset(w => w + 1)}>→</button>
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>+ Reserve</button>
      </div>

      {/* Weekly calendar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 16 }}>
        {weekDays.map(day => {
          const dayRes = resByDay(day);
          const isToday = day.toDateString() === today.toDateString();
          return (
            <div key={day.toISOString()} style={{
              border: `1px solid ${isToday ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: 8, padding: 8, minHeight: 80,
              background: isToday ? 'var(--primary-light)' : 'var(--surface)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: isToday ? 'var(--primary)' : 'var(--text-muted)', marginBottom: 4 }}>
                {DAYS[day.getDay()]} {day.getDate()}
              </div>
              {dayRes.map(r => (
                <div key={r.id} style={{
                  background: 'var(--primary)', color: '#fff',
                  borderRadius: 4, padding: '2px 6px', fontSize: 11, marginBottom: 3, cursor: 'pointer',
                }}
                  onClick={() => setEditing(r)}
                  title={`${r.roomName} · ${r.startTime}–${r.endTime} · ${r.reservedBy}`}
                >
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.roomName}</div>
                  <div>{r.startTime}–{r.endTime}</div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* List view */}
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        {reservations.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>No reservations yet.</div>
        ) : (
          reservations.map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{r.roomName}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {new Date(r.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {r.startTime}–{r.endTime} · {r.reservedBy}
                  {r.notes && ` · ${r.notes}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-secondary btn-xs" onClick={() => setEditing(r)}>Edit</button>
                <button className="btn btn-danger btn-xs" onClick={() => setDeletingId(r.id)}>Del</button>
              </div>
            </div>
          ))
        )}
      </div>

      {editing && (
        <ReservationForm
          reservation={editing === 'new' ? undefined : editing}
          members={members}
          currentMember={currentMember}
          onSave={async data => {
            if (editing === 'new') await createReservation(data);
            else await updateReservation(editing.id, data);
            setEditing(null); load();
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {deletingId !== null && (
        <ConfirmDialog
          message="Delete this reservation?"
          onConfirm={async () => { await deleteReservation(deletingId); setDeletingId(null); load(); }}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  );
}

function ReservationForm({ reservation, members, currentMember, onSave, onClose }: {
  reservation?: RoomReservation;
  members: GroupMember[];
  currentMember: GroupMember | null;
  onSave: (data: Omit<RoomReservation, 'id' | 'createdAt'>) => void;
  onClose: () => void;
}) {
  const [roomName, setRoomName] = useState(reservation?.roomName ?? '');
  const [date, setDate] = useState(reservation?.date ? reservation.date.split('T')[0] : '');
  const [startTime, setStartTime] = useState(reservation?.startTime ?? '09:00');
  const [endTime, setEndTime] = useState(reservation?.endTime ?? '10:00');
  const [memberId, setMemberId] = useState<number | undefined>(
    reservation?.groupMemberId ?? currentMember?.id
  );
  const [reservedBy, setReservedBy] = useState(reservation?.reservedBy ?? currentMember?.name ?? '');
  const [notes, setNotes] = useState(reservation?.notes ?? '');

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{reservation ? 'Edit Reservation' : 'Add Reservation'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row"><label>Room Name *</label><input value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="e.g. Library Room 3" /></div>
          <div className="form-row"><label>Date *</label><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="form-grid mb-3">
            <div><label>Start Time</label><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} /></div>
            <div><label>End Time</label><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} /></div>
          </div>
          <div className="form-row">
            <label>Reserved By</label>
            <select value={memberId ?? ''} onChange={e => {
              const id = Number(e.target.value);
              setMemberId(id);
              const m = members.find(m => m.id === id);
              if (m) setReservedBy(m.name);
            }}>
              <option value="">Select member…</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="form-row"><label>Notes</label><input value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!roomName.trim() || !date} onClick={() => onSave({ roomName, date, startTime, endTime, groupMemberId: memberId, reservedBy, notes: notes || undefined })}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Resources Page ──────────────────────────────────────────────────────

export default function ResourcesPage({ currentMember, members }: Props) {
  const [activeTab, setActiveTab] = useState<'links' | 'resources' | 'reservations'>('links');
  return (
    <div>
      <div className="top-bar">
        <span className="top-bar-title">Resources</span>
      </div>
      <div className="page-body">
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {([['links', '🔗 Quick Links'], ['resources', '📚 Materials'], ['reservations', '📅 Room Reservations']] as const).map(([key, label]) => (
            <button
              key={key}
              className={`btn btn-ghost btn-sm`}
              style={{
                borderRadius: '6px 6px 0 0',
                borderBottom: activeTab === key ? '2px solid var(--primary)' : '2px solid transparent',
                color: activeTab === key ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: activeTab === key ? 600 : 400,
              }}
              onClick={() => setActiveTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'links' && <QuickLinksSection currentMember={currentMember} />}
        {activeTab === 'resources' && <ResourcesSection />}
        {activeTab === 'reservations' && <ReservationsSection members={members} currentMember={currentMember} />}
      </div>
    </div>
  );
}
