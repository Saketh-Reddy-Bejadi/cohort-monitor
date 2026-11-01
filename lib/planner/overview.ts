import { addDays, daysBetween } from "./dates.ts";
import type { Task } from "./engine.ts";
import { dueMatches, HORIZON_DAYS, isOpen } from "./tasks-view.ts";
import type { Cohort } from "./types.ts";

export type LaunchTile = {
  id: string;
  name: string;
  launch: string;
  /** Days from today. Negative when the launch is behind us. */
  inDays: number;
  state: "launched" | "today" | "upcoming";
  open: number;
  overdue: number;
};

/** One line for a cohort's page: all its tasks in the window, folded into one. */
export type PageLine = {
  key: string;
  cohortId: string;
  cohortName: string;
  page: string;
  count: number;
  /** The earliest date among the tasks. */
  date: string;
  status: "overdue" | "today" | "upcoming";
  goLive: boolean;
  text: string;
};

export type Overview = {
  counts: { overdue: number; today: number; thisWeek: number; goLives14: number };
  nextLaunch?: { id: string; name: string; launch: string; inDays: number };
  launches: LaunchTile[];
  attention: PageLine[];
  upcoming: PageLine[];
  /** How many more lines "coming up" would show without the limit. */
  upcomingMore: number;
};

/**
 * Fold tasks into one line per cohort page. A one-off task has no page to fold into,
 * so each one keeps its own line.
 */
function toLines(tasks: Task[]): PageLine[] {
  const groups = new Map<string, Task[]>();
  for (const t of tasks) {
    const key = t.page === "One-off" ? t.key : `${t.cohortId}|${t.page}`;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  return [...groups.entries()].map(([key, list]) => {
    const sorted = [...list].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const labels = [...new Set(sorted.map((t) => t.label))];
    const first = sorted[0];
    return {
      key,
      cohortId: first.cohortId,
      cohortName: first.cohortName,
      page: first.page,
      count: sorted.length,
      date: first.date,
      status: sorted.some((t) => t.status === "overdue") ? "overdue" : first.status === "today" ? "today" : "upcoming",
      goLive: sorted.some((t) => t.goLive),
      text: sorted.length === 1 ? first.text : `${sorted.length} tasks: ${labels.join(", ")}`,
    } satisfies PageLine;
  });
}

const RANK = { overdue: 0, today: 1, upcoming: 2 } as const;

/**
 * What the Overview page shows, from the task list and the cohorts. A pure function:
 * the same input always gives the same answer, and `today` is passed in.
 */
export function buildOverview(input: {
  tasks: Task[];
  cohorts: Cohort[];
  today: string;
  /** How many "coming up" lines to keep. Default 8. */
  upcomingLimit?: number;
}): Overview {
  const { tasks, cohorts, today, upcomingLimit = 8 } = input;
  const open = tasks.filter(isOpen);

  const counts = {
    overdue: open.filter((t) => t.status === "overdue").length,
    today: open.filter((t) => t.status === "today").length,
    thisWeek: open.filter((t) => dueMatches(t, "week", today)).length,
    goLives14: open.filter((t) => dueMatches(t, "golive", today)).length,
  };

  const launching = cohorts
    .filter((c): c is Cohort & { launch: string } => c.status === "active" && !!c.launch)
    .sort((a, b) => (a.launch < b.launch ? -1 : a.launch > b.launch ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const ahead = launching.find((c) => c.launch >= today);
  const nextLaunch = ahead && {
    id: ahead.id, name: ahead.name, launch: ahead.launch, inDays: daysBetween(today, ahead.launch),
  };

  const since = addDays(today, -21);
  const launches: LaunchTile[] = launching
    .filter((c) => c.launch >= since)
    .map((c) => {
      const mine = open.filter((t) => t.cohortId === c.id);
      return {
        id: c.id,
        name: c.name,
        launch: c.launch,
        inDays: daysBetween(today, c.launch),
        state: c.launch < today ? "launched" : c.launch === today ? "today" : "upcoming",
        open: mine.length,
        overdue: mine.filter((t) => t.status === "overdue").length,
      };
    });

  const byDate = (a: PageLine, b: PageLine) =>
    a.date < b.date ? -1 : a.date > b.date ? 1
    : a.cohortName < b.cohortName ? -1 : a.cohortName > b.cohortName ? 1
    : a.page < b.page ? -1 : a.page > b.page ? 1 : 0;

  const attention = toLines(open.filter((t) => t.status === "overdue" || t.status === "today"))
    .sort((a, b) => RANK[a.status] - RANK[b.status] || byDate(a, b));

  const horizon = addDays(today, HORIZON_DAYS);
  const comingAll = toLines(open.filter((t) => t.status === "upcoming" && t.date <= horizon)).sort(byDate);

  return {
    counts,
    nextLaunch,
    launches,
    attention,
    upcoming: comingAll.slice(0, upcomingLimit),
    upcomingMore: Math.max(0, comingAll.length - upcomingLimit),
  };
}

/** "Good morning" by the India hour. Late at night it just says hello. */
export function greeting(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 22) return "Good evening";
  return "Hello";
}

/** The first name, from a full name or, when we only have an email, from its first part. */
export function firstName(name: string | undefined): string {
  const t = name?.trim() ?? "";
  if (!t) return "there";
  const word = t.includes("@") ? t.split("@")[0].split(/[._-]/)[0] : t.split(/\s+/)[0];
  return word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : "there";
}

/** "today", "tomorrow", "in 12 days", "5 days ago". */
export function relativeDays(n: number): string {
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}
