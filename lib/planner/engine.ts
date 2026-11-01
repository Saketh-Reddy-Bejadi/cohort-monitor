import { fmtDate, fmtRupees } from "../format.ts";
import { addDays, addWorkdays, isWeekend, isWorkday, prevWorkday, weekday, workdaysBetween } from "./dates.ts";
import { anchorDate } from "./anchors.ts";
import { DEFAULT_RULES, type Rules, type Step } from "./rules.ts";
import type { Cohort } from "./types.ts";

export type TaskStatus = "done" | "history" | "overdue" | "today" | "upcoming";
export type DoneMark = { done: boolean; by?: string; at?: string };

/** A moved date for one task, with the reason. `recommended` is the date the rules gave. */
export type Override = { date: string; reason: string; by?: string; at?: string; recommended?: string };

/** A one-off task that is not made by the rules. */
export type Custom = { id: string; title: string; date: string; cohortId?: string; owner?: string };

export const AFTER_GO_LIVE = "After go-live";

export type Task = {
  /** `<cohort id>:<step id>`. Unique, and the key for done marks. */
  key: string;
  cohortId: string;
  cohortName: string;
  page: string;
  label: string;
  text: string;
  owner?: string;
  date: string;
  goLive: boolean;
  notes: string[];
  /** Short flags, for example "After go-live". */
  tags: string[];
  /** Set when someone moved this task. */
  override?: Override;
  /** The date the rules gave before the move. Only set on a moved task. */
  recommended?: string;
  status: TaskStatus;
  done?: DoneMark;
};

/** Tasks due before this date are history. */
export const DEFAULT_TRACK_FROM = "2026-10-19";

/**
 * The cohort that follows `c`: same program, the nearest later launch.
 * Used for the {next} placeholder. None when there is no such cohort.
 */
export function nextCohort(c: Cohort, cohorts: Cohort[]): Cohort | undefined {
  if (!c.program || !c.launch) return undefined;
  const later = cohorts.filter((o) =>
    o.id !== c.id && o.status === "active" && o.program === c.program && !!o.launch && o.launch > c.launch!);
  later.sort((a, b) => (a.launch! < b.launch! ? -1 : a.launch! > b.launch! ? 1 : a.id < b.id ? -1 : 1));
  return later[0];
}

/** Fill {placeholders} from the cohort. A missing value reads as TBD. */
export function fillText(template: string, c: Cohort, next?: Cohort): string {
  const date = (d?: string) => (d ? fmtDate(d) : "TBD");
  const money = (n?: number) => (n === undefined ? "TBD" : fmtRupees(n));
  const values: Record<string, string> = {
    cohort: c.name,
    next: next?.name ?? "TBD",
    pm: c.pm ?? "TBD",
    poc: c.poc ?? "TBD",
    ic: money(c.ic_price),
    std: money(c.standard_price),
    launch: date(c.launch),
    start: date(c.start),
    ic_close: date(c.ic_close),
    std_from: date(c.standard_from),
    close: date(c.enrol_close),
  };
  return template.replace(/\{(\w+)\}/g, (_, k: string) => Object.hasOwn(values, k) ? values[k] : "TBD");
}

export function taskStatus(t: {
  date: string; done?: boolean; today: string; trackFrom: string;
}): TaskStatus {
  if (t.done) return "done";
  if (t.date < t.trackFrom) return "history";
  if (t.date < t.today) return "overdue";
  if (t.date === t.today) return "today";
  return "upcoming";
}

/** For the "My tasks as" filter. Ignores case and extra spaces; never matches an empty name. */
export function ownerMatches(owner: string | undefined, name: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return !!owner && !!norm(name) && norm(owner) === norm(name);
}

type Slot = {
  step: Step;
  order: number;
  /** The date from the rules, after weekend and holiday roll-back. */
  base: string;
  date: string;
  notes: string[];
  tags: string[];
  override?: Override;
  /** Set when an earlier moved step pushed this one. */
  pushedBy?: string;
};

/** The default date for a step, with its roll-back note. */
function baseSlot(step: Step, order: number, anchor: string, holidays: ReadonlySet<string>): Slot {
  const raw = addDays(anchor, step.offset);
  const notes: string[] = [];
  let date = raw;
  if (!isWorkday(raw, holidays)) {
    if (step.goLive) {
      notes.push("Day off: line up someone to publish");
    } else {
      date = prevWorkday(raw, holidays);
      const why = isWeekend(raw) ? "weekend" : "holiday";
      notes.push(`Moved back from ${weekday(raw)} ${fmtDate(raw)} (${why}) to ${weekday(date)} ${fmtDate(date)}`);
    }
  }
  return { step, order, base: date, date, notes, tags: [] };
}

/**
 * Apply moved dates to the steps of one page, in step order.
 * A moved step takes its new date. Later steps on the page keep their usual gap
 * (in working days) after it, but only ever move later. A go-live step is never
 * pushed. If the gaps would pass go-live, the pushed steps are squeezed into the
 * working days that are left. A step that still lands after go-live is tagged.
 */
