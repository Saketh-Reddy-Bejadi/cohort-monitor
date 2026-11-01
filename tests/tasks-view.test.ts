import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dueMatches, filterTasks, groupTasks, ownerNames, ownersOf, parseFilters, summarize,
} from "../lib/planner/tasks-view.ts";
import type { Task } from "../lib/planner/engine.ts";

let n = 0;
const t = (over: Partial<Task> = {}): Task => ({
  key: `c1:s${n++}`, cohortId: "c1", cohortName: "AISE C4", page: "Dark LP", label: "Live",
  text: "Publish the page", date: "2026-11-10", goLive: false, notes: [], tags: [], status: "upcoming", ...over,
});

test("groups: Earlier, Today, Tomorrow, This week, Next week, then months", () => {
  // Wednesday 4 Nov 2026
  const dates = ["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-08", "2026-11-09",
    "2026-11-15", "2026-11-16", "2026-12-01", "2027-01-05"];
  const groups = groupTasks(dates.map((date) => t({ date })), "2026-11-04");
  assert.deepEqual(groups.map((g) => [g.label, g.tasks.map((x) => x.date)]), [
    ["Earlier", ["2026-11-03"]],
    ["Today", ["2026-11-04"]],
    ["Tomorrow", ["2026-11-05"]],
    ["This week", ["2026-11-06", "2026-11-08"]],
    ["Next week", ["2026-11-09", "2026-11-15"]],
    ["November 2026", ["2026-11-16"]],
    ["December 2026", ["2026-12-01"]],
    ["January 2027", ["2027-01-05"]],
  ]);
});

test("on a Sunday, tomorrow is next week and This week is empty", () => {
  // Sunday 8 Nov 2026
  const groups = groupTasks(["2026-11-08", "2026-11-09", "2026-11-10", "2026-11-16"].map((date) => t({ date })), "2026-11-08");
  assert.deepEqual(groups.map((g) => g.label), ["Today", "Tomorrow", "Next week", "November 2026"]);
});

test("empty groups are not returned, and order inside a group is kept", () => {
  assert.deepEqual(groupTasks([], "2026-11-04"), []);
  const a = t({ date: "2026-11-04", text: "a" });
  const b = t({ date: "2026-11-04", text: "b" });
  assert.deepEqual(groupTasks([a, b], "2026-11-04")[0].tasks.map((x) => x.text), ["a", "b"]);
});

const set = () => [
  t({ status: "overdue", owner: "Asha", text: "Publish waitlist", cohortId: "a", cohortName: "A" }),
  t({ status: "today", owner: "Ravi", text: "Review beta", cohortId: "b", cohortName: "B" }),
  t({ status: "upcoming", owner: "asha", text: "Send tools", cohortId: "a", cohortName: "A" }),
  t({ status: "done", owner: "Asha", text: "Request page", cohortId: "a", cohortName: "A" }),
  t({ status: "history", text: "Old thing", cohortId: "b", cohortName: "B" }),
];
const texts = (xs: Task[]) => xs.map((x) => x.text);

test("status filter: open, overdue, done, all", () => {
  assert.deepEqual(texts(filterTasks(set(), { status: "open" }, TODAY)), ["Publish waitlist", "Review beta", "Send tools"]);
  assert.deepEqual(texts(filterTasks(set(), { status: "overdue" }, TODAY)), ["Publish waitlist"]);
  assert.deepEqual(texts(filterTasks(set(), { status: "done" }, TODAY)), ["Request page"]);
  assert.equal(filterTasks(set(), { status: "all" }, TODAY).length, 5);
  assert.equal(filterTasks(set(), {}, TODAY).length, 3); // open by default
});

test("cohort, owner and search filters combine", () => {
  assert.deepEqual(texts(filterTasks(set(), { status: "all", cohort: "a" }, TODAY)), ["Publish waitlist", "Send tools", "Request page"]);
  assert.deepEqual(texts(filterTasks(set(), { status: "all", owner: "ASHA" }, TODAY)), ["Publish waitlist", "Send tools", "Request page"]);
  assert.deepEqual(texts(filterTasks(set(), { status: "all", q: "BETA" }, TODAY)), ["Review beta"]);
  assert.deepEqual(texts(filterTasks(set(), { status: "all", q: "dark lp", cohort: "b" }, TODAY)), ["Review beta", "Old thing"]);
  assert.deepEqual(texts(filterTasks(set(), { status: "open", cohort: "a", owner: "asha", q: "tools" }, TODAY)), ["Send tools"]);
  assert.equal(filterTasks(set(), { status: "all", q: "nothing matches" }, TODAY).length, 0);
});

test("owners list: unique ignoring case, sorted, no empties", () => {
  assert.deepEqual(ownersOf(set()), ["Asha", "Ravi"]);
});

