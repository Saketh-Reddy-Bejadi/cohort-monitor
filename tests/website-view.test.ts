import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRows, checklistTicks, cohortOptions, pickChange, pickRow, prepText, relativeDays, stepStates, tasksForChange,
} from "../lib/planner/website-view.ts";
import { websiteStatus } from "../lib/planner/website.ts";
import { buildTasks } from "../lib/planner/engine.ts";
import type { Cohort } from "../lib/planner/types.ts";

const TODAY = "2026-11-01";
const cohort = (over: Partial<Cohort> = {}): Cohort => ({
  id: "c1", name: "AISE C4", kind: "Live cohort", status: "active", no_waitlist: false,
  launch: "2026-11-16", start: "2026-11-23", ic_close: "2026-11-30", standard_from: "2026-12-01",
  enrol_close: "2026-12-07", ic_price: 42000, standard_price: 54000, ...over,
});
const bare = (over: Partial<Cohort>): Cohort => ({
  id: "x", name: "X", kind: "Live cohort", status: "active", no_waitlist: false, ...over,
});

const cohorts = [
  cohort({ id: "a", name: "Alpha" }), // next change: waitlist, 6 Nov
  bare({ id: "e", name: "Echo", standard_from: "2026-12-01" }), // next change: 1 Dec
  bare({ id: "c", name: "Charlie" }), // no dates at all
  bare({ id: "b", name: "Bravo" }), // no dates at all
  cohort({ id: "z", name: "Zulu", status: "archived" }),
];

test("rows: active cohorts only; soonest next change first; cohorts with no next change last, by name", () => {
  const rows = buildRows({ cohorts, today: TODAY });
  assert.deepEqual(rows.map((r) => r.cohort.id), ["a", "e", "b", "c"]);
  assert.equal(rows[0].next?.id, "waitlist");
  assert.equal(rows[1].next?.id, "standard");
  assert.equal(rows[2].next, undefined);
  assert.equal(rows[2].view.state, "no-dates");
});

test("rows follow holidays and moved tasks", () => {
  const rows = buildRows({
    cohorts: [cohorts[0]], today: TODAY,
    overrides: { "a:waitlist-request": { date: "2026-11-02", reason: "x" } },
  });
  assert.equal(rows[0].changes.find((c) => c.id === "waitlist")!.prepStart, "2026-11-02");
});

test("pickRow: the one asked for, otherwise the first", () => {
  const rows = buildRows({ cohorts, today: TODAY });
  assert.equal(pickRow(rows, "e")?.cohort.id, "e");
  assert.equal(pickRow(rows, undefined)?.cohort.id, "a");
  assert.equal(pickRow(rows, "nope")?.cohort.id, "a");
  assert.equal(pickRow(rows, "z")?.cohort.id, "a"); // archived is not in the list
  assert.equal(pickRow([], "a"), undefined);
});

test("pickChange: the one asked for, otherwise the next, otherwise the last", () => {
  const row = buildRows({ cohorts: [cohorts[0]], today: TODAY })[0];
  assert.equal(pickChange(row, "close")?.id, "close");
  assert.equal(pickChange(row, undefined)?.id, "waitlist");
  assert.equal(pickChange(row, "nope")?.id, "waitlist");

  const over = buildRows({ cohorts: [cohorts[0]], today: "2027-01-10" })[0];
  assert.equal(over.next, undefined);
  assert.equal(pickChange(over, undefined)?.id, "close");

  const none = buildRows({ cohorts: [cohorts[2]], today: TODAY })[0];
  assert.equal(pickChange(none, undefined), undefined);
});

