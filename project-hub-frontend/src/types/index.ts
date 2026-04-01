export type TaskStatus = 'NotStarted' | 'InProgress' | 'Completed';
export type TaskPriority = 'Low' | 'Medium' | 'High';
export type TaskCategory = 'ProductBacklog' | 'SprintGoal' | 'SprintBacklog' | 'Other';

export type ResourceSection =
  | 'QuickLink'
  | 'ProjectResource'
  | 'Other'
  | 'ClassLink';

export type ClassLinkCategory = 'PM401' | 'Hilton413' | 'Cyber414' | 'MLR455';

export type ScheduleCategory = 'Room' | 'Meeting' | 'Unavailable' | 'Other';

export interface GroupMember {
  id: number;
  name: string;
  username?: string;
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
  notes?: string;
  estimatedTime?: string;
  deadline?: string;
  priority: TaskPriority;
  isRequired: boolean;
  status: TaskStatus;
  tags?: string;
  sprintNumber?: number;
  category: TaskCategory;
  evaluation?: number;
  definitionOfDone?: string;
  acceptedByPO: boolean;
  isBlocked: boolean;
  blockedReason?: string;
  lastEditedByMemberId?: number;
  lastEditedByName?: string;
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

export interface ResourceItemRow {
  id: number;
  title: string;
  description?: string;
  section: ResourceSection;
  classCategory?: ClassLinkCategory;
  category?: string;
  url?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginItem {
  id: number;
  label: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  sortOrder: number;
}

export interface TextNote {
  id: number;
  title: string;
  body: string;
  updatedAt: string;
}

export interface ScheduleItem {
  id: number;
  title: string;
  category: ScheduleCategory;
  date: string;
  startTime: string;
  endTime: string;
  ownerMemberId?: number;
  ownerName?: string;
  ownerColor?: string;
  location?: string;
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
  memberAvatarInitial?: string;
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
  currentAssigneeIds: number[];
}

export interface ProjectSettings {
  productGoal: string;
  websiteUrl?: string;
  githubUrl?: string;
  activePokerSessionId?: number;
  activePickSessionId?: number;
}

export interface SprintGoal {
  sprintNumber: number;
  goal: string;
  sprintDueDate?: string;
}

export interface SprintReview {
  id: number;
  sprintNumber: number;
  groupMemberId: number;
  memberName: string;
  memberColor?: string;
  memberAvatarInitial?: string;
  content: string;
  createdAt: string;
}

export interface CreateTaskDto {
  name: string;
  notes?: string;
  estimatedTime?: string;
  deadline?: string;
  priority: TaskPriority;
  isRequired: boolean;
  status: TaskStatus;
  tags?: string;
  sprintNumber?: number;
  category: TaskCategory;
  evaluation?: number;
  definitionOfDone?: string;
  acceptedByPO?: boolean;
  isBlocked?: boolean;
  blockedReason?: string;
  assigneeIds?: number[];
  subtaskNames?: string[];
}

/** Sprint goal row returned by AI bulk-import JSON (saved to sprint_goals on import). */
export interface BulkImportSprintGoalDto {
  sprintNumber: number;
  goal: string;
  /** YYYY-MM-DD; should match the sprint deadline you gave the AI */
  sprintDueDate?: string;
}

export interface BulkImportTaskDto {
  name: string;
  notes?: string;
  /** Legacy field from older AI prompts; treated as notes on import */
  description?: string;
  estimatedTime?: string;
  deadline?: string;
  priority: TaskPriority;
  isRequired: boolean;
  status: TaskStatus;
  tags?: string;
  sprintNumber?: number;
  category?: TaskCategory;
  subtaskNames?: string[];
  assigneeNames?: string[];
}

/** Root object when the AI returns sprint goals + tasks together. */
export interface BulkImportAiBundle {
  sprintGoals: BulkImportSprintGoalDto[];
  tasks: BulkImportTaskDto[];
}

export const SCHEDULE_WEEK_START = '2026-04-06';
export const SCHEDULE_WEEK_END = '2026-04-10';

export const POKER_DECK = [0, 1, 2, 3, 5, 8, 13] as const;
