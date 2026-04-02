import type { CSSProperties, ReactNode } from 'react';
import type { GroupMember, TaskPriority, TaskStatus } from '../../types';
import { resolveMemberColor } from '../../lib/memberColor';

export type TasksViewTab = 'all' | 'mine' | 'open' | 'done';
export type TasksSortKey = 'deadline' | 'priority' | 'name' | 'updated';

const PRIORITIES: TaskPriority[] = ['High', 'Medium', 'Low'];

export function memberChipColor(m: GroupMember): string {
  return resolveMemberColor(m.name, m.color);
}

interface FilterPillProps {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  title?: string;
}

export function FilterPill({ selected, onClick, children, className = '', title }: FilterPillProps) {
  return (
    <button
      type="button"
      title={title}
      className={`tasks-filter-pill${selected ? ' tasks-filter-pill--on' : ''}${className ? ` ${className}` : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

interface MemberAvatarChipProps {
  member: GroupMember;
  selected: boolean;
  onClick: () => void;
}

export function MemberAvatarChip({ member, selected, onClick }: MemberAvatarChipProps) {
  const bg = memberChipColor(member);
  const initial = (member.avatarInitial ?? member.name.charAt(0) ?? '?').toUpperCase();
  return (
    <button
      type="button"
      className={`tasks-filter-member-chip${selected ? ' tasks-filter-member-chip--on' : ''}`}
      style={{ '--member-chip-bg': bg } as CSSProperties}
      onClick={onClick}
      title={member.name}
      aria-label={`Filter by ${member.name}`}
      aria-pressed={selected}
    >
      <span className="tasks-filter-member-chip-inner">{initial}</span>
    </button>
  );
}

const STATUS_OPTIONS: { value: TaskStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'NotStarted', label: 'To do' },
  { value: 'InProgress', label: 'In progress' },
  { value: 'Completed', label: 'Done' },
];

const VIEW_LABELS: Record<TasksViewTab, string> = {
  all: 'All',
  mine: 'Mine',
  open: 'Open',
  done: 'Done',
};

const SORT_LABELS: Record<TasksSortKey, string> = {
  deadline: 'Deadline',
  priority: 'Priority',
  name: 'Name',
  updated: 'Last updated',
};

export interface TaskFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  view: TasksViewTab;
  onViewChange: (v: TasksViewTab) => void;
  filterStatus: TaskStatus | '';
  onFilterStatus: (v: TaskStatus | '') => void;
  sprintNumbers: number[];
  useSprintDropdown: boolean;
  filterSprint: number | '';
  onFilterSprint: (v: number | '') => void;
  members: GroupMember[];
  filterAssigneeIds: number[];
  onToggleAssignee: (id: number) => void;
  onClearAssignees: () => void;
  filterPriority: TaskPriority | '';
  onFilterPriority: (v: TaskPriority | '') => void;
  sortKey: TasksSortKey;
  onSortKey: (v: TasksSortKey) => void;
  taskCount: number;
  overdueCount: number;
  activeSummary: string | null;
  onClearAllFilters: () => void;
}

export function TaskFilters({
  search,
  onSearchChange,
  view,
  onViewChange,
  filterStatus,
  onFilterStatus,
  sprintNumbers,
  useSprintDropdown,
  filterSprint,
  onFilterSprint,
  members,
  filterAssigneeIds,
  onToggleAssignee,
  onClearAssignees,
  filterPriority,
  onFilterPriority,
  sortKey,
  onSortKey,
  taskCount,
  overdueCount,
  activeSummary,
  onClearAllFilters,
}: TaskFiltersProps) {
  const views = (['all', 'mine', 'open', 'done'] as TasksViewTab[]).map(v => (
    <button
      key={v}
      type="button"
      className={`tasks-filter-view-btn${view === v ? ' tasks-filter-view-btn--on' : ''}`}
      onClick={() => onViewChange(v)}
    >
      {VIEW_LABELS[v]}
    </button>
  ));

  return (
    <div className="tasks-filter-sticky">
      <div className="tasks-filter-card panel">
        <div className="tasks-filter-row-primary">
          <div className="tasks-filter-search-wrap">
            <label className="visually-hidden" htmlFor="tasks-search">
              Search tasks
            </label>
            <input
              id="tasks-search"
              className="tasks-filter-search"
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Search tasks, notes, or people…"
              autoComplete="off"
            />
            {search ? (
              <button
                type="button"
                className="tasks-filter-search-clear"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
              >
                ×
              </button>
            ) : null}
          </div>
          <div className="tasks-filter-view-tabs" role="tablist" aria-label="Task scope">
            {views}
          </div>
        </div>

        {activeSummary ? (
          <div className="tasks-filter-active-bar">
            <span className="tasks-filter-active-text">{activeSummary}</span>
            <button type="button" className="btn btn-ghost btn-sm tasks-filter-clear-all" onClick={onClearAllFilters}>
              Clear all
            </button>
          </div>
        ) : null}

        <div className="tasks-filter-row-secondary">
          <div className="tasks-filter-groups">
            <div className="tasks-filter-group">
              <span className="tasks-filter-group-label">Status</span>
              <div className="tasks-filter-pill-row">
                {STATUS_OPTIONS.map(({ value, label }) => (
                  <FilterPill
                    key={value || 'all'}
                    selected={filterStatus === value}
                    onClick={() => onFilterStatus(value)}
                  >
                    {label}
                  </FilterPill>
                ))}
              </div>
            </div>

            <div className="tasks-filter-group">
              <span className="tasks-filter-group-label">Sprint</span>
              {useSprintDropdown ? (
                <div className="tasks-filter-sprint-dropdown-wrap">
                  {filterSprint !== '' ? (
                    <span className="tasks-filter-sprint-chip">Sprint {filterSprint}</span>
                  ) : null}
                  <select
                    className="select-compact tasks-filter-sprint-select"
                    value={filterSprint === '' ? '' : String(filterSprint)}
                    onChange={e => onFilterSprint(e.target.value === '' ? '' : Number(e.target.value))}
                    aria-label="Filter by sprint"
                  >
                    <option value="">All sprints</option>
                    {sprintNumbers.map(n => (
                      <option key={n} value={n}>
                        Sprint {n}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="tasks-filter-pill-row">
                  <FilterPill selected={filterSprint === ''} onClick={() => onFilterSprint('')}>
                    All
                  </FilterPill>
                  {sprintNumbers.map(n => (
                    <FilterPill key={n} selected={filterSprint === n} onClick={() => onFilterSprint(n)}>
                      Sprint {n}
                    </FilterPill>
                  ))}
                </div>
              )}
            </div>

            <div className="tasks-filter-group tasks-filter-group--assignees">
              <span className="tasks-filter-group-label">Assignee</span>
              <div className="tasks-filter-assignee-row">
                <button
                  type="button"
                  className={`tasks-filter-member-chip tasks-filter-member-chip--all${filterAssigneeIds.length === 0 ? ' tasks-filter-member-chip--on' : ''}`}
                  onClick={onClearAssignees}
                  title="All assignees"
                  aria-pressed={filterAssigneeIds.length === 0}
                >
                  <span className="tasks-filter-member-chip-inner">All</span>
                </button>
                {members.map(m => (
                  <MemberAvatarChip
                    key={m.id}
                    member={m}
                    selected={filterAssigneeIds.includes(m.id)}
                    onClick={() => onToggleAssignee(m.id)}
                  />
                ))}
              </div>
            </div>

            <div className="tasks-filter-group">
              <span className="tasks-filter-group-label">Priority</span>
              <div className="tasks-filter-pill-row">
                <FilterPill selected={filterPriority === ''} onClick={() => onFilterPriority('')}>
                  All
                </FilterPill>
                {PRIORITIES.map(p => (
                  <FilterPill
                    key={p}
                    selected={filterPriority === p}
                    onClick={() => onFilterPriority(p)}
                    className={
                      p === 'High'
                        ? 'tasks-filter-pill--pri-high'
                        : p === 'Medium'
                          ? 'tasks-filter-pill--pri-medium'
                          : 'tasks-filter-pill--pri-low'
                    }
                  >
                    {p}
                  </FilterPill>
                ))}
              </div>
            </div>
          </div>

          <div className="tasks-filter-meta">
            <div className="tasks-filter-result-summary">
              <span className="tasks-filter-result-count">
                {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
              </span>
              {overdueCount > 0 ? (
                <>
                  <span className="tasks-filter-result-sep" aria-hidden>
                    {' '}
                    •{' '}
                  </span>
                  <span className="tasks-filter-result-overdue">
                    {overdueCount} overdue
                  </span>
                </>
              ) : null}
            </div>
            <div className="tasks-filter-sort">
              <label className="tasks-filter-sort-label" htmlFor="tasks-sort">
                Sort:
              </label>
              <select
                id="tasks-sort"
                className="tasks-filter-sort-select"
                value={sortKey}
                onChange={e => onSortKey(e.target.value as TasksSortKey)}
              >
                {(Object.keys(SORT_LABELS) as TasksSortKey[]).map(k => (
                  <option key={k} value={k}>
                    {SORT_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
