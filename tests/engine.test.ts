import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTasks, fillText, nextCohort, ownerMatches, taskStatus } from "../lib/planner/engine.ts";
import type { Cohort } from "../lib/planner/types.ts";
import type { Rules } from "../lib/planner/rules.ts";

const cohort = (extra: Partial<Cohort> = {}): Cohort => ({
  id: "c1", name: "AISE C4", kind: "Live cohort", status: "active", no_waitlist: false, ...extra,
});
const TODAY = "2026-11-01";
const run = (cohorts: Cohort[], extra: Record<string, unknown> = {}) =>
  buildTasks({ cohorts, today: TODAY, trackFrom: "2026-01-01", ...extra });
const find = (tasks: ReturnType<typeof run>, key: string) => tasks.find((t) => t.key === key);

test("a weekend step rolls back to Friday and says so", () => {
  // launch Mon 16 Nov 2026. Dark request is launch -9 = Sat 7 Nov.
  const t = find(run([cohort({ launch: "2026-11-16" })]), "c1:dark-request")!;
  assert.equal(t.date, "2026-11-06");
  assert.ok(t.notes.some((n) => /Fri/.test(n) && /weekend/i.test(n)), t.notes.join("|"));
  // Beta is launch -1 = Sun 15 Nov, so Fri 13 Nov.
  assert.equal(find(run([cohort({ launch: "2026-11-16" })]), "c1:dark-beta")!.date, "2026-11-13");
});

test("a step on a working day keeps its date and has no note", () => {
  const t = find(run([cohort({ launch: "2026-11-16" })]), "c1:dark-build")!; // launch -3 = Fri 13 Nov
  assert.equal(t.date, "2026-11-13");
  assert.deepEqual(t.notes, []);
});

test("a holiday rolls back to the previous working day", () => {
  const tasks = run([cohort({ launch: "2026-11-16" })], { holidays: ["2026-11-13"] });
  assert.equal(find(tasks, "c1:dark-build")!.date, "2026-11-12"); // Fri 13 is a holiday
  const beta = find(tasks, "c1:dark-beta")!; // Sun 15, Sat 14, holiday 13, so Thu 12
  assert.equal(beta.date, "2026-11-12");
  assert.ok(beta.notes.some((n) => /holiday|weekend/i.test(n)));
});

test("a go-live step keeps its date on a day off and asks for someone to publish", () => {
  const live = find(run([cohort({ launch: "2026-11-14" })]), "c1:dark-live")!; // Sat
  assert.equal(live.date, "2026-11-14");
  assert.equal(live.goLive, true);
  assert.ok(live.notes.some((n) => /line up someone to publish/i.test(n)));
  const ok = find(run([cohort({ launch: "2026-11-16" })]), "c1:dark-live")!; // Mon
  assert.deepEqual(ok.notes, []);
});

test("waitlist date: default is launch -10 for a Live cohort, override wins, off removes it", () => {
  const def = run([cohort({ launch: "2026-11-16" })]);
  assert.equal(find(def, "c1:waitlist-live")!.date, "2026-11-06"); // Fri
  assert.equal(find(def, "c1:waitlist-beta")!.date, "2026-11-04"); // -2
  assert.equal(find(def, "c1:waitlist-request")!.date, "2026-10-30"); // -6 = Sat 31 Oct, back to Fri

  const over = run([cohort({ launch: "2026-11-16", waitlist_live: "2026-11-02" })]);
  assert.equal(find(over, "c1:waitlist-live")!.date, "2026-11-02");

  const off = run([cohort({ launch: "2026-11-16", no_waitlist: true })]);
  assert.equal(off.filter((t) => t.page === "Waitlist LP").length, 0);
});

