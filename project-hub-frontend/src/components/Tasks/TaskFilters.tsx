import type { CSSProperties, ReactNode } from 'react';
import type { GroupMember, TaskPriority, TaskStatus } from '../../types';
import { resolveMemberColor } from '../../lib/memberColor';
import { assignableMembers } from '../../lib/admin';

export type TasksSortKey = 'deadline' | 'priority' | 'name' | 'updated';

export type TaskColumnKey =
  | 'task'
  | 'sprint'
  | 'deadline'
  | 'status'
  | 'users'
  | 'priority'
  | 'evaluation'
  | 'estimatedTime'
  | 'updated'
  | 'notes';

export const ALL_TASK_COLUMN_KEYS: TaskColumnKey[] = [
  'task',
  'sprint',
  'deadline',
  'status',
  'users',
  'priority',
  'evaluation',
  'estimatedTime',
  'updated',
  'notes',
];

export const DEFAULT_TASK_COLUMN_KEYS: TaskColumnKey[] = ['task', 'sprint', 'deadline', 'status', 'users'];

const COLUMN_LABELS: Record<TaskColumnKey, string> = {
  task: 'Task',
  sprint: 'Sprint',
  deadline: 'Deadline',
  status: 'Status',
  users: 'Users',
  priority: 'Priority',
  evaluation: 'Evaluation',
  estimatedTime: 'Est. time',
  updated: 'Last updated',
  notes: 'Notes',
};

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

const SORT_LABELS: Record<TasksSortKey, string> = {
  deadline: 'Deadline',
  priority: 'Priority',
  name: 'Name',
  updated: 'Last updated',
};

export interface TaskFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  /** Shown between the search bar and the filters button (e.g. New task, Bulk add). */
  toolbarActions?: ReactNode;
  filtersOpen: boolean;
  onToggleFilters: () => void;
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
  advancedOpen: boolean;
  onToggleAdvanced: () => void;
  visibleColumns: TaskColumnKey[];
  onChangeVisibleColumns: (cols: TaskColumnKey[]) => void;
}

export function TaskFilters({
  search,
  onSearchChange,
  toolbarActions,
  filtersOpen,
  onToggleFilters,
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
  advancedOpen,
  onToggleAdvanced,
  visibleColumns,
  onChangeVisibleColumns,
}: TaskFiltersProps) {
  const filterBtnOn = filtersOpen || !!activeSummary;
  const assigneeFilterMembers = assignableMembers(members);

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
          {toolbarActions ? <div className="tasks-filter-toolbar-mid">{toolbarActions}</div> : null}
          <div className="tasks-filter-toolbar-actions">
            <button
              type="button"
              className={`tasks-filter-icon-btn${filterBtnOn ? ' tasks-filter-icon-btn--on' : ''}`}
              onClick={onToggleFilters}
              aria-expanded={filtersOpen}
              aria-label={filtersOpen ? 'Hide filters' : 'Show filters'}
              title="Filters"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
            </button>
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

        {filtersOpen ? (
          <div className="tasks-filter-row-secondary">
            <div className="tasks-filter-groups">
              <div className="tasks-filter-group--two-col">
                <div className="tasks-filter-group tasks-filter-group--sort">
                  <label className="tasks-filter-group-label" htmlFor="tasks-sort">
                    Sort
                  </label>
                  <select
                    id="tasks-sort"
                    className="select-compact tasks-filter-sort-select tasks-filter-sort-select--block"
                    value={sortKey}
                    onChange={e => onSortKey(e.target.value as TasksSortKey)}
                    aria-label="Sort tasks"
                  >
                    {(Object.keys(SORT_LABELS) as TasksSortKey[]).map(k => (
                      <option key={k} value={k}>
                        {SORT_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>
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
              </div>

              <div className="tasks-filter-group--two-col">
                <div className="tasks-filter-group">
                  <span className="tasks-filter-group-label">Sprint</span>
                  {useSprintDropdown ? (
                    <div className="tasks-filter-sprint-dropdown-wrap">
                      {filterSprint !== '' ? (
                        <span className="tasks-filter-sprint-chip">Sprint {filterSprint}</span>
                      ) : null}
                      <select
                        className="select-compact tasks-filter-sprint-select tasks-filter-sprint-select--block"
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
                  {assigneeFilterMembers.map(m => (
                    <MemberAvatarChip
                      key={m.id}
                      member={m}
                      selected={filterAssigneeIds.includes(m.id)}
                      onClick={() => onToggleAssignee(m.id)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="tasks-filter-meta tasks-filter-meta--panel">
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
                    <span className="tasks-filter-result-overdue">{overdueCount} overdue</span>
                  </>
                ) : null}
              </div>
            </div>

            <div className="tasks-filter-advanced-block">
              <button
                type="button"
                className={`btn btn-ghost btn-sm tasks-filter-advanced-btn${advancedOpen ? ' is-on' : ''}`}
                onClick={onToggleAdvanced}
                aria-expanded={advancedOpen}
              >
                Advanced column settings
              </button>
              {advancedOpen ? (
                <div className="tasks-filter-column-grid" role="group" aria-label="Visible columns">
                  <span className="tasks-filter-group-label">Show columns</span>
                  <div className="tasks-filter-column-checks">
                    {ALL_TASK_COLUMN_KEYS.map(key => {
                      const on = visibleColumns.includes(key);
                      return (
                        <label key={key} className="tasks-filter-column-check">
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={key === 'task'}
                            onChange={() => {
                              if (key === 'task') return;
                              const set = new Set(visibleColumns);
                              if (on) set.delete(key);
                              else set.add(key);
                              onChangeVisibleColumns(ALL_TASK_COLUMN_KEYS.filter(k => set.has(k)));
                            }}
                          />
                          {COLUMN_LABELS[key]}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