function schedulePage(
  slots: Slot[], key: (s: Slot) => string, overrides: Record<string, Override>, holidays: ReadonlySet<string>,
): void {
  const live = slots.findLast((s) => s.step.goLive);
  let ref: { from: string; to: string } | undefined;
  const pushed: { slot: Slot; wanted: string; floor: string }[] = [];

  for (const slot of slots) {
    const ov = overrides[key(slot)];
    if (ov) {
      slot.override = ov;
      slot.date = ov.date;
      slot.notes.push(`Moved from ${fmtDate(slot.base)} to ${fmtDate(ov.date)}: ${ov.reason}`);
      ref = { from: slot.base, to: ov.date };
      continue;
    }
    if (!ref || slot.step.goLive) continue;
    const wanted = addWorkdays(ref.to, workdaysBetween(ref.from, slot.base, holidays), holidays);
    if (wanted > slot.base) {
      slot.date = wanted;
      slot.pushedBy = ref.to;
      slot.notes.push(`Pushed from ${fmtDate(slot.base)} to ${fmtDate(wanted)} after an earlier step moved`);
      pushed.push({ slot, wanted, floor: ref.to });
    }
  }
  if (!live) return;

  const liveDate = live.override?.date ?? live.date;
  if (pushed.some((p) => p.wanted > liveDate)) {
    let limit = prevWorkday(liveDate, holidays);
    for (let i = pushed.length - 1; i >= 0; i--) {
      const { slot, wanted, floor } = pushed[i];
      const capped = wanted > limit;
      const date = capped ? (limit > floor ? limit : floor) : wanted;
      if (date !== slot.date) {
        slot.date = date;
        slot.notes.push(`Squeezed to ${fmtDate(date)} to fit before go-live`);
      }
      if (capped) limit = prevWorkday(addDays(date, -1), holidays);
    }
  }
  for (const slot of slots) {
    if (!slot.step.goLive && slot.date > liveDate) slot.tags.push(AFTER_GO_LIVE);
  }
}

/**
 * The tasks for every active cohort. A pure function: the same input always
 * gives the same tasks. `today` is passed in, never read from the clock.
 */
export function buildTasks(input: {
  cohorts: Cohort[];
  today: string;
  rules?: Rules;
  holidays?: string[];
  overrides?: Record<string, Override>;
  customs?: Custom[];
  done?: Record<string, DoneMark>;
  trackFrom?: string;
}): Task[] {
  const {
    cohorts, today, rules = DEFAULT_RULES, overrides = {}, customs = [], done = {},
    trackFrom = DEFAULT_TRACK_FROM,
  } = input;
  const holidays = new Set(input.holidays ?? []);
  const out: { task: Task; order: number }[] = [];

  const push = (t: Omit<Task, "status" | "done">, order: number) => {
    const mark = done[t.key];
    out.push({
      task: {
        ...t,
        status: taskStatus({ date: t.date, done: mark?.done === true, today, trackFrom }),
        ...(mark ? { done: mark } : {}),
      },
      order,
    });
  };

  for (const c of cohorts) {
    if (c.status === "archived") continue;
    const next = nextCohort(c, cohorts);
    const pages = new Map<string, Slot[]>();
    (rules[c.kind] ?? []).forEach((step, order) => {
      const anchor = anchorDate(c, step.anchor);
      if (!anchor) return;
      const list = pages.get(step.page) ?? [];
      list.push(baseSlot(step, order, anchor, holidays));
      pages.set(step.page, list);
    });

    for (const slots of pages.values()) {
      schedulePage(slots, (s) => `${c.id}:${s.step.id}`, overrides, holidays);
      for (const slot of slots) {
        const { step } = slot;
        push({
          key: `${c.id}:${step.id}`,
          cohortId: c.id,
          cohortName: c.name,
          page: step.page,
          label: step.label,
          text: fillText(step.text, c, next),
          owner: step.owner ? c[step.owner] : undefined,
          date: slot.date,
          goLive: step.goLive,
          notes: slot.notes,
          tags: slot.tags,
          ...(slot.override ? { override: slot.override, recommended: slot.base } : {}),
        }, slot.order);
      }
    }
  }

  customs.forEach((x, i) => {
    const c = x.cohortId ? cohorts.find((o) => o.id === x.cohortId) : undefined;
    if (c?.status === "archived") return;
    push({
      key: `custom:${x.id}`,
      cohortId: c?.id ?? "",
      cohortName: c?.name ?? "",
      page: "One-off",
      label: "Task",
      text: x.title,
      owner: x.owner,
      date: x.date,
      goLive: false,
      notes: [],
      tags: [],
    }, 1_000_000 + i);
  });

  out.sort((x, y) => {
    const a = x.task;
    const b = y.task;
    return a.date < b.date ? -1 : a.date > b.date ? 1
      : a.cohortName < b.cohortName ? -1 : a.cohortName > b.cohortName ? 1
      : a.cohortId < b.cohortId ? -1 : a.cohortId > b.cohortId ? 1
      : x.order - y.order;
  });
  return out.map((e) => e.task);
}
