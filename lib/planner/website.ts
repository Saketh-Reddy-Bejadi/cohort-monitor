import { fmtDate, fmtRupees } from "../format.ts";
import { waitlistDate } from "./anchors.ts";
import { addDays, daysBetween } from "./dates.ts";
import { buildTasks, fillText, type Override } from "./engine.ts";
import type { Rules } from "./rules.ts";
import type { Cohort } from "./types.ts";

export type SiteState = "no-dates" | "archived" | "not-listed" | "waitlist" | "open" | "closed";

/** What the website should say today for one cohort. */
export type SiteView = {
  state: SiteState;
  enrolment: string;
  price?: string;
  classes?: string;
};

export type ChangeId = "waitlist" | "open" | "started" | "standard" | "close";

export type Change = {
  id: ChangeId;
  label: string;
  /** The day the website must change. */
  date: string;
  /** The day the work for this change starts: the earliest task date. */
  prepStart: string;
  /** The task pages whose work leads up to this change. */
  pages: string[];
  checklist: string[];
};

export type NextChange = Change & { inDays: number; prepStarted: boolean };

const date = fmtDate;

function priceLine(c: Cohort, day: string): string {
  if (c.standard_from && day >= c.standard_from) {
    return c.standard_price === undefined ? "Standard price not set" : `Standard price ${fmtRupees(c.standard_price)}`;
  }
  if (c.ic_price === undefined) return "Price not set";
  if (!c.ic_close) return `Inner circle price ${fmtRupees(c.ic_price)}`;
  if (day <= c.ic_close) return `Inner circle price ${fmtRupees(c.ic_price)} until ${date(c.ic_close)}`;
  // Inner circle is over but standard has not started: say so.
  const std = c.standard_price === undefined ? "not set" : fmtRupees(c.standard_price);
  return `Inner circle price ended ${date(c.ic_close)}. Standard price ${std}${c.standard_from ? ` from ${date(c.standard_from)}` : ""}`;
}

function classesLine(c: Cohort, day: string): string {
  if (!c.start) return "Class start date not set";
  if (day < c.start) return `Start ${date(c.start)}`;
  if (day === c.start) return `Start today ${date(c.start)}`;
  return `Started on ${date(c.start)} · homepage card Live Now`; // from start + 1 day
}

/** What the site should show on `today`. */
export function siteView(c: Cohort, today: string): SiteView {
  if (c.status === "archived") return { state: "archived", enrolment: "Archived. Not tracked" };
  if (!c.launch) return { state: "no-dates", enrolment: "No dates yet" };

  const wl = waitlistDate(c);
  let state: SiteState;
  let enrolment: string;
  if (c.enrol_close && today >= c.enrol_close) {
    state = "closed";
    enrolment = "Closed. The call to action goes to the next cohort's waitlist";
  } else if (today >= c.launch) {
    state = "open";
    enrolment = c.enrol_close ? `Open. Closes on ${date(c.enrol_close)}` : "Open. Closing date not set";
  } else if (wl && today >= wl) {
    state = "waitlist";
    enrolment = `Waitlist only. Enrolments open on ${date(c.launch)}`;
  } else {
    return { state: "not-listed", enrolment: "Not on the site yet" };
  }
  return { state, enrolment, price: priceLine(c, today), classes: classesLine(c, today) };
}

type Def = {
  id: ChangeId;
  label: string;
  /** Task pages whose work leads up to this change. */
  pages: string[];
  at: (c: Cohort) => string | undefined;
  checklist: string[];
};

// The checklists are starting wording. Each line is filled in with the cohort's own values.
const DEFS: Def[] = [
  {
    id: "waitlist", label: "Waitlist LP live", pages: ["Waitlist LP"], at: waitlistDate,
    checklist: [
      "The {cohort} waitlist page is live",
      "The homepage card links to the waitlist",
      "The page says enrolments open on {launch}",
    ],
  },
  {
    id: "open", label: "Enrolments open",
    pages: ["Dark LP", "Native LP", "Upgrade LP", "Onboarding", "Tools 1-pager"], at: (c) => c.launch,
    checklist: [
      "The {cohort} pages and homepage card show Enrolments open",
      "The inner circle price {ic} is shown until {ic_close}",
      "Enrolments close on {close}",
      "Classes start on {start}",
      "The Dark LP and the bootcamp detail page show the same dates and prices",
    ],
  },
  {
    id: "started", label: "Show as started", pages: ["Classes start"],
    at: (c) => (c.start ? addDays(c.start, 1) : undefined),
    checklist: [
      "The homepage card shows {cohort} as Live Now",
      "The pages say classes started on {start}",
    ],
  },
  {
    id: "standard", label: "Inner circle ends", pages: ["Standard pricing"], at: (c) => c.standard_from,
    checklist: [
      "The price shows {std} from {std_from}",
      "The inner circle price {ic} is removed",
      "The standard price is the same on every page",
    ],
  },
  {
    id: "close", label: "Enrolments close", pages: ["Enrolment close"], at: (c) => c.enrol_close,
    checklist: [
      "The pages say enrolments closed on {close}",
      "The call to action goes to the next cohort's waitlist",
      "The homepage card no longer offers enrolment",
    ],
  },
];

/**
 * Everything the Website status view needs for one cohort on `today`:
 * what the site should show, the dated changes, and the next one.
 */
export function websiteStatus(input: {
  cohort: Cohort;
  today: string;
  rules?: Rules;
  holidays?: string[];
  overrides?: Record<string, Override>;
}): { view: SiteView; changes: Change[]; next?: NextChange } {
  const { cohort, today } = input;
  const view = siteView(cohort, today);
  if (cohort.status === "archived") return { view, changes: [] };

  // Status does not matter here, only each task's date, so history is not cut off.
  const tasks = buildTasks({
    cohorts: [cohort], today, rules: input.rules, holidays: input.holidays, overrides: input.overrides, trackFrom: "0000-01-01",
  });

  const changes: Change[] = [];
  for (const d of DEFS) {
    const at = d.at(cohort);
    if (!at) continue;
    const dates = tasks.filter((t) => d.pages.includes(t.page)).map((t) => t.date);
    changes.push({
      id: d.id,
      label: d.label,
      date: at,
      prepStart: dates.length > 0 ? dates.reduce((a, b) => (a < b ? a : b)) : at,
      pages: d.pages,
      checklist: d.checklist.map((line) => fillText(line, cohort)),
    });
  }
  changes.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // A change dated today is already live, so the next one is strictly later.
  const upcoming = changes.find((c) => c.date > today);
  const next = upcoming && {
    ...upcoming,
    inDays: daysBetween(today, upcoming.date),
    prepStarted: upcoming.prepStart <= today,
  };
  return { view, changes, next };
}

/**
 * The key a checklist tick is saved under. It starts with the cohort id, so it is cleared
 * with the cohort, and it begins "check-", which no task step id does, so it never clashes.
 */
export function checkKey(cohortId: string, changeId: ChangeId, index: number): string {
  return `${cohortId}:check-${changeId}-${index}`;
}