test("classes start uses the day after start; standard pricing and close use their own dates", () => {
  const tasks = run([cohort({ start: "2026-11-23", standard_from: "2026-12-01", enrol_close: "2026-12-07" })]);
  assert.equal(find(tasks, "c1:started-live")!.date, "2026-11-24");
  assert.equal(find(tasks, "c1:standard-request")!.date, "2026-11-27"); // -2 = Sun 29, back to Fri
  assert.equal(find(tasks, "c1:standard-beta")!.date, "2026-11-30");
  assert.equal(find(tasks, "c1:standard-live")!.date, "2026-12-01");
  assert.equal(find(tasks, "c1:close-confirm")!.date, "2026-12-04");
  assert.equal(find(tasks, "c1:close-beta")!.date, "2026-12-04"); // -2 = Sat 5, back to Fri
  assert.equal(find(tasks, "c1:close-live")!.date, "2026-12-07");
});

test("a step with no anchor date makes no task", () => {
  const none = run([cohort()]);
  assert.equal(none.length, 0);
  const onlyStart = run([cohort({ start: "2026-11-23" })]);
  assert.deepEqual(onlyStart.map((t) => t.key), ["c1:started-live"]);
});

test("archived cohorts make no tasks", () => {
  assert.equal(run([cohort({ launch: "2026-11-16", status: "archived" })]).length, 0);
});

test("pre-recorded bootcamp: Dark LP, Native LP and standard pricing only", () => {
  const tasks = run([cohort({
    kind: "Pre-recorded bootcamp", launch: "2026-11-16", start: "2026-11-23",
    standard_from: "2026-12-01", enrol_close: "2026-12-07",
  })]);
  assert.deepEqual([...new Set(tasks.map((t) => t.page))].sort(), ["Dark LP", "Native LP", "Standard pricing"]);
});

test("self-paced upgrade: Upgrade LP and enrolment close only", () => {
  const tasks = run([cohort({
    kind: "Self-paced upgrade", launch: "2026-11-16", start: "2026-11-23", enrol_close: "2026-12-07",
  })]);
  assert.deepEqual([...new Set(tasks.map((t) => t.page))].sort(), ["Enrolment close", "Upgrade LP"]);
  assert.equal(find(tasks, "c1:upgrade-live")!.date, "2026-11-16");
  assert.equal(find(tasks, "c1:close-request")!.date, "2026-12-04"); // -2 = Sat 5, back to Fri
  assert.equal(find(tasks, "c1:close-live")!.date, "2026-12-07");
});

test("Live cohort: Dark LP also has SEO metadata, one day before launch", () => {
  const tasks = run([cohort({ launch: "2026-11-16" })]);
  assert.equal(find(tasks, "c1:dark-seo")!.date, "2026-11-13");
  assert.equal(find(tasks, "c1:native-seo"), undefined);
  assert.ok(find(tasks, "c1:onboarding-channels"));
  assert.ok(find(tasks, "c1:onboarding-admin"));
  assert.ok(find(tasks, "c1:tools-send"));
});

test("task text and owner use the cohort's own prices, dates and people", () => {
  const t = find(run([cohort({
    launch: "2026-11-16", start: "2026-10-25", ic_price: 42000, standard_price: 54000, poc: "Asha", pm: "Ravi",
  })]), "c1:dark-request")!;
  assert.match(t.text, /AISE C4/);
  assert.match(t.text, /₹42,000/);
  assert.match(t.text, /₹54,000/);
  assert.match(t.text, /25 Oct 2026/);
  assert.equal(t.owner, "Asha");
  const pm = find(run([cohort({ launch: "2026-11-16", pm: "Ravi" })]), "c1:onboarding-channels")!;
  assert.equal(pm.owner, "Ravi");
});

test("missing values read as TBD and never leave a raw placeholder", () => {
  const tasks = run([cohort({ launch: "2026-11-16" })]);
  const t = find(tasks, "c1:dark-request")!;
  assert.match(t.text, /TBD/);
  assert.equal(t.owner, undefined);
  for (const x of tasks) assert.doesNotMatch(x.text, /[{}]/, x.key);
});

test("fillText replaces every known placeholder and keeps unknown braces out", () => {
  const c = cohort({ ic_price: 42000, standard_price: 54000, start: "2026-10-25", standard_from: "2026-11-11", enrol_close: "2026-11-12", pm: "Ravi", poc: "Asha" });
  assert.equal(
    fillText("{cohort} {pm} {poc} {ic} {std} {start} {std_from} {close}", c),
    "AISE C4 Ravi Asha ₹42,000 ₹54,000 25 Oct 2026 11 Nov 2026 12 Nov 2026",
  );
  assert.equal(fillText("{nope}", c), "TBD");
});

