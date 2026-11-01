import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOverview, firstName, greeting, relativeDays } from "../lib/planner/overview.ts";
import type { Task } from "../lib/planner/engine.ts";
import type { Cohort } from "../lib/planner/types.ts";

// Wednesday 4 Nov 2026. The week runs Mon 2 Nov to Sun 8 Nov.
const TODAY = "2026-11-04";

let n = 0;
const t = (over: Partial<Task> = {}): Task => ({
  key: `c1:s${n++}`, cohortId: "c1", cohortName: "AISE C4", page: "Dark LP", label: "Request",
  text: "Do the thing", date: "2026-11-10", goLive: false, notes: [], tags: [], status: "upcoming", ...over,
});
const cohort = (over: Partial<Cohort> = {}): Cohort => ({
  id: "c1", name: "AISE C4", kind: "Live cohort", status: "active", no_waitlist: false, ...over,
});
const run = (tasks: Task[], cohorts: Cohort[] = [], extra: { upcomingLimit?: number } = {}) =>
  buildOverview({ tasks, cohorts, today: TODAY, ...extra });

test("counts: overdue, due today, this week, go-lives in 14 days", () => {
  const o = run([
    t({ date: "2026-11-02", status: "overdue" }),
    t({ date: "2026-11-03", status: "overdue" }),
    t({ date: "2026-11-04", status: "today" }),
    t({ date: "2026-11-06" }),
    t({ date: "2026-11-08" }),
    t({ date: "2026-11-09" }), // next week
    t({ date: "2026-11-18", goLive: true }), // day 14
    t({ date: "2026-11-19", goLive: true }), // day 15, too far
    t({ date: "2026-11-04", status: "done", goLive: true }),
    t({ date: "2026-10-01", status: "history" }),
  ]);
  assert.deepEqual(o.counts, { overdue: 2, today: 1, thisWeek: 3, goLives14: 1 });
});

test("this week on a Sunday is just today", () => {
  const o = buildOverview({
    today: "2026-11-08", cohorts: [],
    tasks: [t({ date: "2026-11-08", status: "today" }), t({ date: "2026-11-09" })],
  });
  assert.equal(o.counts.thisWeek, 1);
});

test("done and history tasks never count or show", () => {
  const o = run([t({ status: "done", date: "2026-11-04" }), t({ status: "history", date: "2026-10-01" })]);
  assert.deepEqual(o.counts, { overdue: 0, today: 0, thisWeek: 0, goLives14: 0 });
  assert.deepEqual([o.attention, o.upcoming], [[], []]);
});

test("next launch is the nearest launch from today on; archived and undated cohorts are ignored", () => {
  const o = run([], [
    cohort({ id: "a", name: "A", launch: "2026-11-20" }),
    cohort({ id: "b", name: "B", launch: "2026-11-10" }),
    cohort({ id: "c", name: "C", launch: "2026-11-05", status: "archived" }),
    cohort({ id: "d", name: "D" }),
    cohort({ id: "e", name: "E", launch: "2026-10-30" }),
  ]);
  assert.deepEqual(o.nextLaunch, { id: "b", name: "B", launch: "2026-11-10", inDays: 6 });
  assert.equal(run([], []).nextLaunch, undefined);
  assert.equal(run([], [cohort({ launch: "2026-10-30" })]).nextLaunch, undefined);
  assert.equal(run([], [cohort({ launch: TODAY })]).nextLaunch?.inDays, 0);
});

test("launch tiles: the last 21 days and everything ahead, in date order, with task counts", () => {
  const o = run(
    [t({ cohortId: "a", status: "overdue", date: "2026-11-01" }), t({ cohortId: "a", date: "2026-11-20" }),
      t({ cohortId: "a", status: "done", date: "2026-11-01" })],
    [
      cohort({ id: "a", name: "A", launch: "2026-11-04" }),
      cohort({ id: "b", name: "B", launch: "2026-10-14" }), // 21 days ago: in
      cohort({ id: "c", name: "C", launch: "2026-10-13" }), // 22 days ago: out
      cohort({ id: "d", name: "D", launch: "2027-03-01" }),
      cohort({ id: "e", name: "E", launch: "2026-11-02", status: "archived" }),
      cohort({ id: "f", name: "F" }),
    ],
  );
  assert.deepEqual(o.launches.map((l) => [l.id, l.state, l.inDays]), [
    ["b", "launched", -21], ["a", "today", 0], ["d", "upcoming", 117],
  ]);
  const a = o.launches.find((l) => l.id === "a")!;
  assert.deepEqual([a.open, a.overdue], [2, 1]);
});

