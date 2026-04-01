import { supabase } from '../lib/supabase';
import type {
  GroupMember,
  TaskItem,
  SubtaskItem,
  QuickLink,
  ResourceItem,
  RoomReservation,
  TaskUpdate,
  TaskRating,
  TaskRatingSummary,
  CreateTaskDto,
  BulkImportTaskDto,
  TaskStatus,
} from '../types';

function err(e: { message?: string } | null, fallback: string): never {
  throw new Error(e?.message ?? fallback);
}

// ── Mappers (snake_case rows → app types) ─────────────────────────────────

type MemberRow = {
  id: number;
  name: string;
  email: string | null;
  avatar_initial: string | null;
  color: string | null;
};

function mapMember(r: MemberRow): GroupMember {
  return {
    id: Number(r.id),
    name: r.name,
    email: r.email ?? undefined,
    avatarInitial: r.avatar_initial ?? undefined,
    color: r.color ?? undefined,
  };
}

type SubRow = {
  id: number;
  task_item_id: number;
  name: string;
  is_completed: boolean;
  created_at: string;
};

function mapSubtask(s: SubRow): SubtaskItem {
  return {
    id: Number(s.id),
    taskItemId: Number(s.task_item_id),
    name: s.name,
    isCompleted: s.is_completed,
    createdAt: s.created_at,
  };
}

type AssignEmbed = {
  id: number;
  group_member_id: number;
  group_members: { name: string; color: string | null; avatar_initial: string | null } | null;
};

function mapAssignment(a: AssignEmbed) {
  const m = a.group_members;
  return {
    id: Number(a.id),
    groupMemberId: Number(a.group_member_id),
    memberName: m?.name ?? 'Unknown',
    memberColor: m?.color ?? undefined,
    memberAvatarInitial: m?.avatar_initial ?? undefined,
  };
}

type TaskRow = {
  id: number;
  name: string;
  description: string | null;
  estimated_time: string | null;
  deadline: string | null;
  priority: string;
  is_required: boolean;
  status: string;
  tags: string | null;
  created_at: string;
  updated_at: string;
  subtasks: SubRow[] | null;
  task_assignments: AssignEmbed[] | null;
};

function mapStatus(s: string): TaskStatus {
  if (s === 'InProgress') return 'WorkingOnIt';
  if (s === 'WorkingOnIt' || s === 'NotStarted' || s === 'Completed') return s;
  return 'NotStarted';
}

function mapTask(row: TaskRow): TaskItem {
  return {
    id: Number(row.id),
    name: row.name,
    description: row.description ?? undefined,
    estimatedTime: row.estimated_time ?? undefined,
    deadline: row.deadline ?? undefined,
    priority: row.priority as TaskItem['priority'],
    isRequired: row.is_required,
    status: mapStatus(row.status),
    tags: row.tags ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    subtasks: (row.subtasks ?? []).map(mapSubtask),
    assignments: (row.task_assignments ?? []).map(mapAssignment),
  };
}

const taskSelect = `
  *,
  subtasks (*),
  task_assignments (
    id,
    group_member_id,
    group_members ( name, color, avatar_initial )
  )
`;

async function fetchTaskById(id: number): Promise<TaskItem> {
  const { data, error } = await supabase
    .from('task_items')
    .select(taskSelect)
    .eq('id', id)
    .single();
  if (error || !data) err(error, 'Task not found');
  return mapTask(data as TaskRow);
}

async function logUpdate(taskId: number, memberId: number | undefined, action: string, message: string) {
  const { error } = await supabase.from('task_updates').insert({
    task_item_id: taskId,
    group_member_id: memberId ?? null,
    action_type: action,
    message,
  });
  if (error) err(error, 'Failed to log task update');
}

// ── Group Members ──────────────────────────────────────────────────────────

export const getMembers = async (): Promise<GroupMember[]> => {
  const { data, error } = await supabase.from('group_members').select('*').order('id');
  if (error) err(error, 'Failed to load members');
  return (data as MemberRow[]).map(mapMember);
};

