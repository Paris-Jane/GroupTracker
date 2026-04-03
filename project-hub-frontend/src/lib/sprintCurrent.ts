import type { SprintGoal, TaskItem } from '../types';

/** Merge admin-configured sprint deadlines into goal rows when a goal has no due date yet. */
export function mergeGoalsWithAdminDeadlines(
  goals: SprintGoal[],
  adminDeadlines: string[] | undefined,
  maxS: number,
): SprintGoal[] {
  const byNum = new Map<number, SprintGoal>();
  for (const g of goals) {
    byNum.set(g.sprintNumber, { ...g });
  }
  if (adminDeadlines?.length) {
    for (let i = 0; i < adminDeadlines.length && i < maxS; i++) {
      const n = i + 1;
      const raw = adminDeadlines[i]?.trim();
      if (!raw) continue;
      const ex = byNum.get(n);
      if (ex && ex.sprintDueDate?.trim()) continue;
      byNum.set(n, {
        sprintNumber: n,
        goal: ex?.goal ?? '',
        sprintDueDate: raw.includes('T') ? raw.split('T')[0] : raw,
      });
    }
  }
  return [...byNum.values()];
}

export function parseLocalDate(s: string) {
  const [y, m, d] = s.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function startOfLocalDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export function endOfLocalDayFromIso(s: string) {
  const x = parseLocalDate(s);
  x.setHours(23, 59, 59, 999);
  return x.getTime();
}

/** Matches Scrum board logic: current sprint from goal due dates and tasks. */
export function inferCurrentSprintNumber(
  goals: SprintGoal[],
  tasks: TaskItem[],
  maxS: number,
  adminDeadlines?: string[],
): number {
  const merged = mergeGoalsWithAdminDeadlines(goals, adminDeadlines, maxS);
  const taskMax = Math.max(0, ...tasks.map(t => t.sprintNumber ?? 0));
  const goalNums = merged.map(g => g.sprintNumber);
  const floor = Math.min(Math.max(1, taskMax, ...goalNums, 1), maxS);

  const withDates = [...merged].filter(g => g.sprintDueDate).sort((a, b) => a.sprintNumber - b.sprintNumber);
  if (withDates.length === 0) return Math.min(Math.max(1, taskMax || 1), maxS);

  const today = startOfLocalDay(new Date());
  for (const g of withDates) {
    if (g.sprintNumber > maxS) continue;
    const end = endOfLocalDayFromIso(g.sprintDueDate!);
    if (today <= end) return g.sprintNumber;
  }
  return floor;
}

/**
 * Day index within the current sprint (1-based). Uses previous sprint's due date + 1 as start;
 * for sprint 1 without a prior due date, estimates from current sprint's due date minus 13 days.
 */
export function computeSprintDayNumber(goals: SprintGoal[], currentSprint: number): number {
  const withDates = [...goals].filter(g => g.sprintDueDate).sort((a, b) => a.sprintNumber - b.sprintNumber);
  const today = startOfLocalDay(new Date());
  const prev = withDates.filter(g => g.sprintNumber < currentSprint).pop();
  let startMs: number | null = null;

  if (prev?.sprintDueDate) {
    const [y, m, d] = prev.sprintDueDate.split('T')[0].split('-').map(Number);
    startMs = startOfLocalDay(new Date(y, m - 1, d + 1));
  } else {
    const cur = withDates.find(g => g.sprintNumber === currentSprint);
    if (cur?.sprintDueDate) {
      const [y, m, d] = cur.sprintDueDate.split('T')[0].split('-').map(Number);
      const endCur = new Date(y, m - 1, d);
      startMs = startOfLocalDay(new Date(endCur.getFullYear(), endCur.getMonth(), endCur.getDate() - 13));
    }
  }

  if (startMs == null) return 1;
  const dayNum = Math.floor((today - startMs) / 86_400_000) + 1;
  return Math.max(1, Math.min(dayNum, 28));
}