test("fillText also knows launch and the inner circle end date", () => {
  const c = cohort({ launch: "2026-11-16", ic_close: "2026-11-30" });
  assert.equal(fillText("{launch} {ic_close}", c), "16 Nov 2026 30 Nov 2026");
  assert.equal(fillText("{launch} {ic_close}", cohort()), "TBD TBD");
});

test("status: done, history, overdue, today, upcoming", () => {
  const base = { today: "2026-11-10", trackFrom: "2026-10-19" };
  assert.equal(taskStatus({ ...base, date: "2026-11-20", done: true }), "done");
  assert.equal(taskStatus({ ...base, date: "2026-10-01", done: true }), "done");
  assert.equal(taskStatus({ ...base, date: "2026-10-18" }), "history");
  assert.equal(taskStatus({ ...base, date: "2026-10-19" }), "overdue"); // on trackFrom is not history
  assert.equal(taskStatus({ ...base, date: "2026-11-09" }), "overdue");
  assert.equal(taskStatus({ ...base, date: "2026-11-10" }), "today");
  assert.equal(taskStatus({ ...base, date: "2026-11-11" }), "upcoming");
});

test("done marks and the track-from date change status", () => {
  const cohorts = [cohort({ launch: "2026-11-16" })];
  const tasks = buildTasks({
    cohorts, today: "2026-11-13", trackFrom: "2026-11-05",
    done: { "c1:dark-build": { done: true, by: "a@codebasics.io", at: "2026-11-12T10:00:00Z" } },
  });
  const byKey = (k: string) => find(tasks, k)!;
  assert.equal(byKey("c1:dark-build").status, "done");
  assert.equal(byKey("c1:dark-build").done?.by, "a@codebasics.io");
  assert.equal(byKey("c1:waitlist-request").status, "history"); // 30 Oct, before 5 Nov
  assert.equal(byKey("c1:dark-beta").status, "today"); // 13 Nov
  assert.equal(byKey("c1:dark-live").status, "upcoming");
  assert.equal(byKey("c1:waitlist-live").status, "overdue"); // 6 Nov
});

test("a done mark with done false does not count", () => {
  const tasks = buildTasks({
    cohorts: [cohort({ launch: "2026-11-16" })], today: "2026-11-20", trackFrom: "2026-01-01",
    done: { "c1:dark-live": { done: false, by: "a", at: "x" } },
  });
  assert.equal(find(tasks, "c1:dark-live")!.status, "overdue");
});

test("tasks are sorted by date, then cohort, and the same input gives the same output", () => {
  const cohorts = [
    cohort({ id: "b", name: "B", launch: "2026-11-16" }),
    cohort({ id: "a", name: "A", launch: "2026-11-16" }),
  ];
  const one = run(cohorts);
  const two = run(cohorts);
  assert.deepEqual(one, two);
  const dates = one.map((t) => t.date);
  assert.deepEqual(dates, [...dates].sort());
  const sameDay = one.filter((t) => t.date === "2026-11-16" && t.page === "Dark LP");
  assert.deepEqual(sameDay.map((t) => t.cohortId), ["a", "b"]);
  assert.equal(new Set(one.map((t) => t.key)).size, one.length, "keys are unique");
});

test("adding another cohort does not change the first cohort's tasks", () => {
  const a = run([cohort({ id: "a", launch: "2026-11-16" })]).filter((t) => t.cohortId === "a");
  const both = run([cohort({ id: "a", launch: "2026-11-16" }), cohort({ id: "z", name: "Z", launch: "2026-12-14" })]).filter((t) => t.cohortId === "a");
  assert.deepEqual(a, both);
});

// launch Mon 16 Nov 2026. Dark LP steps: request Fri 6, build Fri 13, beta Fri 13, SEO Fri 13, live Mon 16.
const dark = (tasks: ReturnType<typeof run>) =>
  Object.fromEntries(tasks.filter((t) => t.page === "Dark LP").map((t) => [t.key.split(":")[1], t]));
