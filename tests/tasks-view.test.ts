import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filterTasks, groupTasks, ownersOf, parseFilters, summarize,
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
  assert.deepEqual(texts(filterTasks(set(), { status: "open" })), ["Publish waitlist", "Review beta", "Send tools"]);
  assert.deepEqual(texts(filterTasks(set(), { status: "overdue" })), ["Publish waitlist"]);
  assert.deepEqual(texts(filterTasks(set(), { status: "done" })), ["Request page"]);
  assert.equal(filterTasks(set(), { status: "all" }).length, 5);
  assert.equal(filterTasks(set(), {}).length, 3); // open by default
});

test("cohort, owner and search filters combine", () => {
  assert.deepEqual(texts(filterTasks(set(), { status: "all", cohort: "a" })), ["Publish waitlist", "Send tools", "Request page"]);
  assert.deepEqual(texts(filterTasks(set(), { status: "all", owner: "ASHA" })), ["Publish waitlist", "Send tools", "Request page"]);
  assert.deepEqual(texts(filterTasks(set(), { status: "all", q: "BETA" })), ["Review beta"]);
  assert.deepEqual(texts(filterTasks(set(), { status: "all", q: "dark lp", cohort: "b" })), ["Review beta", "Old thing"]);
  assert.deepEqual(texts(filterTasks(set(), { status: "open", cohort: "a", owner: "asha", q: "tools" })), ["Send tools"]);
  assert.equal(filterTasks(set(), { status: "all", q: "nothing matches" }).length, 0);
});

test("owners list: unique ignoring case, sorted, no empties", () => {
  assert.deepEqual(ownersOf(set()), ["Asha", "Ravi"]);
});

test("counts ignore the status filter but respect the others", () => {
  const all = summarize(set(), {});
  assert.deepEqual(all.counts, { open: 3, overdue: 1, done: 1, all: 5 });
  assert.equal(all.visible.length, 3);
  const a = summarize(set(), { cohort: "a", status: "done" });
  assert.deepEqual(a.counts, { open: 2, overdue: 1, done: 1, all: 3 });
  assert.deepEqual(texts(a.visible), ["Request page"]);
});

test("parseFilters cleans address bar values", () => {
  assert.deepEqual(parseFilters({}), { status: "open", cohort: undefined, owner: undefined, q: undefined });
  assert.equal(parseFilters({ status: "hacked" }).status, "open");
  assert.equal(parseFilters({ status: "overdue" }).status, "overdue");
  assert.equal(parseFilters({ status: ["done", "all"] }).status, "done");
  assert.equal(parseFilters({ q: "  beta  " }).q, "beta");
  assert.equal(parseFilters({ q: "   " }).q, undefined);
  assert.equal(parseFilters({ q: "x".repeat(300) }).q?.length, 100);
  assert.equal(parseFilters({ cohort: "a", owner: "Asha" }).owner, "Asha");
});
