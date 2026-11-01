import { fmtDay } from "../format.ts";
import type { DoneMark, Override, Task } from "./engine.ts";
import type { Cohort } from "./types.ts";
import { checkKey, websiteStatus, type Change, type NextChange, type SiteView } from "./website.ts";

/** One cohort's line on the Website status page. */
export type SiteRow = { cohort: Cohort; view: SiteView; changes: Change[]; next?: NextChange };

/**
 * A row for every active cohort. The cohort whose next website change comes soonest is first.
 * Cohorts with nothing coming up go last, by name.
 */
export function buildRows(input: {
  cohorts: Cohort[];
  today: string;
  holidays?: string[];
  overrides?: Record<string, Override>;
}): SiteRow[] {
  const rows = input.cohorts
    .filter((c) => c.status === "active")
    .map((cohort) => ({
      cohort,
      ...websiteStatus({ cohort, today: input.today, holidays: input.holidays, overrides: input.overrides }),
    }));
  return rows.sort((a, b) => {
    if (a.next && b.next) {
      return a.next.date < b.next.date ? -1 : a.next.date > b.next.date ? 1 : a.cohort.name < b.cohort.name ? -1 : 1;
    }
    if (a.next) return -1;
    if (b.next) return 1;
    return a.cohort.name < b.cohort.name ? -1 : a.cohort.name > b.cohort.name ? 1 : 0;
  });
}

/** The cohort asked for in the address, or the first row when it is missing or unknown. */
export function pickRow(rows: SiteRow[], id?: string): SiteRow | undefined {
  return rows.find((r) => r.cohort.id === id) ?? rows[0];
}

/** The change asked for, otherwise the next one, otherwise the last one that went live. */
export function pickChange(row: SiteRow, id?: string): Change | undefined {
  return row.changes.find((c) => c.id === id) ?? row.next ?? row.changes.at(-1);
}

export type StepState = "live" | "next" | "later";

/** For the stepper: a change is live once its day has come, and one is next. */
export function stepStates(row: SiteRow, today: string): { change: Change; state: StepState }[] {
  return row.changes.map((change) => ({
    change,
    state: change.date <= today ? "live" : change.id === row.next?.id ? "next" : "later",
  }));
}

/** "today", "tomorrow", "in 12 days", "5 days ago". */
export function relativeDays(n: number): string {
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

/** "Prep started Fri 30 Oct" or "Prep starts Fri 6 Nov". */
export function prepText(next: Pick<NextChange, "prepStart" | "prepStarted">): string {
  return `${next.prepStarted ? "Prep started" : "Prep starts"} ${fmtDay(next.prepStart)}`;
}

/** The cohort's tasks on the pages that lead up to this change. */
export function tasksForChange(tasks: Task[], cohortId: string, change: Pick<Change, "pages">): Task[] {
  return tasks.filter((t) => t.cohortId === cohortId && change.pages.includes(t.page));
}

export type CheckTick = { text: string; done: boolean; by?: string; at?: string };

/** One entry per checklist item, ticked or not, from the saved marks. */
export function checklistTicks(
  marks: Record<string, DoneMark>,
  cohortId: string,
  change: Pick<Change, "id" | "checklist">,
): CheckTick[] {
  return change.checklist.map((text, i) => {
    const m = marks[checkKey(cohortId, change.id, i)];
    return { text, done: m?.done === true, by: m?.by, at: m?.at };
  });
}

/** The cohorts for the picker, sorted by name so one is easy to find in a long list. */
export function cohortOptions(rows: SiteRow[]): { id: string; name: string }[] {
  return rows
    .map((r) => ({ id: r.cohort.id, name: r.cohort.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || (a.id < b.id ? -1 : 1));
}