test("counts ignore the status filter but respect the others", () => {
  const all = summarize(set(), {}, TODAY);
  assert.deepEqual(all.counts, { open: 3, overdue: 1, done: 1, all: 5 });
  assert.equal(all.visible.length, 3);
  const a = summarize(set(), { cohort: "a", status: "done" }, TODAY);
  assert.deepEqual(a.counts, { open: 2, overdue: 1, done: 1, all: 3 });
  assert.deepEqual(texts(a.visible), ["Request page"]);
});

test("parseFilters cleans address bar values", () => {
  assert.deepEqual(parseFilters({}), { status: "open", cohort: undefined, owner: undefined, q: undefined, due: undefined });
  assert.equal(parseFilters({ status: "hacked" }).status, "open");
  assert.equal(parseFilters({ status: "overdue" }).status, "overdue");
  assert.equal(parseFilters({ status: ["done", "all"] }).status, "done");
  assert.equal(parseFilters({ q: "  beta  " }).q, "beta");
  assert.equal(parseFilters({ q: "   " }).q, undefined);
  assert.equal(parseFilters({ q: "x".repeat(300) }).q?.length, 100);
  assert.equal(parseFilters({ cohort: "a", owner: "Asha" }).owner, "Asha");
});

// Wednesday 4 Nov 2026. The week runs Mon 2 Nov to Sun 8 Nov.
const TODAY = "2026-11-04";

test("due filter: today, this week (today to Sunday), go-lives in the next 14 days", () => {
  const at = (date: string, over: Partial<Task> = {}) => t({ date, status: "upcoming", ...over });
  assert.equal(dueMatches(at("2026-11-04"), "today", TODAY), true);
  assert.equal(dueMatches(at("2026-11-05"), "today", TODAY), false);
  assert.equal(dueMatches(at("2026-11-03"), "week", TODAY), false); // earlier this week is not "due"
  assert.equal(dueMatches(at("2026-11-04"), "week", TODAY), true);
  assert.equal(dueMatches(at("2026-11-08"), "week", TODAY), true); // Sunday counts
  assert.equal(dueMatches(at("2026-11-09"), "week", TODAY), false);
  assert.equal(dueMatches(at("2026-11-18", { goLive: true }), "golive", TODAY), true); // day 14
  assert.equal(dueMatches(at("2026-11-19", { goLive: true }), "golive", TODAY), false); // day 15
  assert.equal(dueMatches(at("2026-11-04", { goLive: true }), "golive", TODAY), true);
  assert.equal(dueMatches(at("2026-11-03", { goLive: true }), "golive", TODAY), false);
  assert.equal(dueMatches(at("2026-11-10"), "golive", TODAY), false); // not a go-live
});

test("due filter works with the others, and needs today", () => {
  const tasks = [
    t({ date: "2026-11-04", status: "today", text: "a" }),
    t({ date: "2026-11-06", status: "upcoming", text: "b" }),
    t({ date: "2026-11-02", status: "overdue", text: "c" }),
  ];
  assert.deepEqual(texts(filterTasks(tasks, { due: "today" }, TODAY)), ["a"]);
  assert.deepEqual(texts(filterTasks(tasks, { due: "week" }, TODAY)), ["a", "b"]);
  assert.deepEqual(texts(filterTasks(tasks, { due: "week", q: "b" }, TODAY)), ["b"]);
  assert.equal(filterTasks(tasks, {}, TODAY).length, 3); // no due filter
});

test("counts respect the due filter", () => {
  const tasks = [
    t({ date: "2026-11-04", status: "today" }),
    t({ date: "2026-11-02", status: "overdue" }),
    t({ date: "2026-11-04", status: "done" }),
  ];
  const s = summarize(tasks, { due: "today" }, TODAY);
  assert.deepEqual(s.counts, { open: 1, overdue: 0, done: 1, all: 2 });
  assert.equal(s.visible.length, 1);
});

test("parseFilters reads the due filter and ignores unknown values", () => {
  assert.equal(parseFilters({ due: "today" }).due, "today");
  assert.equal(parseFilters({ due: "golive" }).due, "golive");
  assert.equal(parseFilters({ due: "week" }).due, "week");
  assert.equal(parseFilters({ due: "tomorrow" }).due, undefined);
  assert.equal(parseFilters({ due: ["week", "today"] }).due, "week");
});

test("owner names for suggestions: task owners and cohort people, unique, sorted, no empties", () => {
  const tasks = [t({ owner: "Priya" }), t({ owner: "Asha Menon" }), t({ owner: undefined })];
  const cohorts = [
    { poc: "Asha Menon", pm: "Ravi Kumar" },
    { poc: undefined, pm: "  " },
  ];
  assert.deepEqual(ownerNames(tasks, cohorts), ["Asha Menon", "Priya", "Ravi Kumar"]);
  assert.deepEqual(ownerNames([], []), []);
});