test("step states: live once its day has come, one next, the rest later", () => {
  const row = buildRows({ cohorts: [cohorts[0]], today: "2026-11-16" })[0];
  assert.deepEqual(stepStates(row, "2026-11-16").map((s) => [s.change.id, s.state]), [
    ["waitlist", "live"], ["open", "live"], ["started", "next"], ["standard", "later"], ["close", "later"],
  ]);
  const early = buildRows({ cohorts: [cohorts[0]], today: "2026-10-01" })[0];
  assert.deepEqual(stepStates(early, "2026-10-01").map((s) => s.state), ["next", "later", "later", "later", "later"]);
  const all = buildRows({ cohorts: [cohorts[0]], today: "2027-01-10" })[0];
  assert.ok(stepStates(all, "2027-01-10").every((s) => s.state === "live"));
});

test("prep text says whether prep has started", () => {
  const started = websiteStatus({ cohort: cohort(), today: "2026-11-10" }).next!; // open, prep 6 Nov
  assert.equal(started.prepStarted, true);
  assert.equal(prepText(started), "Prep started Fri 6 Nov");
  const later = websiteStatus({ cohort: cohort(), today: "2026-10-20" }).next!; // waitlist, prep 30 Oct
  assert.equal(later.prepStarted, false);
  assert.equal(prepText(later), "Prep starts Fri 30 Oct");
});

test("tasks for a change: this cohort's tasks on that change's pages only", () => {
  const cs = [cohort(), cohort({ id: "c2", name: "Other" })];
  const tasks = buildTasks({ cohorts: cs, today: TODAY, trackFrom: "2020-01-01" });
  const { changes } = websiteStatus({ cohort: cs[0], today: TODAY });
  const standard = changes.find((c) => c.id === "standard")!;
  const mine = tasksForChange(tasks, "c1", standard);
  assert.deepEqual(mine.map((t) => t.key), ["c1:standard-request", "c1:standard-beta", "c1:standard-live"]);
  assert.ok(mine.every((t) => t.page === "Standard pricing"));
  const open = tasksForChange(tasks, "c1", changes.find((c) => c.id === "open")!);
  assert.ok(open.length > 0 && open.every((t) => t.cohortId === "c1"));
  assert.ok(open.some((t) => t.page === "Dark LP") && !open.some((t) => t.page === "Standard pricing"));
});

test("checklist ticks: one true or false per item, from the saved marks", () => {
  const { changes } = websiteStatus({ cohort: cohort(), today: TODAY });
  const standard = changes.find((c) => c.id === "standard")!;
  assert.equal(standard.checklist.length, 3);
  const none = checklistTicks({}, "c1", standard);
  assert.deepEqual(none.map((t) => t.done), [false, false, false]);
  const marks = {
    "c1:check-standard-0": { done: true, by: "a@codebasics.io", at: "2026-11-02T10:00:00.000Z" },
    "c1:check-standard-1": { done: false, by: "b@codebasics.io", at: "x" },
    "c1:check-open-2": { done: true, by: "z", at: "y" }, // another change: ignored
  };
  const t = checklistTicks(marks, "c1", standard);
  assert.deepEqual(t.map((x) => x.done), [true, false, false]);
  assert.equal(t[0].by, "a@codebasics.io");
  assert.deepEqual(t.map((x) => x.text), standard.checklist);
});

test("dropdown options: every active cohort, sorted by name ignoring case, with its id", () => {
  const rows = buildRows({
    cohorts: [
      cohort({ id: "zeta-1", name: "zeta batch" }),
      cohort({ id: "aise-c4", name: "AISE C4" }),
      cohort({ id: "ds-c12", name: "Data Science C12" }),
      cohort({ id: "old", name: "Old", status: "archived" }),
    ],
    today: TODAY,
  });
  assert.deepEqual(cohortOptions(rows), [
    { id: "aise-c4", name: "AISE C4" },
    { id: "ds-c12", name: "Data Science C12" },
    { id: "zeta-1", name: "zeta batch" },
  ]);
  assert.deepEqual(cohortOptions([]), []);
});

test("relativeDays words", () => {
  assert.equal(relativeDays(0), "today");
  assert.equal(relativeDays(1), "tomorrow");
  assert.equal(relativeDays(-1), "yesterday");
  assert.equal(relativeDays(12), "in 12 days");
  assert.equal(relativeDays(-5), "5 days ago");
});
