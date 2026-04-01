// ── Enums ─────────────────────────────────────────────────────────────────

export type TaskStatus = 'NotStarted' | 'WorkingOnIt' | 'Completed';
export type TaskPriority = 'Low' | 'Medium' | 'High';
export type ResourceType = 'TeacherProvided' | 'Other';

// ── Entities ───────────────────────────────────────────────────────────────

export interface GroupMember {
  id: number;
  name: string;
  email?: string;
  avatarInitial?: string;
  color?: string;
}

export interface SubtaskItem {
  id: number;
  taskItemId: number;
  name: string;
  isCompleted: boolean;
  createdAt: string;
}

export interface TaskAssignment {
  id: number;
  groupMemberId: number;
  memberName: string;
  memberColor?: string;
  memberAvatarInitial?: string;
}

export interface TaskItem {
  id: number;
  name: string;
  description?: string;
  estimatedTime?: string;
  deadline?: string;
  priority: TaskPriority;
  isRequired: boolean;
  status: TaskStatus;
  tags?: string;
  createdAt: string;
  updatedAt: string;
  subtasks: SubtaskItem[];
  assignments: TaskAssignment[];
}

export interface QuickLink {
  id: number;
  title: string;
  url: string;
  category?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceItem {
  id: number;
  title: string;
  description?: string;
  type: ResourceType;
  category?: string;
  url?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoomReservation {
  id: number;
  roomName: string;
  date: string;
  startTime: string;
  endTime: string;
  groupMemberId?: number;
  reservedBy: string;
  notes?: string;
  createdAt: string;
}

export interface TaskUpdate {
  id: number;
  taskItemId: number;
  taskName: string;
  groupMemberId?: number;
  memberName?: string;
  memberColor?: string;
  actionType: string;
  message: string;
  createdAt: string;
}

export interface TaskRating {
  id: number;
  taskItemId: number;
  groupMemberId: number;
  memberName: string;
  memberColor?: string;
  ratingValue: number;
}

export interface TaskRatingSummary {
  taskItemId: number;
  taskName: string;
  ratings: TaskRating[];
  highestScoringMemberId?: number;
  highestScoringMemberName?: string;
  currentAssigneeId?: number;
}

// ── Form DTOs ──────────────────────────────────────────────────────────────

export interface CreateTaskDto {
  name: string;
  description?: string;
  estimatedTime?: string;
  deadline?: string;
  priority: TaskPriority;
  isRequired: boolean;
  status: TaskStatus;
  tags?: string;
  assigneeIds?: number[];
  subtaskNames?: string[];
}

export interface BulkImportTaskDto {
  name: string;
  description?: string;
  estimatedTime?: string;
  deadline?: string;
  priority: TaskPriority;
  isRequired: boolean;
  status: TaskStatus;
  tags?: string;
  subtaskNames?: string[];
  assigneeNames?: string[];
}
