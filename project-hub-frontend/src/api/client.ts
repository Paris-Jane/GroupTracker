import { supabase } from '../lib/supabase';
import type {
  GroupMember,
  TaskItem,
  SubtaskItem,
  QuickLink,
  ResourceItemRow,
  LoginItem,
  TextNote,
  ScheduleItem,
  TaskUpdate,
  TaskRating,
  TaskRatingSummary,
  CreateTaskDto,
  BulkImportTaskDto,
  BulkImportSprintGoalDto,
  TaskStatus,
  TaskCategory,
  ProjectSettings,
  SprintGoal,
  SprintReview,
  AdminMember,
  AdminBulkResetOptions,
  ResourceSection,
  ClassLinkCategory,
  ScheduleCategory,
} from '../types';

function err(e: { message?: string } | null, fallback: string): never {
  throw new Error(e?.message ?? fallback);
}

// ── Members & auth ─────────────────────────────────────────────────────────

type MemberRow = {
  id: number;
  name: string;
  email: string | null;
  avatar_initial: string | null;
  color: string | null;
  username: string | null;
  password?: string | null;
};

function mapMember(r: MemberRow): GroupMember {
  return {
    id: Number(r.id),
    name: r.name,
    username: r.username ?? undefined,
    email: r.email ?? undefined,
    avatarInitial: r.avatar_initial ?? undefined,
    color: r.color ?? undefined,
  };
}

export async function loginMember(username: string, password: string): Promise<GroupMember | null> {
  const u = username.trim().toLowerCase();
  const p = password.trim().toLowerCase();
  const { data, error } = await supabase.from('group_members').select('*');
  if (error) err(error, 'Login failed');
  const row = (data as MemberRow[] | null)?.find(
    m => (m.username ?? '').toLowerCase() === u && (m.password ?? '').toLowerCase() === p,
  );
  return row ? mapMember(row) : null;
}

export const getMembers = async (): Promise<GroupMember[]> => {
  const { data, error } = await supabase
    .from('group_members')
    .select('id,name,email,avatar_initial,color,username')
    .order('id');
  if (error) err(error, 'Failed to load members');
  return (data as MemberRow[]).map(mapMember);
};

export const createMember = async (data: Omit<GroupMember, 'id'> & { password?: string }): Promise<GroupMember> => {
  const initial = data.avatarInitial?.trim() || (data.name.trim().charAt(0).toUpperCase() || '?');
  const { data: row, error } = await supabase
    .from('group_members')
    .insert({
      name: data.name,
      username: data.username ?? null,
      password: data.password ?? null,
      email: data.email ?? null,
      avatar_initial: initial,
      color: data.color ?? '#4A6FA5',
    })
    .select('id,name,email,avatar_initial,color,username')
    .single();
  if (error || !row) err(error, 'Failed to create member');
  return mapMember(row as MemberRow);
};

export const updateMember = async (id: number, data: Partial<GroupMember> & { password?: string }): Promise<GroupMember> => {
  const { data: row, error } = await supabase
    .from('group_members')
    .update({
      name: data.name,
      email: data.email ?? null,
      avatar_initial: data.avatarInitial ?? null,
      color: data.color ?? null,
      username: data.username ?? null,
      ...(data.password !== undefined ? { password: data.password } : {}),
    })
    .eq('id', id)
    .select('id,name,email,avatar_initial,color,username')
    .single();
  if (error || !row) err(error, 'Failed to update member');
  return mapMember(row as MemberRow);
};

export const deleteMember = async (id: number): Promise<void> => {
  const { error } = await supabase.from('group_members').delete().eq('id', id);
  if (error) err(error, 'Failed to delete member');
};

// ── Tasks ───────────────────────────────────────────────────────────────────

type SubRow = { id: number; task_item_id: number; name: string; is_completed: boolean; created_at: string };
type AssignEmbed = {
  id: number;
  group_member_id: number;
  group_members: { name: string; color: string | null; avatar_initial: string | null } | null;
};

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
  sprint_number: number | null;
  category: string;
  evaluation: number | null;
  definition_of_done: string | null;
  accepted_by_po: boolean;
  is_blocked: boolean;
  blocked_reason: string | null;
  last_edited_by_group_member_id: number | null;
  created_at: string;
  updated_at: string;
  subtasks: SubRow[] | null;
  task_assignments: AssignEmbed[] | null;
};

function mapStatus(s: string): TaskStatus {
  if (s === 'WorkingOnIt' || s === 'InProgress') return 'InProgress';
  if (s === 'Completed') return 'Completed';
  return 'NotStarted';
}

function toApiStatus(s: TaskStatus): string {
  return s === 'InProgress' ? 'InProgress' : s;
}

function mapSubtask(s: SubRow): SubtaskItem {
  return {
    id: Number(s.id),
    taskItemId: Number(s.task_item_id),
    name: s.name,
    isCompleted: s.is_completed,
    createdAt: s.created_at,
  };
}

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

