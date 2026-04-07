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
  sortOrder: number;
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
  sortOrder: number;
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
  /** Configured sprint count (admin). Tabs show 1..sprintCount. */
  sprintCount?: number;
  /** Per-sprint deadlines YYYY-MM-DD; index 0 = sprint 1. */
  sprintDeadlines?: string[];
}

/** Member row including password for admin UI only. */
export interface AdminMember extends GroupMember {
  password?: string;
}

export interface AdminBulkResetOptions {
  tasks?: boolean;
  quickLinks?: boolean;
  resourceItems?: boolean;
  sprintGoalsAndReviews?: boolean;
  loginItems?: boolean;
  textNotes?: boolean;
  scheduleItems?: boolean;
  pokerAndPickSessions?: boolean;
}

export interface SprintGoal {
  sprintNumber: number;
  goal: string;
  sprintDueDate?: string;
  productOwner?: string;
  scrumMaster?: string;
  /** When true, sprint page shows product owner and scrum master for this sprint. */
  showRolesOnSprintPage?: boolean;
}

export type SprintReviewKind = 'well' | 'improve';

export interface SprintReview {
  id: number;
  sprintNumber: number;
  groupMemberId: number;
  memberName: string;
  memberColor?: string;
  memberAvatarInitial?: string;
  content: string;
  reviewKind: SprintReviewKind;
  createdAt: string;
}

/** Course rubric buckets on the Rubric checklist page. */
export type RubricSection = '401' | '413' | '414' | '455' | 'presentation';

export const RUBRIC_SECTIONS: readonly RubricSection[] = ['401', '413', '414', '455', 'presentation'];

export interface RubricRequirement {
  id: number;
  section: RubricSection;
  body: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  /** Set when loaded with a member id: whether that member checked this off. */
  completedByMe?: boolean;
}

/** One row from AI bulk-import JSON (`text` or `body`). */
export interface BulkImportRubricItemDto {
  section: RubricSection;
  text?: string;
  body?: string;
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
  /** Overall product vision; saved to project_settings.product_goal on import when present. */
  productGoal?: string;
  sprintGoals: BulkImportSprintGoalDto[];
  tasks: BulkImportTaskDto[];
}

/** Fixed Mon–Fri range shown on the team schedule (course week). */
export const SCHEDULE_VIEW_START = '2026-04-06';
export const SCHEDULE_VIEW_END = '2026-04-10';

export const POKER_DECK = [0, 1, 2, 3, 5, 8, 13] as const;