const move = (key: string, date: string) => ({ [key]: { date, reason: "Design delay" } });

test("a moved step takes its new date, keeps the reason and the recommended date", () => {
  const t = find(run([cohort({ launch: "2026-11-16" })], { overrides: move("c1:dark-request", "2026-11-09") }), "c1:dark-request")!;
  assert.equal(t.date, "2026-11-09");
  assert.equal(t.recommended, "2026-11-06");
  assert.equal(t.override?.reason, "Design delay");
  assert.ok(t.notes.some((n) => /Design delay/.test(n)));
});

test("later steps on the page keep their working-day gap; go-live and other pages stay", () => {
  const base = run([cohort({ launch: "2026-11-16" })]);
  const moved = run([cohort({ launch: "2026-11-16" })], { overrides: move("c1:dark-request", "2026-11-09") });
  const d = dark(moved);
  // Build, beta and SEO were 5 working days after request, so they follow it to Mon 16.
  assert.equal(d["dark-build"].date, "2026-11-16");
  assert.equal(d["dark-beta"].date, "2026-11-16");
  assert.equal(d["dark-seo"].date, "2026-11-16");
  assert.equal(d["dark-live"].date, "2026-11-16");
  assert.deepEqual(d["dark-build"].tags, []);
  assert.ok(d["dark-build"].notes.some((n) => /Pushed/.test(n)));
  assert.deepEqual(dark(base)["dark-live"], d["dark-live"]);
  for (const t of base.filter((x) => x.page !== "Dark LP")) assert.deepEqual(find(moved, t.key), t, t.key);
});

test("moving a step earlier does not pull later steps", () => {
  const d = dark(run([cohort({ launch: "2026-11-16" })], { overrides: move("c1:dark-build", "2026-11-11") }));
  assert.equal(d["dark-build"].date, "2026-11-11");
  assert.equal(d["dark-beta"].date, "2026-11-13");
});

test("when the gaps would pass go-live, the later steps are squeezed into the days left", () => {
  const d = dark(run([cohort({ launch: "2026-11-16" })], { overrides: move("c1:dark-request", "2026-11-12") }));
  assert.equal(d["dark-request"].date, "2026-11-12");
  assert.equal(d["dark-build"].date, "2026-11-12");
  assert.equal(d["dark-beta"].date, "2026-11-13");
  assert.equal(d["dark-seo"].date, "2026-11-16");
  assert.equal(d["dark-live"].date, "2026-11-16");
  for (const t of Object.values(d)) assert.ok(!t.tags.includes("After go-live"), t.key);
  assert.ok(d["dark-beta"].notes.some((n) => /Squeezed/.test(n)));
});

test("a step moved past go-live is tagged After go-live and go-live does not move", () => {
  const d = dark(run([cohort({ launch: "2026-11-16" })], { overrides: move("c1:dark-request", "2026-11-18") }));
  assert.equal(d["dark-live"].date, "2026-11-16");
  assert.deepEqual(d["dark-live"].tags, []);
  for (const id of ["dark-request", "dark-build", "dark-beta", "dark-seo"]) {
    assert.equal(d[id].date, "2026-11-18", id);
    assert.deepEqual(d[id].tags, ["After go-live"], id);
  }
});

test("a step moved on a page with no go-live pushes later steps without squeezing", () => {
  const rules: Rules = {
    ...{ "Pre-recorded bootcamp": [], "Self-paced upgrade": [] },
    "Live cohort": [
      { id: "a", page: "P", label: "A", anchor: "launch", offset: -4, goLive: false, text: "a", owner: "" },
      { id: "b", page: "P", label: "B", anchor: "launch", offset: -2, goLive: false, text: "b", owner: "" },
    ],
  };
  const tasks = run([cohort({ launch: "2026-11-16" })], { rules, overrides: move("c1:a", "2026-11-16") });
  // a was Thu 12 and b Fri 13 (1 working day later): b follows to Tue 17, past launch day, with no go-live to stop it.
  assert.equal(find(tasks, "c1:b")!.date, "2026-11-17");
  assert.deepEqual(find(tasks, "c1:b")!.tags, []);
});