function mapTask(row: TaskRow): TaskItem {
  return {
    id: Number(row.id),
    name: row.name,
    notes: row.description ?? undefined,
    estimatedTime: row.estimated_time ?? undefined,
    deadline: row.deadline ?? undefined,
    priority: row.priority as TaskItem['priority'],
    isRequired: row.is_required,
    status: mapStatus(row.status),
    tags: row.tags ?? undefined,
    sprintNumber: row.sprint_number ?? undefined,
    category: (row.category as TaskCategory) || 'ProductBacklog',
    evaluation: row.evaluation ?? undefined,
    definitionOfDone: row.definition_of_done ?? undefined,
    acceptedByPO: row.accepted_by_po,
    isBlocked: row.is_blocked,
    blockedReason: row.blocked_reason ?? undefined,
    lastEditedByMemberId: row.last_edited_by_group_member_id ?? undefined,
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
  const { data, error } = await supabase.from('task_items').select(taskSelect).eq('id', id).single();
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

function taskInsertPayload(data: CreateTaskDto, now: string) {
  return {
    name: data.name,
    description: data.notes ?? null,
    estimated_time: data.estimatedTime ?? null,
    deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
    priority: data.priority,
    is_required: data.isRequired,
    status: toApiStatus(data.status),
    tags: data.tags ?? null,
    sprint_number: data.sprintNumber ?? null,
    category: data.category,
    evaluation: data.evaluation ?? null,
    definition_of_done: data.definitionOfDone ?? null,
    accepted_by_po: data.acceptedByPO ?? false,
    is_blocked: data.isBlocked ?? false,
    blocked_reason: data.blockedReason ?? null,
    created_at: now,
    updated_at: now,
  };
}

function taskUpdatePayload(data: Partial<CreateTaskDto> & { lastEditedByMemberId?: number }) {
  const u: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) u.name = data.name;
  if (data.notes !== undefined) u.description = data.notes ?? null;
  if (data.estimatedTime !== undefined) u.estimated_time = data.estimatedTime ?? null;
  if (data.deadline !== undefined) u.deadline = data.deadline ? new Date(data.deadline).toISOString() : null;
  if (data.priority !== undefined) u.priority = data.priority;
  if (data.isRequired !== undefined) u.is_required = data.isRequired;
  if (data.status !== undefined) u.status = toApiStatus(data.status);
  if (data.tags !== undefined) u.tags = data.tags ?? null;
  if (data.sprintNumber !== undefined) u.sprint_number = data.sprintNumber ?? null;
  if (data.category !== undefined) u.category = data.category;
  if (data.evaluation !== undefined) u.evaluation = data.evaluation ?? null;
  if (data.definitionOfDone !== undefined) u.definition_of_done = data.definitionOfDone ?? null;
  if (data.acceptedByPO !== undefined) u.accepted_by_po = data.acceptedByPO;
  if (data.isBlocked !== undefined) u.is_blocked = data.isBlocked;
  if (data.blockedReason !== undefined) u.blocked_reason = data.blockedReason ?? null;
  if (data.lastEditedByMemberId !== undefined) u.last_edited_by_group_member_id = data.lastEditedByMemberId ?? null;
  return u;
}

export const getTasks = async (): Promise<TaskItem[]> => {
  const { data, error } = await supabase.from('task_items').select(taskSelect).order('created_at', { ascending: false });
  if (error) err(error, 'Failed to load tasks');
  return (data as TaskRow[]).map(mapTask);
};

export const getTasksByMember = async (memberId: number): Promise<TaskItem[]> => {
  const { data: assigns, error: e1 } = await supabase.from('task_assignments').select('task_item_id').eq('group_member_id', memberId);
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

export const createTask = async (data: CreateTaskDto, actorId?: number): Promise<TaskItem> => {
  const now = new Date().toISOString();
  const payload = { ...taskInsertPayload(data, now), last_edited_by_group_member_id: actorId ?? null };
  const { data: task, error } = await supabase.from('task_items').insert(payload).select('id').single();
  if (error || !task) err(error, 'Failed to create task');
  const taskId = Number((task as { id: number }).id);
  try {
    const subs = (data.subtaskNames ?? []).filter(Boolean);
    if (subs.length > 0) {
      const { error: e2 } = await supabase.from('subtasks').insert(subs.map(name => ({ task_item_id: taskId, name })));
      if (e2) throw e2;
    }
    const assignees = [...new Set(data.assigneeIds ?? [])];
    if (assignees.length > 0) {
      const { error: e3 } = await supabase
        .from('task_assignments')
        .insert(assignees.map(group_member_id => ({ task_item_id: taskId, group_member_id })));
      if (e3) throw e3;
    }
    await logUpdate(taskId, actorId, 'Created', `Task "${data.name}" was created`);
  } catch (e) {
    await supabase.from('task_items').delete().eq('id', taskId);
    err(e as { message?: string }, 'Failed to create task details');
  }
  return fetchTaskById(taskId);
};

export const updateTask = async (id: number, data: CreateTaskDto, actorId?: number): Promise<TaskItem> => {
  const u = taskUpdatePayload({ ...data, lastEditedByMemberId: actorId });
  const { error } = await supabase.from('task_items').update(u).eq('id', id);
  if (error) err(error, 'Failed to update task');
  const t = await fetchTaskById(id);
  await logUpdate(id, actorId, 'Updated', `Task "${data.name}" was updated`);
  return t;
};

export const patchTaskFields = async (
  id: number,
  patch: Partial<CreateTaskDto> & { lastEditedByMemberId?: number },
  actorId?: number,
  logAction?: string,
  logMessage?: string,
): Promise<TaskItem> => {
  const u = taskUpdatePayload({ ...patch, lastEditedByMemberId: patch.lastEditedByMemberId ?? actorId });
  const { error } = await supabase.from('task_items').update(u).eq('id', id);
  if (error) err(error, 'Failed to update task');
  const t = await fetchTaskById(id);
  if (logAction && logMessage) await logUpdate(id, actorId, logAction, logMessage);
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
    .update({ status: s, updated_at: new Date().toISOString(), last_edited_by_group_member_id: actorId ?? null })
    .eq('id', id);
  if (error) err(error, 'Failed to update status');
  const t = await fetchTaskById(id);
  const label = status === 'InProgress' ? 'In Progress' : status === 'Completed' ? 'Completed' : 'Not Started';
  await logUpdate(id, actorId, 'StatusChanged', `Moved to ${label}`);
  return t;
};

export const toggleAcceptedByPO = async (id: number, value: boolean, actorId?: number): Promise<TaskItem> => {
  const { error } = await supabase
    .from('task_items')
    .update({ accepted_by_po: value, updated_at: new Date().toISOString(), last_edited_by_group_member_id: actorId ?? null })
    .eq('id', id);
  if (error) err(error, 'Failed to update');
  const t = await fetchTaskById(id);
  await logUpdate(id, actorId, 'POAcceptance', value ? 'Marked accepted by product owner' : 'Marked not accepted');
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
  await supabase
    .from('task_items')
    .update({ updated_at: new Date().toISOString(), last_edited_by_group_member_id: actorId ?? null })
    .eq('id', id);
  const { data: names } = await supabase.from('group_members').select('name').in('id', distinct);
  const label = (names as { name: string }[] | null)?.map(n => n.name).join(', ') ?? '';
  await logUpdate(id, actorId, 'Assigned', `Assigned to ${label || '(none)'}`);
  return fetchTaskById(id);
};

export const getRecentUpdates = async (count = 20): Promise<TaskUpdate[]> => {
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
  const { data, error } = await supabase
    .from('task_updates')
    .select(
      `id, task_item_id, group_member_id, action_type, message, created_at, task_items ( name ), group_members ( name, color, avatar_initial )`,
    )
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(count, 1), 100));
  if (error) err(error, 'Failed to load updates');
  return (data as unknown as UpdateRow[]).map(u => ({
    id: Number(u.id),
    taskItemId: Number(u.task_item_id),
    taskName: u.task_items?.name ?? 'Task',
    groupMemberId: u.group_member_id ?? undefined,
    memberName: u.group_members?.name ?? undefined,
    memberColor: u.group_members?.color ?? undefined,
    memberAvatarInitial: u.group_members?.avatar_initial ?? undefined,
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
    const raw = t.status as string;
    const st: TaskStatus = raw === 'WorkingOnIt' || raw === 'InProgress' ? 'InProgress' : (t.status as TaskStatus);
    const item = await createTask(
      {
        name: t.name,
        notes: t.notes ?? t.description,
        estimatedTime: t.estimatedTime,
        deadline: t.deadline,
        priority: t.priority,
        isRequired: t.isRequired,
        status: st,
        tags: t.tags,
        sprintNumber: t.sprintNumber,
        category: t.category ?? 'ProductBacklog',
        assigneeIds,
        subtaskNames: t.subtaskNames,
      },
      actorId,
    );
    created.push(item);
  }
  return created;
};

/** Upsert sprint goals from AI, optional product goal, then create all tasks (same shape as bulkImportTasks). */
export const bulkImportSprintBundle = async (
  sprintGoals: BulkImportSprintGoalDto[],
  tasks: BulkImportTaskDto[],
  actorId?: number,
  options?: { productGoal?: string },
): Promise<TaskItem[]> => {
  for (const g of sprintGoals) {
    const n = Number(g.sprintNumber);
    if (!Number.isFinite(n) || n < 1) continue;
    await upsertSprintGoal({
      sprintNumber: n,
      goal: (g.goal ?? '').trim(),
      sprintDueDate: g.sprintDueDate?.trim() || undefined,
    });
  }
  const pg = options?.productGoal?.trim();
  if (pg) await updateProjectSettings({ productGoal: pg });
  return bulkImportTasks(tasks, actorId);
};

export const createSubtask = async (taskId: number, name: string): Promise<SubtaskItem> => {
  const { data, error } = await supabase.from('subtasks').insert({ task_item_id: taskId, name }).select().single();
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

// ── Project settings ───────────────────────────────────────────────────────

function parseSprintDeadlines(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(x => String(x).trim().slice(0, 10)).filter(Boolean);
}

export async function getProjectSettings(): Promise<ProjectSettings> {
  const { data, error } = await supabase.from('project_settings').select('*').eq('id', 1).maybeSingle();
  if (error) err(error, 'Failed to load settings');
  const r = data as {
    product_goal: string;
    website_url: string | null;
    github_url: string | null;
    active_poker_session_id: number | null;
    active_pick_session_id: number | null;
    sprint_count: number | null;
    sprint_deadlines: unknown;
  } | null;
  return {
    productGoal: r?.product_goal ?? '',
    websiteUrl: r?.website_url ?? undefined,
    githubUrl: r?.github_url ?? undefined,
    activePokerSessionId: r?.active_poker_session_id ?? undefined,
    activePickSessionId: r?.active_pick_session_id ?? undefined,
    sprintCount: r?.sprint_count ?? undefined,
    sprintDeadlines: parseSprintDeadlines(r?.sprint_deadlines),
  };
}

export async function updateProjectSettings(p: Partial<ProjectSettings>): Promise<ProjectSettings> {
  const u: Record<string, unknown> = {};
  if (p.productGoal !== undefined) u.product_goal = p.productGoal;
  if (p.websiteUrl !== undefined) u.website_url = p.websiteUrl || null;
  if (p.githubUrl !== undefined) u.github_url = p.githubUrl || null;
  if (p.activePokerSessionId !== undefined) u.active_poker_session_id = p.activePokerSessionId ?? null;
  if (p.activePickSessionId !== undefined) u.active_pick_session_id = p.activePickSessionId ?? null;
  if (p.sprintCount !== undefined) u.sprint_count = Math.max(1, Math.min(50, Number(p.sprintCount) || 1));
  if (p.sprintDeadlines !== undefined) u.sprint_deadlines = p.sprintDeadlines;
  const { error } = await supabase.from('project_settings').update(u).eq('id', 1);
  if (error) err(error, 'Failed to save settings');
  return getProjectSettings();
}

/** Full member rows for admin UI (includes password). */
export async function getMembersForAdmin(): Promise<AdminMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('id,name,email,avatar_initial,color,username,password')
    .order('id');
  if (error) err(error, 'Failed to load members');
  return (data as MemberRow[]).map(r => ({
    ...mapMember(r),
    password: r.password ?? undefined,
  }));
}

async function deleteAllRows(table: string): Promise<void> {
  const { error } = await supabase.from(table).delete().not('id', 'is', null);
  if (error) err(error, `Failed to clear ${table}`);
}

/** Destructive bulk reset (admin). Order handles common FKs. */
export async function adminBulkReset(opts: AdminBulkResetOptions): Promise<void> {
  if (opts.pokerAndPickSessions) {
    await deleteAllRows('pick_sessions');
    await deleteAllRows('poker_sessions');
    await supabase
      .from('project_settings')
      .update({ active_poker_session_id: null, active_pick_session_id: null })
      .eq('id', 1);
  }
  if (opts.tasks) {
    await deleteAllRows('task_items');
  }
  if (opts.quickLinks) await deleteAllRows('quick_links');
  if (opts.resourceItems) await deleteAllRows('resource_items');
  if (opts.sprintGoalsAndReviews) {
    await deleteAllRows('sprint_reviews');
    await deleteAllRows('sprint_goals');
  }
  if (opts.loginItems) await deleteAllRows('login_items');
  if (opts.textNotes) await deleteAllRows('text_notes');
  if (opts.scheduleItems) await deleteAllRows('schedule_items');
}

// ── Sprint goals & reviews ─────────────────────────────────────────────────

export async function getSprintGoals(): Promise<SprintGoal[]> {
  const { data, error } = await supabase.from('sprint_goals').select('*').order('sprint_number');
  if (error) err(error, 'Failed to load sprint goals');
  return (data as { sprint_number: number; goal: string; sprint_due_date: string | null }[]).map(r => ({
    sprintNumber: r.sprint_number,
    goal: r.goal,
    sprintDueDate: r.sprint_due_date ?? undefined,
  }));
}

export async function upsertSprintGoal(g: SprintGoal): Promise<void> {
  const { error } = await supabase.from('sprint_goals').upsert({
    sprint_number: g.sprintNumber,
    goal: g.goal,
    sprint_due_date: g.sprintDueDate ?? null,
  });
  if (error) err(error, 'Failed to save sprint goal');
}

export async function deleteSprintGoal(sprintNumber: number): Promise<void> {
  const { error } = await supabase.from('sprint_goals').delete().eq('sprint_number', sprintNumber);
  if (error) err(error, 'Failed to delete sprint goal');
}

export async function getSprintReviews(sprintNumber: number): Promise<SprintReview[]> {
  const { data, error } = await supabase
    .from('sprint_reviews')
    .select('id,sprint_number,group_member_id,content,created_at, group_members(name,color,avatar_initial)')
    .eq('sprint_number', sprintNumber)
    .order('created_at', { ascending: false });
  if (error) err(error, 'Failed to load reviews');
  return (data as unknown as {
    id: number;
    sprint_number: number;
    group_member_id: number;
    content: string;
    created_at: string;
    group_members: { name: string; color: string | null; avatar_initial: string | null } | null;
  }[]).map(r => ({
    id: Number(r.id),
    sprintNumber: r.sprint_number,
    groupMemberId: r.group_member_id,
    memberName: r.group_members?.name ?? '',
    memberColor: r.group_members?.color ?? undefined,
    memberAvatarInitial: r.group_members?.avatar_initial ?? undefined,
    content: r.content,
    createdAt: r.created_at,
  }));
}

export async function addSprintReview(sprintNumber: number, memberId: number, content: string): Promise<void> {
  const { error } = await supabase.from('sprint_reviews').insert({
    sprint_number: sprintNumber,
    group_member_id: memberId,
    content,
  });
  if (error) err(error, 'Failed to add review');
}

export async function updateSprintReview(reviewId: number, content: string): Promise<void> {
  const { error } = await supabase.from('sprint_reviews').update({ content }).eq('id', reviewId);
  if (error) err(error, 'Failed to update review');
}

export async function deleteSprintReview(reviewId: number): Promise<void> {
  const { error } = await supabase.from('sprint_reviews').delete().eq('id', reviewId);
  if (error) err(error, 'Failed to delete review');
}

// ── Schedule ────────────────────────────────────────────────────────────────

function mapSchedule(r: {
  id: number;
  title: string;
  category: string;
  date: string;
  start_time: string;
  end_time: string;
  owner_member_id: number | null;
  location: string | null;
  notes: string | null;
  created_at: string;
}): ScheduleItem {
  return {
    id: Number(r.id),
    title: r.title,
    category: r.category as ScheduleCategory,
    date: r.date,
    startTime: r.start_time,
    endTime: r.end_time,
    ownerMemberId: r.owner_member_id ?? undefined,
    location: r.location ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
  };
}

export async function getScheduleItemsBetween(start: string, end: string): Promise<ScheduleItem[]> {
  const { data, error } = await supabase
    .from('schedule_items')
    .select('*')
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });
  if (error) err(error, 'Failed to load schedule');
  return (data as Parameters<typeof mapSchedule>[0][]).map(mapSchedule);
}