export const createMember = async (data: Omit<GroupMember, 'id'>): Promise<GroupMember> => {
  const initial = data.avatarInitial?.trim() || (data.name.trim().charAt(0).toUpperCase() || '?');
  const { data: row, error } = await supabase
    .from('group_members')
    .insert({
      name: data.name,
      email: data.email ?? null,
      avatar_initial: initial,
      color: data.color ?? '#4A90D9',
    })
    .select()
    .single();
  if (error || !row) err(error, 'Failed to create member');
  return mapMember(row as MemberRow);
};

export const updateMember = async (id: number, data: Omit<GroupMember, 'id'>): Promise<GroupMember> => {
  const { data: row, error } = await supabase
    .from('group_members')
    .update({
      name: data.name,
      email: data.email ?? null,
      avatar_initial: data.avatarInitial ?? null,
      color: data.color ?? null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error || !row) err(error, 'Failed to update member');
  return mapMember(row as MemberRow);
};

export const deleteMember = async (id: number): Promise<void> => {
  const { error } = await supabase.from('group_members').delete().eq('id', id);
  if (error) err(error, 'Failed to delete member');
};

// ── Tasks ──────────────────────────────────────────────────────────────────

export const getTasks = async (): Promise<TaskItem[]> => {
  const { data, error } = await supabase
    .from('task_items')
    .select(taskSelect)
    .order('created_at', { ascending: false });
  if (error) err(error, 'Failed to load tasks');
  return (data as TaskRow[]).map(mapTask);
};

export const getTasksByMember = async (memberId: number): Promise<TaskItem[]> => {
  const { data: assigns, error: e1 } = await supabase
    .from('task_assignments')
    .select('task_item_id')
    .eq('group_member_id', memberId);
  if (e1) err(e1, 'Failed to load assignments');
  const ids = [...new Set((assigns ?? []).map((a: { task_item_id: number }) => Number(a.task_item_id)))];
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('task_items')
    .select(taskSelect)
    .in('id', ids)
    .order('deadline', { ascending: true, nullsFirst: false });
  if (error) err(error, 'Failed to load tasks');
  return (data as TaskRow[]).map(mapTask);
};

function toApiStatus(s: TaskStatus): string {
  return s === 'WorkingOnIt' ? 'WorkingOnIt' : s;
}

export const createTask = async (data: CreateTaskDto, actorId?: number): Promise<TaskItem> => {
  const now = new Date().toISOString();
  const status = toApiStatus(data.status);
  const { data: task, error } = await supabase
    .from('task_items')
    .insert({
      name: data.name,
      description: data.description ?? null,
      estimated_time: data.estimatedTime ?? null,
      deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
      priority: data.priority,
      is_required: data.isRequired,
      status,
      tags: data.tags ?? null,
      sprint_number: null,
      category: 'ProductBacklog',
      evaluation: null,
      definition_of_done: null,
      accepted_by_po: false,
      is_blocked: false,
      blocked_reason: null,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();
  if (error || !task) err(error, 'Failed to create task');
  const taskId = Number((task as { id: number }).id);

  try {
    const subs = (data.subtaskNames ?? []).filter(Boolean);
    if (subs.length > 0) {
      const { error: e2 } = await supabase.from('subtasks').insert(
        subs.map(name => ({ task_item_id: taskId, name })),
      );
      if (e2) throw e2;
    }
    const assignees = [...new Set(data.assigneeIds ?? [])];
    if (assignees.length > 0) {
      const { error: e3 } = await supabase.from('task_assignments').insert(
        assignees.map(group_member_id => ({ task_item_id: taskId, group_member_id })),
      );
      if (e3) throw e3;
    }
    await logUpdate(taskId, actorId, 'Created', `Task "${data.name}" was created`);
  } catch (e) {
    await supabase.from('task_items').delete().eq('id', taskId);
    err(e as { message?: string }, 'Failed to create task details');
  }

  return fetchTaskById(taskId);
};

export const updateTask = async (
  id: number,
  data: Omit<CreateTaskDto, 'assigneeIds' | 'subtaskNames'>,
  actorId?: number,
): Promise<TaskItem> => {
  const status = toApiStatus(data.status);
  const { error } = await supabase
    .from('task_items')
    .update({
      name: data.name,
      description: data.description ?? null,
      estimated_time: data.estimatedTime ?? null,
      deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
      priority: data.priority,
      is_required: data.isRequired,
      status,
      tags: data.tags ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) err(error, 'Failed to update task');
  const t = await fetchTaskById(id);
  await logUpdate(id, actorId, 'Updated', `Task "${data.name}" was updated`);
  return t;
};

export const deleteTask = async (id: number): Promise<void> => {
  const { error } = await supabase.from('task_items').delete().eq('id', id);
  if (error) err(error, 'Failed to delete task');
};

export const updateTaskStatus = async (id: number, status: TaskStatus, actorId?: number): Promise<TaskItem> => {
  const s = toApiStatus(status);
  const { error } = await supabase
    .from('task_items')
    .update({ status: s, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) err(error, 'Failed to update status');
  const t = await fetchTaskById(id);
  await logUpdate(id, actorId, 'StatusChanged', `Status changed to ${s}`);
  return t;
};

export const assignTask = async (id: number, memberIds: number[], actorId?: number): Promise<TaskItem> => {
  const { error: d0 } = await supabase.from('task_assignments').delete().eq('task_item_id', id);
  if (d0) err(d0, 'Failed to clear assignments');
  const distinct = [...new Set(memberIds)];
  if (distinct.length > 0) {
    const { error: e1 } = await supabase
      .from('task_assignments')
      .insert(distinct.map(group_member_id => ({ task_item_id: id, group_member_id })));
    if (e1) err(e1, 'Failed to assign task');
  }
  await supabase.from('task_items').update({ updated_at: new Date().toISOString() }).eq('id', id);
  const { data: names } = await supabase.from('group_members').select('name').in('id', distinct);
  const label = (names as { name: string }[] | null)?.map(n => n.name).join(', ') ?? '';
  await logUpdate(id, actorId, 'Assigned', `Assigned to ${label || '(none)'}`);
  return fetchTaskById(id);
};

export const getRecentUpdates = async (count = 15): Promise<TaskUpdate[]> => {
  const { data, error } = await supabase
    .from('task_updates')
    .select(
      `
      id,
      task_item_id,
      group_member_id,
      action_type,
      message,
      created_at,
      task_items ( name ),
      group_members ( name, color, avatar_initial )
    `,
    )
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(count, 1), 50));
  if (error) err(error, 'Failed to load updates');
  type UpdateRow = {
    id: number;
    task_item_id: number;
    group_member_id: number | null;
    action_type: string;
    message: string;
    created_at: string;
    task_items: { name: string } | null;
    group_members: { name: string; color: string | null; avatar_initial: string | null } | null;
  };
  return (data as unknown as UpdateRow[]).map(u => ({
    id: Number(u.id),
    taskItemId: Number(u.task_item_id),
    taskName: u.task_items?.name ?? 'Task',
    groupMemberId: u.group_member_id ?? undefined,
    memberName: u.group_members?.name ?? undefined,
    memberColor: u.group_members?.color ?? undefined,
    actionType: u.action_type,
    message: u.message,
    createdAt: u.created_at,
  }));
};

export const bulkImportTasks = async (tasks: BulkImportTaskDto[], actorId?: number): Promise<TaskItem[]> => {
  const members = await getMembers();
  const created: TaskItem[] = [];
  for (const t of tasks) {
    const assigneeIds = (t.assigneeNames ?? [])
      .map(n => members.find(m => m.name.toLowerCase() === n.trim().toLowerCase())?.id)
      .filter((id): id is number => id != null);
    const item = await createTask(
      {
        name: t.name,
        description: t.description,
        estimatedTime: t.estimatedTime,
        deadline: t.deadline,
        priority: t.priority,
        isRequired: t.isRequired,
        status: t.status,
        tags: t.tags,
        assigneeIds,
        subtaskNames: t.subtaskNames,
      },
      actorId,
    );
    created.push(item);
  }
  return created;
};

// ── Subtasks ───────────────────────────────────────────────────────────────

export const createSubtask = async (taskId: number, name: string): Promise<SubtaskItem> => {
  const { data, error } = await supabase
    .from('subtasks')
    .insert({ task_item_id: taskId, name })
    .select()
    .single();
  if (error || !data) err(error, 'Failed to create subtask');
  return mapSubtask(data as SubRow);
};

export const updateSubtask = async (subtaskId: number, name: string, isCompleted: boolean): Promise<SubtaskItem> => {
  const { data, error } = await supabase
    .from('subtasks')
    .update({ name, is_completed: isCompleted })
    .eq('id', subtaskId)
    .select()
    .single();
  if (error || !data) err(error, 'Failed to update subtask');
  return mapSubtask(data as SubRow);
};

export const deleteSubtask = async (subtaskId: number): Promise<void> => {
  const { error } = await supabase.from('subtasks').delete().eq('id', subtaskId);
  if (error) err(error, 'Failed to delete subtask');
};

// ── Quick Links ────────────────────────────────────────────────────────────

export const getLinks = async (): Promise<QuickLink[]> => {
  const { data, error } = await supabase.from('quick_links').select('*').order('title');
  if (error) err(error, 'Failed to load links');
  return (data as {
    id: number;
    title: string;
    url: string;
    category: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
  }[]).map(r => ({
    id: Number(r.id),
    title: r.title,
    url: r.url,
    category: r.category ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
};

export const createLink = async (data: Omit<QuickLink, 'id' | 'createdAt' | 'updatedAt'>): Promise<QuickLink> => {
  const now = new Date().toISOString();
  const { data: row, error } = await supabase
    .from('quick_links')
    .insert({
      title: data.title,
      url: data.url,
      category: data.category ?? null,
      notes: data.notes ?? null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  if (error || !row) err(error, 'Failed to create link');
  const r = row as {
    id: number;
    title: string;
    url: string;
    category: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
  };
  return {
    id: Number(r.id),
    title: r.title,
    url: r.url,
    category: r.category ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
};

export const updateLink = async (
  id: number,
  data: Omit<QuickLink, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<QuickLink> => {
  const { data: row, error } = await supabase
    .from('quick_links')
    .update({
      title: data.title,
      url: data.url,
      category: data.category ?? null,
      notes: data.notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error || !row) err(error, 'Failed to update link');
  const r = row as {
    id: number;
    title: string;
    url: string;
    category: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
  };
  return {
    id: Number(r.id),
    title: r.title,
    url: r.url,
    category: r.category ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
};

export const deleteLink = async (id: number): Promise<void> => {
  const { error } = await supabase.from('quick_links').delete().eq('id', id);
  if (error) err(error, 'Failed to delete link');
};

// ── Resource Items ─────────────────────────────────────────────────────────

export const getResources = async (): Promise<ResourceItem[]> => {
  const { data, error } = await supabase.from('resource_items').select('*').order('title');
  if (error) err(error, 'Failed to load resources');
  return (data as {
    id: number;
    title: string;
    description: string | null;
    type: string;
    category: string | null;
    url: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
  }[]).map(r => ({
    id: Number(r.id),
    title: r.title,
    description: r.description ?? undefined,
    type: r.type as ResourceItem['type'],
    category: r.category ?? undefined,
    url: r.url ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
};

export const createResource = async (
  data: Omit<ResourceItem, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<ResourceItem> => {
  const now = new Date().toISOString();
  const { data: row, error } = await supabase
    .from('resource_items')
    .insert({
      title: data.title,
      description: data.description ?? null,
      type: data.type,
      category: data.category ?? null,
      url: data.url ?? null,
      notes: data.notes ?? null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  if (error || !row) err(error, 'Failed to create resource');
  const r = row as {
    id: number;
    title: string;
    description: string | null;
    type: string;
    category: string | null;
    url: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
  };
  return {
    id: Number(r.id),
    title: r.title,
    description: r.description ?? undefined,
    type: r.type as ResourceItem['type'],
    category: r.category ?? undefined,
    url: r.url ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
};

export const updateResource = async (
  id: number,
  data: Omit<ResourceItem, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<ResourceItem> => {
  const { error } = await supabase
    .from('resource_items')
    .update({
      title: data.title,
      description: data.description ?? null,
      type: data.type,
      category: data.category ?? null,
      url: data.url ?? null,
      notes: data.notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) err(error, 'Failed to update resource');
  const list = await getResources();
  const found = list.find(x => x.id === id);
  if (!found) err(null, 'Resource not found after update');
  return found;
};

export const deleteResource = async (id: number): Promise<void> => {
  const { error } = await supabase.from('resource_items').delete().eq('id', id);
  if (error) err(error, 'Failed to delete resource');
};

// ── Room Reservations ──────────────────────────────────────────────────────

export const getReservations = async (): Promise<RoomReservation[]> => {
  const { data, error } = await supabase.from('room_reservations').select('*').order('date', { ascending: true });
  if (error) err(error, 'Failed to load reservations');
  return (data as {
    id: number;
    room_name: string;
    date: string;
    start_time: string;
    end_time: string;
    group_member_id: number | null;
    reserved_by: string;
    notes: string | null;
    created_at: string;
  }[]).map(r => ({
    id: Number(r.id),
    roomName: r.room_name,
    date: r.date,
    startTime: r.start_time,
    endTime: r.end_time,
    groupMemberId: r.group_member_id ?? undefined,
    reservedBy: r.reserved_by,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
  }));
};

export const createReservation = async (
  data: Omit<RoomReservation, 'id' | 'createdAt'>,
): Promise<RoomReservation> => {
  const { data: row, error } = await supabase
    .from('room_reservations')
    .insert({
      room_name: data.roomName,
      date: data.date,
      start_time: data.startTime,
      end_time: data.endTime,
      group_member_id: data.groupMemberId ?? null,
      reserved_by: data.reservedBy,
      notes: data.notes ?? null,
    })
    .select()
    .single();
  if (error || !row) err(error, 'Failed to create reservation');
  const r = row as {
    id: number;
    room_name: string;
    date: string;
    start_time: string;
    end_time: string;
    group_member_id: number | null;
    reserved_by: string;
    notes: string | null;
    created_at: string;
  };
  return {
    id: Number(r.id),
    roomName: r.room_name,
    date: r.date,
    startTime: r.start_time,
    endTime: r.end_time,
    groupMemberId: r.group_member_id ?? undefined,
    reservedBy: r.reserved_by,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
  };
};

export const updateReservation = async (
  id: number,
  data: Omit<RoomReservation, 'id' | 'createdAt'>,
): Promise<RoomReservation> => {
  const { data: row, error } = await supabase
    .from('room_reservations')
    .update({
      room_name: data.roomName,
      date: data.date,
      start_time: data.startTime,
      end_time: data.endTime,
      group_member_id: data.groupMemberId ?? null,
      reserved_by: data.reservedBy,
      notes: data.notes ?? null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error || !row) err(error, 'Failed to update reservation');
  const r = row as {
    id: number;
    room_name: string;
    date: string;
    start_time: string;
    end_time: string;
    group_member_id: number | null;
    reserved_by: string;
    notes: string | null;
    created_at: string;
  };
  return {
    id: Number(r.id),
    roomName: r.room_name,
    date: r.date,
    startTime: r.start_time,
    endTime: r.end_time,
    groupMemberId: r.group_member_id ?? undefined,
    reservedBy: r.reserved_by,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
  };
};

export const deleteReservation = async (id: number): Promise<void> => {
  const { error } = await supabase.from('room_reservations').delete().eq('id', id);
  if (error) err(error, 'Failed to delete reservation');
};

// ── Play Game / Ratings ────────────────────────────────────────────────────

export const submitRating = async (
  taskId: number,
  memberId: number,
  ratingValue: number,
): Promise<TaskRating> => {
  if (ratingValue < 1 || ratingValue > 10) throw new Error('Rating must be 1–10.');
  const now = new Date().toISOString();
  const { error } = await supabase.from('task_ratings').upsert(
    {
      task_item_id: taskId,
      group_member_id: memberId,
      rating_value: ratingValue,
      updated_at: now,
    },
    { onConflict: 'task_item_id,group_member_id' },
  );
  if (error) err(error, 'Failed to save rating');
  const { data: m } = await supabase.from('group_members').select('name,color').eq('id', memberId).single();
  const { data: row } = await supabase
    .from('task_ratings')
    .select('id,rating_value')
    .eq('task_item_id', taskId)
    .eq('group_member_id', memberId)
    .single();
  const mr = m as { name: string; color: string | null } | null;
  const tr = row as { id: number; rating_value: number } | null;
  return {
    id: Number(tr?.id ?? 0),
    taskItemId: taskId,
    groupMemberId: memberId,
    memberName: mr?.name ?? 'Unknown',
    memberColor: mr?.color ?? undefined,
    ratingValue: tr?.rating_value ?? ratingValue,
  };
};

type GameTaskRow = {
  id: number;
  name: string;
  task_ratings: {
    id: number;
    task_item_id: number;
    group_member_id: number;
    rating_value: number;
    group_members: { name: string; color: string | null } | null;
  }[] | null;
  task_assignments: { group_member_id: number }[] | null;
};

function mapGameSummary(t: GameTaskRow): TaskRatingSummary {
  const ratings = (t.task_ratings ?? []).map(
    (r): TaskRating => ({
      id: Number(r.id),
      taskItemId: Number(r.task_item_id),
      groupMemberId: Number(r.group_member_id),
      memberName: r.group_members?.name ?? 'Unknown',
      memberColor: r.group_members?.color ?? undefined,
      ratingValue: r.rating_value,
    }),
  );
  const top = [...ratings].sort((a, b) => b.ratingValue - a.ratingValue)[0];
  const firstAssign = t.task_assignments?.[0];
  return {
    taskItemId: Number(t.id),
    taskName: t.name,
    ratings,
    highestScoringMemberId: top?.groupMemberId,
    highestScoringMemberName: top?.memberName,
    currentAssigneeId: firstAssign ? Number(firstAssign.group_member_id) : undefined,
  };
}

export const getGameResults = async (): Promise<TaskRatingSummary[]> => {
  const { data, error } = await supabase.from('task_items').select(`
      id,
      name,
      task_ratings (
        id,
        task_item_id,
        group_member_id,
        rating_value,
        group_members ( name, color )
      ),
      task_assignments ( group_member_id )
    `);
  if (error) err(error, 'Failed to load game results');
  return (data as unknown as GameTaskRow[]).map(mapGameSummary);
};

export const getTaskGameResult = async (taskId: number): Promise<TaskRatingSummary> => {
  const { data, error } = await supabase
    .from('task_items')
    .select(
      `
      id,
      name,
      task_ratings (
        id,
        task_item_id,
        group_member_id,
        rating_value,
        group_members ( name, color )
      ),
      task_assignments ( group_member_id )
    `,
    )
    .eq('id', taskId)
    .single();
  if (error || !data) err(error, 'Task not found');
  return mapGameSummary(data as unknown as GameTaskRow);
};
