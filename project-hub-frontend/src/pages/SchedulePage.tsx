import { useEffect, useMemo, useState, useCallback, type CSSProperties } from 'react';
import {
  getScheduleItemsBetween,
  createScheduleItem,
  updateScheduleItem,
  deleteScheduleItem,
} from '../api/client';
import type { GroupMember, ScheduleItem, ScheduleCategory } from '../types';
import { SCHEDULE_VIEW_START, SCHEDULE_VIEW_END } from '../types';

interface Props {
  currentMember: GroupMember | null;
  members: GroupMember[];
}

const CATS: ScheduleCategory[] = ['Room', 'Meeting', 'Unavailable', 'Other'];

const DAY_START_MIN = 7 * 60;
const DAY_END_MIN = 20 * 60;
const RANGE_MIN = DAY_END_MIN - DAY_START_MIN;
const TIMELINE_HEIGHT_PX = 560;

function weekDaysInclusive(start: string, end: string): string[] {
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

function parseTimeToMinutes(t: string): number {
  const part = t.length >= 5 ? t.slice(0, 5) : t;
  const [h, m] = part.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return DAY_START_MIN;
  return h * 60 + m;
}

function formatHour12(totalMin: number) {
  const h24 = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const p = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${p}` : `${h12} ${p}`;
}

function minutesToHHMM(totalMin: number) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Min visual height (% of column) so title + meta always fit (~matches CSS min-height). */
const MIN_BLOCK_HEIGHT_PCT = Math.max(8, (52 / TIMELINE_HEIGHT_PX) * 100);

function blockLayout(it: ScheduleItem) {
  let start = parseTimeToMinutes(it.startTime);
  let end = parseTimeToMinutes(it.endTime);
  if (end <= start) end = start + 30;
  start = Math.max(DAY_START_MIN, Math.min(start, DAY_END_MIN));
  end = Math.max(start + 15, Math.min(end, DAY_END_MIN));
  const topPct = ((start - DAY_START_MIN) / RANGE_MIN) * 100;
  const heightPct = ((end - start) / RANGE_MIN) * 100;
  return {
    top: `${topPct}%`,
    height: `${Math.max(heightPct, MIN_BLOCK_HEIGHT_PCT)}%`,
  };
}

function displayScheduleTitle(title: string) {
  const t = title.trim();
  return t.length > 0 ? t : 'Untitled';
}

const HOUR_TICKS = Array.from({ length: 14 }, (_, i) => DAY_START_MIN + i * 60);

export default function SchedulePage({ currentMember, members }: Props) {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [editing, setEditing] = useState<ScheduleItem | 'new' | null>(null);
  const [newSlotDefaults, setNewSlotDefaults] = useState<{
    date: string;
    startTime: string;
    endTime: string;
  } | null>(null);

  const weekStart = SCHEDULE_VIEW_START;
  const weekEnd = SCHEDULE_VIEW_END;
  const days = useMemo(() => weekDaysInclusive(weekStart, weekEnd), [weekStart, weekEnd]);

  const load = useCallback(
    () => getScheduleItemsBetween(weekStart, weekEnd).then(setItems),
    [weekStart, weekEnd],
  );
  useEffect(() => {
    load();
  }, [load]);

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

  const openNew = (defaults?: { date: string; startTime: string; endTime: string }) => {
    setNewSlotDefaults(defaults ?? null);
    setEditing('new');
  };

  const closeModal = () => {
    setEditing(null);
    setNewSlotDefaults(null);
  };

  const handleTimelineClick = (dayIso: string, e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button.schedule-block-abs')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const pct = Math.max(0, Math.min(1, y / rect.height));
    const minRaw = DAY_START_MIN + pct * RANGE_MIN;
    const startMin = Math.round(minRaw / 15) * 15;
    const endMin = Math.min(startMin + 60, DAY_END_MIN);
    openNew({
      date: dayIso,
      startTime: minutesToHHMM(startMin),
      endTime: minutesToHHMM(endMin),
    });
  };

  return (
    <div className="page schedule-page-full">
      <header className="page-title-block schedule-page-header">
      </header>

      <section className="panel schedule-calendar-panel">
        <div className="schedule-calendar" style={{ '--schedule-timeline-h': `${TIMELINE_HEIGHT_PX}px` } as CSSProperties}>
          <div className="schedule-calendar-top">
            <div className="schedule-calendar-corner" aria-hidden />
            {days.map(d => (
              <div key={d} className="schedule-day-head schedule-day-head--grid">
                {formatDayLabel(d)}
              </div>
            ))}
          </div>
          <div className="schedule-calendar-body">
            <div className="schedule-time-rail" aria-hidden>
              <div className="schedule-time-rail-inner" style={{ height: TIMELINE_HEIGHT_PX }}>
                {HOUR_TICKS.map(min => (
                  <div
                    key={min}
                    className="schedule-time-tick"
                    style={{ top: `${((min - DAY_START_MIN) / RANGE_MIN) * 100}%` }}
                  >
                    {formatHour12(min)}
                  </div>
                ))}
              </div>
            </div>
            {days.map(d => (
              <div
                key={d}
                className="schedule-timeline schedule-timeline--clickable"
                role="button"
                tabIndex={0}
                onClick={e => handleTimelineClick(d, e)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    const fake = {
                      clientY: rect.top + rect.height * 0.35,
                      currentTarget: e.currentTarget,
                    } as unknown as React.MouseEvent<HTMLDivElement>;
                    handleTimelineClick(d, fake);
                  }
                }}
                aria-label={`Add schedule block on ${formatDayLabel(d)}`}
              >
                {HOUR_TICKS.map(min => (
                  <div
                    key={min}
                    className="schedule-hour-line"
                    style={{ top: `${((min - DAY_START_MIN) / RANGE_MIN) * 100}%` }}
                  />
                ))}
                {(byDay.get(d) ?? []).map(it => (
                  <button
                    key={it.id}
                    type="button"
                    className={`schedule-block-abs schedule-cat-${it.category.toLowerCase()}`}
                    style={blockLayout(it)}
                    aria-label={`${displayScheduleTitle(it.title)}, ${it.startTime.slice(0, 5)} to ${it.endTime.slice(0, 5)}`}
                    onClick={ev => {
                      ev.stopPropagation();
                      setEditing(it);
                    }}
                  >
                    <div className="schedule-block-abs-title">{displayScheduleTitle(it.title)}</div>
                    <div className="schedule-block-abs-meta">
                      <span className="schedule-block-abs-time">
                        {it.startTime.slice(0, 5)} – {it.endTime.slice(0, 5)}
                      </span>
                      {it.ownerMemberId != null && (
                        <span className="schedule-block-abs-owner">{memberName(it.ownerMemberId)}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {editing && (
        <ScheduleModal
          item={editing === 'new' ? null : editing}
          defaultDate={newSlotDefaults?.date ?? weekStart}
          defaultStartTime={newSlotDefaults?.startTime}
          defaultEndTime={newSlotDefaults?.endTime}
          currentMember={currentMember}
          members={members}
          onClose={closeModal}
          onSave={async row => {
            if (editing === 'new') await createScheduleItem(row);
            else await updateScheduleItem(editing.id, row);
            closeModal();
            load();
          }}
          onDelete={
            editing !== 'new' && editing
              ? async () => {
                  await deleteScheduleItem(editing.id);
                  closeModal();
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
  defaultStartTime,
  defaultEndTime,
  currentMember,
  members,
  onClose,
  onSave,
  onDelete,
}: {
  item: ScheduleItem | null;
  defaultDate: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
  currentMember: GroupMember | null;
  members: GroupMember[];
  onClose: () => void;
  onSave: (row: Omit<ScheduleItem, 'id' | 'createdAt' | 'ownerName' | 'ownerColor'>) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
}) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [category, setCategory] = useState<ScheduleCategory>(item?.category ?? 'Meeting');
  const [date, setDate] = useState(item?.date ?? defaultDate);
  const [startTime, setStartTime] = useState(
    item?.startTime?.slice(0, 5) ?? defaultStartTime ?? '09:00',
  );
  const [endTime, setEndTime] = useState(item?.endTime?.slice(0, 5) ?? defaultEndTime ?? '10:00');
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
              <label>Day</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>
          <div className="form-grid mb-3">
            <div className="form-row">
              <label>Start time</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div className="form-row">
              <label>End time</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <label>Owner</label>
            <select
              value={ownerMemberId === '' ? '' : String(ownerMemberId)}
              onChange={e => setOwnerMemberId(e.target.value ? Number(e.target.value) : '')}
            >
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