test("a holiday is skipped when counting the gap", () => {
  const d = dark(run([cohort({ launch: "2026-11-16" })], {
    holidays: ["2026-11-10"], overrides: move("c1:dark-request", "2026-11-09"),
  }));
  // 5 working days after Mon 9 with Tue 10 off: 11, 12, 13, 16, 17 -> Tue 17, after go-live, so squeezed to Mon 16.
  assert.equal(d["dark-build"].date, "2026-11-16");
});

test("one-off tasks are added, tied to a cohort when given, and skipped for archived cohorts", () => {
  const cohorts = [cohort({ launch: "2026-11-16" }), cohort({ id: "old", name: "Old", status: "archived" })];
  const tasks = run(cohorts, {
    customs: [
      { id: "1", title: "Book venue", date: "2026-11-05", cohortId: "c1", owner: "Asha" },
      { id: "2", title: "General chore", date: "2026-11-01" },
      { id: "3", title: "Old chore", date: "2026-11-03", cohortId: "old" },
    ],
  });
  const one = find(tasks, "custom:1")!;
  assert.equal(one.cohortName, "AISE C4");
  assert.equal(one.owner, "Asha");
  assert.equal(one.text, "Book venue");
  assert.equal(one.status, "upcoming");
  assert.equal(find(tasks, "custom:2")!.status, "today");
  assert.equal(find(tasks, "custom:2")!.cohortId, "");
  assert.equal(find(tasks, "custom:3"), undefined);
});

test("{next} is the same-program cohort with the nearest later launch", () => {
  const cohorts = [
    cohort({ id: "a", name: "A", program: "AISE", launch: "2026-11-16" }),
    cohort({ id: "c", name: "C", program: "AISE", launch: "2027-02-01" }),
    cohort({ id: "b", name: "B", program: "AISE", launch: "2026-12-14" }),
    cohort({ id: "x", name: "X", program: "DA", launch: "2026-11-30" }),
  ];
  assert.equal(fillText("then {next}", cohorts[0], nextCohort(cohorts[0], cohorts)), "then B");
  assert.equal(nextCohort(cohorts[1], cohorts), undefined);
  assert.equal(fillText("then {next}", cohorts[1]), "then TBD");
  assert.equal(nextCohort(cohort({ launch: "2026-11-16" }), cohorts), undefined);
});

test("placeholders only read the cohort's own values, never object prototype keys", () => {
  assert.equal(fillText("{constructor} {toString} {__proto__}", cohort()), "TBD TBD TBD");
});

test("rules can be replaced", () => {
  const rules: Rules = {
    "Live cohort": [{ id: "x-go", page: "X", label: "Go", anchor: "launch", offset: -1, goLive: false, text: "Do {cohort}", owner: "pm" }],
    "Pre-recorded bootcamp": [],
    "Self-paced upgrade": [],
  };
  const tasks = run([cohort({ launch: "2026-11-16", pm: "Ravi" })], { rules });
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].key, "c1:x-go");
  assert.equal(tasks[0].date, "2026-11-13");
  assert.equal(tasks[0].text, "Do AISE C4");
  assert.equal(tasks[0].owner, "Ravi");
});

test("owner match ignores case and extra spaces, never matches empty", () => {
  assert.equal(ownerMatches("Asha K", "  asha   k "), true);
  assert.equal(ownerMatches("Asha K", "Asha"), false);
  assert.equal(ownerMatches(undefined, "Asha"), false);
  assert.equal(ownerMatches("Asha", ""), false);
});

test("Dark LP has SEO metadata for a Pre-recorded bootcamp too", () => {
  const tasks = run([cohort({ kind: "Pre-recorded bootcamp", launch: "2026-11-16" })]);
  assert.ok(find(tasks, "c1:dark-seo"));
  assert.equal(find(tasks, "c1:native-seo"), undefined);
});

test("a cohort with an unknown kind makes no tasks instead of crashing", () => {
  const bad = cohort({ launch: "2026-11-16", kind: "Mystery" as Cohort["kind"] });
  assert.deepEqual(run([bad]), []);
});
