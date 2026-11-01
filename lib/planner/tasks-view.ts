import { addDays, weekStart } from "./dates.ts";
import { ownerMatches, type Task } from "./engine.ts";

export type StatusFilter = "open" | "overdue" | "done" | "all";
export type Filters = { status?: StatusFilter; cohort?: string; owner?: string; q?: string };

const STATUSES: readonly string[] = ["open", "overdue", "done", "all"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type Params = Record<string, string | string[] | undefined>;

/** Clean the values from the address bar. Anything unknown falls back to the default. */
export function parseFilters(sp: Params): Required<Pick<Filters, "status">> & Omit<Filters, "status"> {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const status = first(sp.status);
  const clean = (v: string | undefined, max: number) => {
    const t = v?.trim().slice(0, max);
    return t ? t : undefined;
  };
  return {
    status: status && STATUSES.includes(status) ? (status as StatusFilter) : "open",
    cohort: clean(first(sp.cohort), 60),
    owner: clean(first(sp.owner), 100),
    q: clean(first(sp.q), 100),
  };
}

const isOpen = (t: Task) => t.status === "overdue" || t.status === "today" || t.status === "upcoming";

function matchesStatus(t: Task, status: StatusFilter): boolean {
  switch (status) {
    case "open": return isOpen(t);
    case "overdue": return t.status === "overdue";
    case "done": return t.status === "done";
    case "all": return true;
  }
}

export function filterTasks(tasks: Task[], f: Filters): Task[] {
  const q = f.q?.toLowerCase();
  return tasks.filter((t) => {
    if (!matchesStatus(t, f.status ?? "open")) return false;
    if (f.cohort && t.cohortId !== f.cohort) return false;
    if (f.owner && !ownerMatches(t.owner, f.owner)) return false;
    if (q && ![t.text, t.page, t.label, t.cohortName, t.owner ?? ""].some((s) => s.toLowerCase().includes(q))) return false;
    return true;
  });
}

/** The tasks to show, plus segment counts that respect every filter except status. */
export function summarize(tasks: Task[], f: Filters) {
  const base = filterTasks(tasks, { ...f, status: "all" });
  return {
    visible: filterTasks(tasks, f),
    counts: {
      open: base.filter(isOpen).length,
      overdue: base.filter((t) => t.status === "overdue").length,
      done: base.filter((t) => t.status === "done").length,
      all: base.length,
    },
  };
}

/** Owner names for the filter, unique ignoring case, sorted. */
export function ownersOf(tasks: Task[]): string[] {
  const seen = new Map<string, string>();
  for (const t of tasks) {
    const key = t.owner?.trim().toLowerCase();
    if (key && !seen.has(key)) seen.set(key, t.owner!.trim());
  }
  return [...seen.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, v]) => v);
}

export type TaskGroup = { label: string; tasks: Task[] };

function bucket(date: string, today: string): { label: string; rank: number } {
  if (date < today) return { label: "Earlier", rank: 0 };
  if (date === today) return { label: "Today", rank: 1 };
  if (date === addDays(today, 1)) return { label: "Tomorrow", rank: 2 };
  const week = weekStart(date);
  const thisWeek = weekStart(today);
  if (week === thisWeek) return { label: "This week", rank: 3 };
  if (week === addDays(thisWeek, 7)) return { label: "Next week", rank: 4 };
  const [y, m] = date.split("-").map(Number);
  return { label: `${MONTHS[m - 1]} ${y}`, rank: 5 };
}

/** Earlier, Today, Tomorrow, This week, Next week, then one group per month. Empty groups are left out. */
export function groupTasks(tasks: Task[], today: string): TaskGroup[] {
  const groups = new Map<string, TaskGroup & { rank: number; first: string }>();
  for (const t of tasks) {
    const b = bucket(t.date, today);
    const g = groups.get(b.label) ?? { label: b.label, tasks: [], rank: b.rank, first: t.date };
    g.tasks.push(t);
    if (t.date < g.first) g.first = t.date;
    groups.set(b.label, g);
  }
  return [...groups.values()]
    .sort((a, b) => a.rank - b.rank || (a.first < b.first ? -1 : a.first > b.first ? 1 : 0))
    .map(({ label, tasks }) => ({ label, tasks }));
}
