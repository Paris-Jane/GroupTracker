import { useEffect, useMemo, useState } from 'react';
import {
  getScheduleItemsBetween,
  createScheduleItem,
  updateScheduleItem,
  deleteScheduleItem,
} from '../api/client';
import type { GroupMember, ScheduleItem, ScheduleCategory } from '../types';
import { SCHEDULE_WEEK_START, SCHEDULE_WEEK_END } from '../types';

interface Props {
  currentMember: GroupMember | null;
  members: GroupMember[];
}

const CATS: ScheduleCategory[] = ['Room', 'Meeting', 'Unavailable', 'Other'];

function dayRange(start: string, end: string): string[] {
  const out: string[] = [];
  const a = new Date(start + 'T12:00:00');
  const b = new Date(end + 'T12:00:00');
  for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function formatDayLabel(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function SchedulePage({ currentMember, members }: Props) {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [editing, setEditing] = useState<ScheduleItem | 'new' | null>(null);

  const days = useMemo(() => dayRange(SCHEDULE_WEEK_START, SCHEDULE_WEEK_END), []);

  const load = () => getScheduleItemsBetween(SCHEDULE_WEEK_START, SCHEDULE_WEEK_END).then(setItems);
  useEffect(() => {
    load();
  }, []);

  const byDay = useMemo(() => {
    const m = new Map<string, ScheduleItem[]>();
    for (const d of days) m.set(d, []);
    for (const it of items) {
      const list = m.get(it.date);
      if (list) list.push(it);
    }
    for (const list of m.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return m;
  }, [items, days]);

  const memberName = (id?: number) => members.find(x => x.id === id)?.name ?? '—';

  return (
    <div className="page">
      <header className="page-title-block">
        <h1 className="page-title">Schedule</h1>
        <p className="page-subtitle">
          {formatDayLabel(SCHEDULE_WEEK_START)} – {formatDayLabel(SCHEDULE_WEEK_END)}
        </p>
      </header>

      <section className="panel">
        <div className="flex-between mb-3">
          <h2 className="panel-heading mb-0">This week</h2>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
            Add block
          </button>
        </div>
        <div className="schedule-week">
          {days.map(d => (
            <div key={d} className="schedule-day-col">
              <div className="schedule-day-head">{formatDayLabel(d)}</div>
              <div className="schedule-day-body">
                {(byDay.get(d) ?? []).map(it => (
                  <button
                    key={it.id}
                    type="button"
                    className={`schedule-block schedule-cat-${it.category.toLowerCase()}`}
                    onClick={() => setEditing(it)}
                  >
                    <div className="schedule-block-time">
                      {it.startTime.slice(0, 5)} – {it.endTime.slice(0, 5)}
                    </div>
                    <div className="schedule-block-title">{it.title}</div>
                    <div className="text-xs text-muted">{it.category}</div>
                    {it.ownerMemberId != null && (
                      <div className="text-xs">{memberName(it.ownerMemberId)}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {editing && (
        <ScheduleModal
          item={editing === 'new' ? null : editing}
          defaultDate={SCHEDULE_WEEK_START}
          currentMember={currentMember}
          members={members}
          onClose={() => setEditing(null)}
          onSave={async row => {
            if (editing === 'new') await createScheduleItem(row);
            else await updateScheduleItem(editing.id, row);
            setEditing(null);
            load();
          }}
          onDelete={
            editing !== 'new' && editing
              ? async () => {
                  await deleteScheduleItem(editing.id);
                  setEditing(null);
                  load();
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function ScheduleModal({
  item,
  defaultDate,
  currentMember,
  members,
  onClose,
  onSave,
  onDelete,
}: {
  item: ScheduleItem | null;
  defaultDate: string;
  currentMember: GroupMember | null;
  members: GroupMember[];
  onClose: () => void;
  onSave: (row: Omit<ScheduleItem, 'id' | 'createdAt' | 'ownerName' | 'ownerColor'>) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
}) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [category, setCategory] = useState<ScheduleCategory>(item?.category ?? 'Meeting');
  const [date, setDate] = useState(item?.date ?? defaultDate);
  const [startTime, setStartTime] = useState(item?.startTime?.slice(0, 5) ?? '09:00');
  const [endTime, setEndTime] = useState(item?.endTime?.slice(0, 5) ?? '10:00');
  const [location, setLocation] = useState(item?.location ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [ownerMemberId, setOwnerMemberId] = useState<number | ''>(item?.ownerMemberId ?? currentMember?.id ?? '');

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">{item ? 'Edit schedule block' : 'New schedule block'}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <label>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="form-grid mb-3">
            <div className="form-row">
              <label>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value as ScheduleCategory)}>
                {CATS.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>
          <div className="form-grid mb-3">
            <div className="form-row">
              <label>Start</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div className="form-row">
              <label>End</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <label>Owner</label>
            <select value={ownerMemberId === '' ? '' : String(ownerMemberId)} onChange={e => setOwnerMemberId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">None</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Location</label>
            <input value={location} onChange={e => setLocation(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div>
            {onDelete && (
              <button type="button" className="btn btn-danger btn-sm" onClick={() => void onDelete()}>
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!title.trim()}
              onClick={() =>
                onSave({
                  title,
                  category,
                  date,
                  startTime: startTime.length === 5 ? `${startTime}:00` : startTime,
                  endTime: endTime.length === 5 ? `${endTime}:00` : endTime,
                  ownerMemberId: ownerMemberId === '' ? undefined : ownerMemberId,
                  location: location || undefined,
                  notes: notes || undefined,
                })
              }
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