export async function createScheduleItem(
  d: Omit<ScheduleItem, 'id' | 'createdAt' | 'ownerName' | 'ownerColor'>,
): Promise<ScheduleItem> {
  const { data, error } = await supabase
    .from('schedule_items')
    .insert({
      title: d.title,
      category: d.category,
      date: d.date,
      start_time: d.startTime,
      end_time: d.endTime,
      owner_member_id: d.ownerMemberId ?? null,
      location: d.location ?? null,
      notes: d.notes ?? null,
    })
    .select('*')
    .single();
  if (error || !data) err(error, 'Failed to create');
  return mapSchedule(data as Parameters<typeof mapSchedule>[0]);
}

export async function updateScheduleItem(
  id: number,
  d: Omit<ScheduleItem, 'id' | 'createdAt' | 'ownerName' | 'ownerColor'>,
): Promise<ScheduleItem> {
  const { data, error } = await supabase
    .from('schedule_items')
    .update({
      title: d.title,
      category: d.category,
      date: d.date,
      start_time: d.startTime,
      end_time: d.endTime,
      owner_member_id: d.ownerMemberId ?? null,
      location: d.location ?? null,
      notes: d.notes ?? null,
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error || !data) err(error, 'Failed to update');
  return mapSchedule(data as Parameters<typeof mapSchedule>[0]);
}

export async function deleteScheduleItem(id: number): Promise<void> {
  const { error } = await supabase.from('schedule_items').delete().eq('id', id);
  if (error) err(error, 'Failed to delete');
}

// ── Quick links ────────────────────────────────────────────────────────────

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

export const updateLink = async (id: number, data: Omit<QuickLink, 'id' | 'createdAt' | 'updatedAt'>): Promise<QuickLink> => {
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

// ── Resource rows (sectioned) ───────────────────────────────────────────────

function mapResourceRow(r: {
  id: number;
  title: string;
  description: string | null;
  section: string;
  class_category: string | null;
  category: string | null;
  url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}): ResourceItemRow {
  return {
    id: Number(r.id),
    title: r.title,
    description: r.description ?? undefined,
    section: r.section as ResourceSection,
    classCategory: (r.class_category as ClassLinkCategory) ?? undefined,
    category: r.category ?? undefined,
    url: r.url ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getResourceRows(): Promise<ResourceItemRow[]> {
  const { data, error } = await supabase.from('resource_items').select('*').order('title');
  if (error) err(error, 'Failed to load resources');
  return (data as Parameters<typeof mapResourceRow>[0][]).map(mapResourceRow);
}

export async function createResourceRow(
  d: Omit<ResourceItemRow, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<ResourceItemRow> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('resource_items')
    .insert({
      title: d.title,
      description: d.description ?? null,
      section: d.section,
      class_category: d.classCategory ?? null,
      category: d.category ?? null,
      url: d.url ?? null,
      notes: d.notes ?? null,
      type: 'Other',
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  if (error || !data) err(error, 'Failed to create');
  return mapResourceRow(data as Parameters<typeof mapResourceRow>[0]);
}

export async function updateResourceRow(
  id: number,
  d: Omit<ResourceItemRow, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<ResourceItemRow> {
  const { data, error } = await supabase
    .from('resource_items')
    .update({
      title: d.title,
      description: d.description ?? null,
      section: d.section,
      class_category: d.classCategory ?? null,
      category: d.category ?? null,
      url: d.url ?? null,
      notes: d.notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error || !data) err(error, 'Failed to update');
  return mapResourceRow(data as Parameters<typeof mapResourceRow>[0]);
}

export async function deleteResourceRow(id: number): Promise<void> {
  const { error } = await supabase.from('resource_items').delete().eq('id', id);
  if (error) err(error, 'Failed to delete');
}

// ── Login items & text notes ────────────────────────────────────────────────

export async function getLoginItems(): Promise<LoginItem[]> {
  const { data, error } = await supabase.from('login_items').select('*').order('sort_order').order('label');
  if (error) err(error, 'Failed to load logins');
  return (data as {
    id: number;
    label: string;
    username: string;
    password: string;
    url: string | null;
    notes: string | null;
    sort_order: number;
  }[]).map(r => ({
    id: Number(r.id),
    label: r.label,
    username: r.username,
    password: r.password,
    url: r.url ?? undefined,
    notes: r.notes ?? undefined,
    sortOrder: r.sort_order,
  }));
}

export async function saveLoginItem(d: Omit<LoginItem, 'id'> & { id?: number }): Promise<LoginItem> {
  if (d.id) {
    const { data, error } = await supabase
      .from('login_items')
      .update({
        label: d.label,
        username: d.username,
        password: d.password,
        url: d.url ?? null,
        notes: d.notes ?? null,
        sort_order: d.sortOrder,
      })
      .eq('id', d.id)
      .select()
      .single();
    if (error || !data) err(error, 'Failed to update');
    const r = data as { id: number; label: string; username: string; password: string; url: string | null; notes: string | null; sort_order: number };
    return {
      id: Number(r.id),
      label: r.label,
      username: r.username,
      password: r.password,
      url: r.url ?? undefined,
      notes: r.notes ?? undefined,
      sortOrder: r.sort_order,
    };
  }
  const { data, error } = await supabase
    .from('login_items')
    .insert({
      label: d.label,
      username: d.username,
      password: d.password,
      url: d.url ?? null,
      notes: d.notes ?? null,
      sort_order: d.sortOrder,
    })
    .select()
    .single();
  if (error || !data) err(error, 'Failed to create');
  const r = data as { id: number; label: string; username: string; password: string; url: string | null; notes: string | null; sort_order: number };
  return {
    id: Number(r.id),
    label: r.label,
    username: r.username,
    password: r.password,
    url: r.url ?? undefined,
    notes: r.notes ?? undefined,
    sortOrder: r.sort_order,
  };
}

export async function deleteLoginItem(id: number): Promise<void> {
  const { error } = await supabase.from('login_items').delete().eq('id', id);
  if (error) err(error, 'Failed to delete');
}

export async function getTextNotes(): Promise<TextNote[]> {
  const { data, error } = await supabase.from('text_notes').select('*').order('updated_at', { ascending: false });
  if (error) err(error, 'Failed to load notes');
  return (data as { id: number; title: string; body: string; updated_at: string }[]).map(r => ({
    id: Number(r.id),
    title: r.title,
    body: r.body,
    updatedAt: r.updated_at,
  }));
}

export async function saveTextNote(d: Omit<TextNote, 'id' | 'updatedAt'> & { id?: number }): Promise<TextNote> {
  const now = new Date().toISOString();
  if (d.id) {
    const { data, error } = await supabase
      .from('text_notes')
      .update({ title: d.title, body: d.body, updated_at: now })
      .eq('id', d.id)
      .select()
      .single();
    if (error || !data) err(error, 'Failed to update');
    const r = data as { id: number; title: string; body: string; updated_at: string };
    return { id: Number(r.id), title: r.title, body: r.body, updatedAt: r.updated_at };
  }
  const { data, error } = await supabase.from('text_notes').insert({ title: d.title, body: d.body }).select().single();
  if (error || !data) err(error, 'Failed to create');
  const r = data as { id: number; title: string; body: string; updated_at: string };
  return { id: Number(r.id), title: r.title, body: r.body, updatedAt: r.updated_at };
}

export async function deleteTextNote(id: number): Promise<void> {
  const { error } = await supabase.from('text_notes').delete().eq('id', id);
  if (error) err(error, 'Failed to delete');
}

// ── Planning poker (shared session) ────────────────────────────────────────

const pokerDeck = [0, 1, 2, 3, 5, 8, 13];

export type PokerSessionState = {
  id: number;
  filterAllTasks: boolean;
  sprintNumber: number | null;
  currentTaskId: number | null;
  taskQueue: number[];
  currentIndex: number;
  phase: 'ready' | 'voting' | 'revealed';
  readyMemberIds: number[];
  votes: { memberId: number; value: number | null }[];
  memberCount: number;
};

async function fetchPokerState(sessionId: number, memberCount: number): Promise<PokerSessionState> {
  const { data: s, error } = await supabase.from('poker_sessions').select('*').eq('id', sessionId).single();
  if (error || !s) err(error, 'Session not found');
  const row = s as {
    id: number;
    filter_all_tasks: boolean;
    sprint_number: number | null;
    task_queue: number[];
    current_index: number;
    phase: string;
  };
  const queue = Array.isArray(row.task_queue) ? row.task_queue.map(Number) : JSON.parse(JSON.stringify(row.task_queue || []));
  const currentTaskId = queue[row.current_index] ?? null;
  const { data: ready } = await supabase.from('poker_ready').select('group_member_id').eq('session_id', sessionId);
  const { data: votes } = await supabase
    .from('poker_votes')
    .select('group_member_id,value')
    .eq('session_id', sessionId)
    .eq('task_item_id', currentTaskId ?? -1);
  return {
    id: Number(row.id),
    filterAllTasks: row.filter_all_tasks,
    sprintNumber: row.sprint_number,
    currentTaskId,
    taskQueue: queue,
    currentIndex: row.current_index,
    phase: row.phase as PokerSessionState['phase'],
    readyMemberIds: (ready ?? []).map((r: { group_member_id: number }) => Number(r.group_member_id)),
    votes: (votes ?? []).map((v: { group_member_id: number; value: number | null }) => ({
      memberId: Number(v.group_member_id),
      value: v.value,
    })),
    memberCount,
  };
}

export async function startPokerSession(allTasks: boolean, sprintNumber: number | null, tasks: TaskItem[]): Promise<number> {
  const queue = tasks
    .filter(t => allTasks || (sprintNumber != null && t.sprintNumber === sprintNumber))
    .map(t => t.id);
  const { data: session, error } = await supabase
    .from('poker_sessions')
    .insert({
      filter_all_tasks: allTasks,
      sprint_number: sprintNumber,
      task_queue: queue,
      current_index: 0,
      phase: 'ready',
    })
    .select('id')
    .single();
  if (error || !session) err(error, 'Failed to start poker');
  const id = Number((session as { id: number }).id);
  await updateProjectSettings({ activePokerSessionId: id });
  return id;
}

export async function getActivePokerSession(memberCount: number): Promise<PokerSessionState | null> {
  const settings = await getProjectSettings();
  if (!settings.activePokerSessionId) return null;
  try {
    return await fetchPokerState(settings.activePokerSessionId, memberCount);
  } catch {
    await updateProjectSettings({ activePokerSessionId: undefined });
    return null;
  }
}

export async function pokerMarkReady(sessionId: number, memberId: number, memberCount: number): Promise<PokerSessionState> {
  await supabase.from('poker_ready').upsert({ session_id: sessionId, group_member_id: memberId }, { onConflict: 'session_id,group_member_id' });
  return fetchPokerState(sessionId, memberCount);
}

/** Move from ready to voting (any participant can start after people mark ready). */
export async function pokerStartVoting(sessionId: number, memberCount: number): Promise<PokerSessionState> {
  const st = await fetchPokerState(sessionId, memberCount);
  if (st.phase !== 'ready') return st;
  await supabase.from('poker_sessions').update({ phase: 'voting' }).eq('id', sessionId);
  return fetchPokerState(sessionId, memberCount);
}

export async function pokerSubmitVote(sessionId: number, taskId: number, memberId: number, value: number, memberCount: number): Promise<PokerSessionState> {
  if (!pokerDeck.includes(value)) throw new Error('Invalid card');
  await supabase.from('poker_votes').upsert(
    { session_id: sessionId, task_item_id: taskId, group_member_id: memberId, value },
    { onConflict: 'session_id,task_item_id,group_member_id' },
  );
  const st = await fetchPokerState(sessionId, memberCount);
  const submitted = st.votes.filter(v => v.value != null).length;
  const needVotes = Math.max(1, st.readyMemberIds.length);
  if (st.phase === 'voting' && submitted >= needVotes) {
    await supabase.from('poker_sessions').update({ phase: 'revealed' }).eq('id', sessionId);
    return fetchPokerState(sessionId, memberCount);
  }
  return st;
}

export async function pokerNextTask(sessionId: number, memberCount: number): Promise<PokerSessionState | null> {
  const { data: s } = await supabase.from('poker_sessions').select('*').eq('id', sessionId).single();
  if (!s) return null;
  const row = s as { current_index: number; task_queue: number[] };
  const queue = Array.isArray(row.task_queue) ? row.task_queue : [];
  const next = row.current_index + 1;
  if (next >= queue.length) {
    await supabase.from('poker_votes').delete().eq('session_id', sessionId);
    await supabase.from('poker_ready').delete().eq('session_id', sessionId);
    await supabase.from('poker_sessions').delete().eq('id', sessionId);
    await updateProjectSettings({ activePokerSessionId: undefined });
    return null;
  }
  await supabase.from('poker_votes').delete().eq('session_id', sessionId);
  await supabase.from('poker_sessions').update({ current_index: next, phase: 'voting' }).eq('id', sessionId);
  return fetchPokerState(sessionId, memberCount);
}

export async function pokerApplyEvaluation(taskId: number, value: number, actorId?: number): Promise<TaskItem> {
  return patchTaskFields(
    taskId,
    { evaluation: value },
    actorId,
    'EvaluationAdded',
    `Planning poker evaluation set to ${value}`,
  );
}

export function pokerModeValue(votes: { value: number | null }[]): number | null {
  const vals = votes.map(x => x.value).filter((x): x is number => x != null);
  if (vals.length === 0) return null;
  const freq = new Map<number, number>();
  for (const v of vals) freq.set(v, (freq.get(v) ?? 0) + 1);
  let bestK = vals[0];
  let bestN = 0;
  freq.forEach((n, k) => {
    if (n > bestN || (n === bestN && k < bestK)) {
      bestN = n;
      bestK = k;
    }
  });
  return bestK;
}

// ── Pick tasks session ─────────────────────────────────────────────────────

export type PickSessionState = {
  id: number;
  filterAllTasks: boolean;
  sprintNumber: number | null;
  currentTaskId: number | null;
  taskQueue: number[];
  currentIndex: number;
  phase: 'ready' | 'rating' | 'revealed';
  readyMemberIds: number[];
  ratings: { memberId: number; rating: number | null }[];
  memberCount: number;
};

async function fetchPickState(sessionId: number, memberCount: number): Promise<PickSessionState> {
  const { data: s, error } = await supabase.from('pick_sessions').select('*').eq('id', sessionId).single();
  if (error || !s) err(error, 'Pick session not found');
  const row = s as {
    id: number;
    filter_all_tasks: boolean;
    sprint_number: number | null;
    task_queue: number[];
    current_index: number;
    phase: string;
  };
  const queue = Array.isArray(row.task_queue) ? row.task_queue.map(Number) : [];
  const currentTaskId = queue[row.current_index] ?? null;
  const { data: ready } = await supabase.from('pick_ready').select('group_member_id').eq('session_id', sessionId);
  const { data: ratings } = await supabase
    .from('pick_ratings')
    .select('group_member_id,rating')
    .eq('session_id', sessionId)
    .eq('task_item_id', currentTaskId ?? -1);
  return {
    id: Number(row.id),
    filterAllTasks: row.filter_all_tasks,
    sprintNumber: row.sprint_number,
    currentTaskId,
    taskQueue: queue,
    currentIndex: row.current_index,
    phase: row.phase as PickSessionState['phase'],
    readyMemberIds: (ready ?? []).map((r: { group_member_id: number }) => Number(r.group_member_id)),
    ratings: (ratings ?? []).map((r: { group_member_id: number; rating: number | null }) => ({
      memberId: Number(r.group_member_id),
      rating: r.rating,
    })),
    memberCount,
  };
}

export async function startPickSession(allTasks: boolean, sprintNumber: number | null, tasks: TaskItem[]): Promise<number> {
  const queue = tasks
    .filter(t => allTasks || (sprintNumber != null && t.sprintNumber === sprintNumber))
    .map(t => t.id);
  const { data: session, error } = await supabase
    .from('pick_sessions')
    .insert({
      filter_all_tasks: allTasks,
      sprint_number: sprintNumber,
      task_queue: queue,
      current_index: 0,
      phase: 'ready',
    })
    .select('id')
    .single();
  if (error || !session) err(error, 'Failed to start pick session');
  const id = Number((session as { id: number }).id);
  await updateProjectSettings({ activePickSessionId: id });
  return id;
}

export async function getActivePickSession(memberCount: number): Promise<PickSessionState | null> {
  const settings = await getProjectSettings();
  if (!settings.activePickSessionId) return null;
  try {
    return await fetchPickState(settings.activePickSessionId, memberCount);
  } catch {
    await updateProjectSettings({ activePickSessionId: undefined });
    return null;
  }
}

export async function pickMarkReady(sessionId: number, memberId: number, memberCount: number): Promise<PickSessionState> {
  await supabase.from('pick_ready').upsert({ session_id: sessionId, group_member_id: memberId }, { onConflict: 'session_id,group_member_id' });
  return fetchPickState(sessionId, memberCount);
}

export async function pickStartRating(sessionId: number, memberCount: number): Promise<PickSessionState> {
  const st = await fetchPickState(sessionId, memberCount);
  if (st.phase !== 'ready') return st;
  await supabase.from('pick_sessions').update({ phase: 'rating' }).eq('id', sessionId);
  return fetchPickState(sessionId, memberCount);
}

export async function pickSubmitRating(sessionId: number, taskId: number, memberId: number, rating: number, memberCount: number): Promise<PickSessionState> {
  if (rating < 1 || rating > 10) throw new Error('Rating 1–10');
  await supabase.from('pick_ratings').upsert(
    { session_id: sessionId, task_item_id: taskId, group_member_id: memberId, rating },
    { onConflict: 'session_id,task_item_id,group_member_id' },
  );
  const st = await fetchPickState(sessionId, memberCount);
  const submitted = st.ratings.filter(r => r.rating != null).length;
  const needRatings = Math.max(1, st.readyMemberIds.length);
  if (st.phase === 'rating' && submitted >= needRatings) {
    await supabase.from('pick_sessions').update({ phase: 'revealed' }).eq('id', sessionId);
    return fetchPickState(sessionId, memberCount);
  }
  return st;
}

export async function pickNextTask(sessionId: number, memberCount: number): Promise<PickSessionState | null> {
  const { data: s } = await supabase.from('pick_sessions').select('*').eq('id', sessionId).single();
  if (!s) return null;
  const row = s as { current_index: number; task_queue: number[] };
  const queue = Array.isArray(row.task_queue) ? row.task_queue : [];
  const next = row.current_index + 1;
  if (next >= queue.length) {
    await supabase.from('pick_ratings').delete().eq('session_id', sessionId);
    await supabase.from('pick_ready').delete().eq('session_id', sessionId);
    await supabase.from('pick_sessions').delete().eq('id', sessionId);
    await updateProjectSettings({ activePickSessionId: undefined });
    return null;
  }
  await supabase.from('pick_ratings').delete().eq('session_id', sessionId);
  await supabase.from('pick_sessions').update({ current_index: next, phase: 'rating' }).eq('id', sessionId);
  return fetchPickState(sessionId, memberCount);
}

// Legacy comfort ratings (optional — table still exists)
export const submitRating = async (taskId: number, memberId: number, ratingValue: number): Promise<TaskRating> => {
  if (ratingValue < 1 || ratingValue > 10) throw new Error('Rating must be 1–10.');
  const now = new Date().toISOString();
  await supabase.from('task_ratings').upsert(
    { task_item_id: taskId, group_member_id: memberId, rating_value: ratingValue, updated_at: now },
    { onConflict: 'task_item_id,group_member_id' },
  );
  const { data: m } = await supabase.from('group_members').select('name,color').eq('id', memberId).single();
  const { data: row } = await supabase.from('task_ratings').select('id,rating_value').eq('task_item_id', taskId).eq('group_member_id', memberId).single();
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
  const assigns = t.task_assignments ?? [];
  return {
    taskItemId: Number(t.id),
    taskName: t.name,
    ratings,
    highestScoringMemberId: top?.groupMemberId,
    highestScoringMemberName: top?.memberName,
    currentAssigneeIds: assigns.map(a => Number(a.group_member_id)),
  };
}

export const getGameResults = async (): Promise<TaskRatingSummary[]> => {
  const { data, error } = await supabase.from('task_items').select(`
      id, name,
      task_ratings ( id, task_item_id, group_member_id, rating_value, group_members ( name, color ) ),
      task_assignments ( group_member_id )
    `);
  if (error) err(error, 'Failed to load game results');
  return (data as unknown as GameTaskRow[]).map(mapGameSummary);
};