test("needs attention: overdue and today, one line per cohort page, overdue first", () => {
  const o = run([
    t({ page: "Dark LP", label: "Request", date: "2026-11-02", status: "overdue", text: "Request it" }),
    t({ page: "Dark LP", label: "Build done", date: "2026-11-03", status: "overdue", text: "Build it" }),
    t({ page: "Dark LP", label: "Beta", date: "2026-11-04", status: "today", text: "Review it" }),
    t({ page: "Native LP", label: "Request", date: "2026-11-04", status: "today", text: "Request native" }),
    t({ page: "Waitlist LP", cohortId: "c2", cohortName: "Data Science C12", label: "Live", date: "2026-11-03", status: "overdue", goLive: true, text: "Publish waitlist" }),
    t({ page: "Dark LP", date: "2026-11-06" }), // upcoming: not here
  ]);
  assert.deepEqual(o.attention.map((l) => [l.cohortName, l.page, l.count, l.status, l.date]), [
    ["AISE C4", "Dark LP", 3, "overdue", "2026-11-02"],
    ["Data Science C12", "Waitlist LP", 1, "overdue", "2026-11-03"],
    ["AISE C4", "Native LP", 1, "today", "2026-11-04"],
  ]);
  assert.equal(o.attention[0].text, "3 tasks: Request, Build done, Beta");
  assert.equal(o.attention[1].text, "Publish waitlist");
  assert.equal(o.attention[1].goLive, true);
  assert.equal(o.attention[0].goLive, false);
});

test("a page with only today's tasks reads as today, with any overdue it reads as overdue", () => {
  const o = run([
    t({ page: "A", date: "2026-11-04", status: "today" }),
    t({ page: "B", date: "2026-11-04", status: "today" }),
    t({ page: "B", date: "2026-11-01", status: "overdue" }),
  ]);
  assert.deepEqual(o.attention.map((l) => [l.page, l.status]), [["B", "overdue"], ["A", "today"]]);
});

test("one-off tasks each get their own line, with no cohort name", () => {
  const o = run([
    t({ key: "custom:1", cohortId: "", cohortName: "", page: "One-off", label: "Task", text: "Send brochure", date: "2026-11-03", status: "overdue" }),
    t({ key: "custom:2", cohortId: "", cohortName: "", page: "One-off", label: "Task", text: "Book room", date: "2026-11-04", status: "today" }),
  ]);
  assert.deepEqual(o.attention.map((l) => [l.text, l.cohortName]), [["Send brochure", ""], ["Book room", ""]]);
  assert.equal(new Set(o.attention.map((l) => l.key)).size, 2);
});

test("coming up: the next 14 days only, one line per page, earliest first", () => {
  const o = run([
    t({ page: "Dark LP", label: "Request", date: "2026-11-06", text: "r" }),
    t({ page: "Dark LP", label: "Beta", date: "2026-11-12", text: "b" }),
    t({ page: "Native LP", label: "Request", date: "2026-11-05", text: "n" }),
    t({ page: "Standard pricing", label: "Live", date: "2026-11-18", goLive: true, text: "s" }), // day 14: in
    t({ page: "Late", date: "2026-11-19" }), // day 15: out
    t({ page: "Today", date: "2026-11-04", status: "today" }), // today is not "coming up"
    t({ page: "Over", date: "2026-11-02", status: "overdue" }),
  ]);
  assert.deepEqual(o.upcoming.map((l) => [l.page, l.count, l.date]), [
    ["Native LP", 1, "2026-11-05"], ["Dark LP", 2, "2026-11-06"], ["Standard pricing", 1, "2026-11-18"],
  ]);
  assert.equal(o.upcomingMore, 0);
});

test("coming up is limited, and says how many more there are", () => {
  const tasks = Array.from({ length: 11 }, (_, i) => t({ page: `Page ${String(i).padStart(2, "0")}`, date: "2026-11-10" }));
  const o = run(tasks);
  assert.equal(o.upcoming.length, 8);
  assert.equal(o.upcomingMore, 3);
  const small = run(tasks, [], { upcomingLimit: 3 });
  assert.deepEqual([small.upcoming.length, small.upcomingMore], [3, 8]);
});

test("the same input gives the same overview", () => {
  const tasks = [t({ date: "2026-11-06" }), t({ date: "2026-11-02", status: "overdue" })];
  assert.deepEqual(run(tasks, [cohort({ launch: "2026-11-20" })]), run(tasks, [cohort({ launch: "2026-11-20" })]));
});

test("greeting follows the India hour", () => {
  assert.equal(greeting(5), "Good morning");
  assert.equal(greeting(11), "Good morning");
  assert.equal(greeting(12), "Good afternoon");
  assert.equal(greeting(16), "Good afternoon");
  assert.equal(greeting(17), "Good evening");
  assert.equal(greeting(21), "Good evening");
  assert.equal(greeting(22), "Hello");
  assert.equal(greeting(2), "Hello");
});

test("first name from a full name or an email", () => {
  assert.equal(firstName("Saketh Reddy Bejadi"), "Saketh");
  assert.equal(firstName("  asha menon "), "Asha");
  assert.equal(firstName("saketh.b@codebasics.io"), "Saketh");
  assert.equal(firstName("ravi_kumar@codebasics.io"), "Ravi");
  assert.equal(firstName(""), "there");
  assert.equal(firstName(undefined), "there");
});

test("relative days in plain words", () => {
  assert.equal(relativeDays(0), "today");
  assert.equal(relativeDays(1), "tomorrow");
  assert.equal(relativeDays(-1), "yesterday");
  assert.equal(relativeDays(12), "in 12 days");
  assert.equal(relativeDays(-5), "5 days ago");
  assert.equal(relativeDays(2), "in 2 days");
});
