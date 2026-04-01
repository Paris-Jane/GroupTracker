import axios from 'axios';
import type {
  GroupMember, TaskItem, SubtaskItem, QuickLink,
  ResourceItem, RoomReservation, TaskUpdate,
  TaskRating, TaskRatingSummary,
  CreateTaskDto, BulkImportTaskDto,
  TaskStatus,
} from '../types';

const api = axios.create({ baseURL: 'http://localhost:5156/api' });

// ── Group Members ──────────────────────────────────────────────────────────

export const getMembers = () => api.get<GroupMember[]>('/groupmembers').then(r => r.data);

export const createMember = (data: Omit<GroupMember, 'id'>) =>
  api.post<GroupMember>('/groupmembers', data).then(r => r.data);

export const updateMember = (id: number, data: Omit<GroupMember, 'id'>) =>
  api.put<GroupMember>(`/groupmembers/${id}`, data).then(r => r.data);

export const deleteMember = (id: number) =>
  api.delete(`/groupmembers/${id}`);

// ── Tasks ──────────────────────────────────────────────────────────────────

export const getTasks = () => api.get<TaskItem[]>('/tasks').then(r => r.data);

export const getTasksByMember = (memberId: number) =>
  api.get<TaskItem[]>(`/tasks/member/${memberId}`).then(r => r.data);

export const createTask = (data: CreateTaskDto, actorId?: number) =>
  api.post<TaskItem>(`/tasks${actorId ? `?actorId=${actorId}` : ''}`, data).then(r => r.data);

export const updateTask = (id: number, data: Omit<CreateTaskDto, 'assigneeIds' | 'subtaskNames'>, actorId?: number) =>
  api.put<TaskItem>(`/tasks/${id}${actorId ? `?actorId=${actorId}` : ''}`, data).then(r => r.data);

export const deleteTask = (id: number) => api.delete(`/tasks/${id}`);

export const updateTaskStatus = (id: number, status: TaskStatus, actorId?: number) =>
  api.patch<TaskItem>(`/tasks/${id}/status${actorId ? `?actorId=${actorId}` : ''}`, { status }).then(r => r.data);

export const assignTask = (id: number, memberIds: number[], actorId?: number) =>
  api.put<TaskItem>(`/tasks/${id}/assign${actorId ? `?actorId=${actorId}` : ''}`, { memberIds }).then(r => r.data);

export const getRecentUpdates = (count = 15) =>
  api.get<TaskUpdate[]>(`/tasks/updates/recent?count=${count}`).then(r => r.data);

export const bulkImportTasks = (tasks: BulkImportTaskDto[], actorId?: number) =>
  api.post<TaskItem[]>(`/tasks/bulk-import${actorId ? `?actorId=${actorId}` : ''}`, tasks).then(r => r.data);

// ── Subtasks ───────────────────────────────────────────────────────────────

export const createSubtask = (taskId: number, name: string) =>
  api.post<SubtaskItem>(`/tasks/${taskId}/subtasks`, { name }).then(r => r.data);

export const updateSubtask = (subtaskId: number, name: string, isCompleted: boolean) =>
  api.put<SubtaskItem>(`/tasks/subtasks/${subtaskId}`, { name, isCompleted }).then(r => r.data);

export const deleteSubtask = (subtaskId: number) =>
  api.delete(`/tasks/subtasks/${subtaskId}`);

// ── Quick Links ────────────────────────────────────────────────────────────

export const getLinks = () => api.get<QuickLink[]>('/resources/links').then(r => r.data);

export const createLink = (data: Omit<QuickLink, 'id' | 'createdAt' | 'updatedAt'>) =>
  api.post<QuickLink>('/resources/links', data).then(r => r.data);

export const updateLink = (id: number, data: Omit<QuickLink, 'id' | 'createdAt' | 'updatedAt'>) =>
  api.put<QuickLink>(`/resources/links/${id}`, data).then(r => r.data);

export const deleteLink = (id: number) => api.delete(`/resources/links/${id}`);

// ── Resource Items ─────────────────────────────────────────────────────────

export const getResources = () => api.get<ResourceItem[]>('/resources/items').then(r => r.data);

export const createResource = (data: Omit<ResourceItem, 'id' | 'createdAt' | 'updatedAt'>) =>
  api.post<ResourceItem>('/resources/items', data).then(r => r.data);

export const updateResource = (id: number, data: Omit<ResourceItem, 'id' | 'createdAt' | 'updatedAt'>) =>
  api.put<ResourceItem>(`/resources/items/${id}`, data).then(r => r.data);

export const deleteResource = (id: number) => api.delete(`/resources/items/${id}`);

// ── Room Reservations ──────────────────────────────────────────────────────

export const getReservations = () =>
  api.get<RoomReservation[]>('/resources/reservations').then(r => r.data);

export const createReservation = (data: Omit<RoomReservation, 'id' | 'createdAt'>) =>
  api.post<RoomReservation>('/resources/reservations', data).then(r => r.data);

export const updateReservation = (id: number, data: Omit<RoomReservation, 'id' | 'createdAt'>) =>
  api.put<RoomReservation>(`/resources/reservations/${id}`, data).then(r => r.data);

export const deleteReservation = (id: number) =>
  api.delete(`/resources/reservations/${id}`);

// ── Play Game / Ratings ────────────────────────────────────────────────────

export const submitRating = (taskId: number, memberId: number, ratingValue: number) =>
  api.post<TaskRating>(`/game/tasks/${taskId}/rate`, { memberId, ratingValue }).then(r => r.data);

export const getGameResults = () =>
  api.get<TaskRatingSummary[]>('/game/results').then(r => r.data);

export const getTaskGameResult = (taskId: number) =>
  api.get<TaskRatingSummary>(`/game/tasks/${taskId}/results`).then(r => r.data);
