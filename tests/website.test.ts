import { test } from "node:test";
import assert from "node:assert/strict";
import { checkKey, siteView, websiteStatus } from "../lib/planner/website.ts";
import { waitlistDate } from "../lib/planner/anchors.ts";
import type { Cohort } from "../lib/planner/types.ts";

const full = (extra: Partial<Cohort> = {}): Cohort => ({
  id: "c1", name: "AISE C4", kind: "Live cohort", status: "active", no_waitlist: false,
  launch: "2026-11-16", start: "2026-11-23", ic_close: "2026-11-30", standard_from: "2026-12-01",
  enrol_close: "2026-12-07", ic_price: 42000, standard_price: 54000, ...extra,
});

test("waitlist date: override, launch -10 for a Live cohort, none otherwise", () => {
  assert.equal(waitlistDate(full()), "2026-11-06");
  assert.equal(waitlistDate(full({ waitlist_live: "2026-11-02" })), "2026-11-02");
  assert.equal(waitlistDate(full({ no_waitlist: true })), undefined);
  assert.equal(waitlistDate(full({ launch: undefined })), undefined);
  assert.equal(waitlistDate(full({ kind: "Pre-recorded bootcamp" })), undefined);
});

test("enrolment line follows the day", () => {
  const c = full();
  const line = (d: string) => siteView(c, d);
  assert.deepEqual([line("2026-11-05").state, line("2026-11-05").enrolment], ["not-listed", "Not on the site yet"]);
  assert.deepEqual([line("2026-11-06").state, line("2026-11-06").enrolment], ["waitlist", "Waitlist only. Enrolments open on 16 Nov 2026"]);
  assert.equal(line("2026-11-15").state, "waitlist");
  assert.deepEqual([line("2026-11-16").state, line("2026-11-16").enrolment], ["open", "Open. Closes on 7 Dec 2026"]);
  assert.equal(line("2026-12-06").state, "open");
  assert.deepEqual([line("2026-12-07").state, line("2026-12-07").enrolment], ["closed", "Closed. The call to action goes to the next cohort's waitlist"]);
  assert.equal(line("2027-01-15").state, "closed");
});

test("no launch date means no dates yet, and nothing else is shown", () => {
  const v = siteView(full({ launch: undefined }), "2026-11-20");
  assert.equal(v.state, "no-dates");
  assert.equal(v.enrolment, "No dates yet");
  assert.equal(v.price, undefined);
  assert.equal(v.classes, undefined);
});

test("no waitlist: before launch the site shows nothing", () => {
  assert.equal(siteView(full({ no_waitlist: true }), "2026-11-10").state, "not-listed");
});

test("open with no closing date says so", () => {
  assert.equal(siteView(full({ enrol_close: undefined }), "2026-12-20").enrolment, "Open. Closing date not set");
});

test("archived cohorts are not tracked", () => {
  const v = siteView(full({ status: "archived" }), "2026-11-20");
  assert.equal(v.state, "archived");
  assert.deepEqual(websiteStatus({ cohort: full({ status: "archived" }), today: "2026-11-20" }).changes, []);
});

test("price line: inner circle until it ends, then standard from its date", () => {
  const c = full();
  assert.equal(siteView(c, "2026-11-20").price, "Inner circle price ₹42,000 until 30 Nov 2026");
  assert.equal(siteView(c, "2026-11-30").price, "Inner circle price ₹42,000 until 30 Nov 2026"); // last day counts
  assert.equal(siteView(c, "2026-12-01").price, "Standard price ₹54,000");
  assert.equal(siteView(c, "2026-12-05").price, "Standard price ₹54,000");
});

test("price line: gap between inner circle end and standard start is explained", () => {
  const c = full({ ic_close: "2026-11-28" });
  assert.equal(siteView(c, "2026-11-30").price, "Inner circle price ended 28 Nov 2026. Standard price ₹54,000 from 1 Dec 2026");
});

test("price line: missing pieces", () => {
  assert.equal(siteView(full({ standard_from: undefined, ic_close: undefined }), "2026-12-05").price, "Inner circle price ₹42,000");
  assert.equal(siteView(full({ ic_price: undefined, standard_from: undefined }), "2026-11-20").price, "Price not set");
  assert.equal(siteView(full({ standard_price: undefined }), "2026-12-05").price, "Standard price not set");
});

test("classes line: before, on and after the start", () => {
  const c = full();
  assert.equal(siteView(c, "2026-11-20").classes, "Start 23 Nov 2026");
  assert.equal(siteView(c, "2026-11-23").classes, "Start today 23 Nov 2026");
  assert.equal(siteView(c, "2026-11-24").classes, "Started on 23 Nov 2026 · homepage card Live Now");
  assert.equal(siteView(c, "2026-12-30").classes, "Started on 23 Nov 2026 · homepage card Live Now");
  assert.equal(siteView(full({ start: undefined }), "2026-11-20").classes, "Class start date not set");
});

test("waitlist and closed days still show price and classes lines", () => {
  assert.ok(siteView(full(), "2026-11-10").price);
  assert.ok(siteView(full(), "2026-12-20").classes);
  assert.equal(siteView(full(), "2026-11-01").price, undefined); // not on the site yet
});

test("five dated changes, in date order, with the right dates", () => {
  const { changes } = websiteStatus({ cohort: full(), today: "2026-11-01" });
  assert.deepEqual(changes.map((c) => [c.id, c.label, c.date]), [
    ["waitlist", "Waitlist LP live", "2026-11-06"],
    ["open", "Enrolments open", "2026-11-16"],
    ["started", "Show as started", "2026-11-24"],
    ["standard", "Inner circle ends", "2026-12-01"],
    ["close", "Enrolments close", "2026-12-07"],
  ]);
});

test("a change with no date is left out", () => {
  const only = websiteStatus({ cohort: full({ start: undefined, standard_from: undefined, enrol_close: undefined }), today: "2026-11-01" });
  assert.deepEqual(only.changes.map((c) => c.id), ["waitlist", "open"]);
  const off = websiteStatus({ cohort: full({ no_waitlist: true }), today: "2026-11-01" });
  assert.equal(off.changes.some((c) => c.id === "waitlist"), false);
});

test("checklists use the cohort's own prices and dates", () => {
  const { changes } = websiteStatus({ cohort: full(), today: "2026-11-01" });
  const text = (id: string) => changes.find((c) => c.id === id)!.checklist.join(" | ");
  assert.match(text("open"), /₹42,000/);
  assert.match(text("open"), /7 Dec 2026/);
  assert.match(text("standard"), /₹54,000/);
  assert.match(text("standard"), /1 Dec 2026/);
  assert.match(text("started"), /23 Nov 2026/);
  assert.match(text("waitlist"), /16 Nov 2026/);
  for (const c of changes) {
    assert.ok(c.checklist.length > 0, c.id);
    assert.doesNotMatch(c.checklist.join(" "), /[{}]/, c.id);
  }
});

test("prep start is the earliest task date for that change", () => {
  const { changes } = websiteStatus({ cohort: full(), today: "2026-11-01" });
  const prep = (id: string) => changes.find((c) => c.id === id)!.prepStart;
  assert.equal(prep("waitlist"), "2026-10-30"); // request -6 = Sat 31 Oct, back to Fri
  assert.equal(prep("open"), "2026-11-06"); // Dark and Native request -9 = Sat 7 Nov, back to Fri
  assert.equal(prep("started"), "2026-11-24"); // no prep, same day
  assert.equal(prep("standard"), "2026-11-27"); // request -2 = Sun 29 Nov, back to Fri
  assert.equal(prep("close"), "2026-12-04"); // confirm -3
});

test("holidays move the prep start", () => {
  const { changes } = websiteStatus({ cohort: full(), today: "2026-11-01", holidays: ["2026-11-06"] });
  assert.equal(changes.find((c) => c.id === "open")!.prepStart, "2026-11-05");
});

test("next change is the first one strictly after today", () => {
  const at = (today: string) => websiteStatus({ cohort: full(), today }).next;
  assert.deepEqual([at("2026-11-10")!.id, at("2026-11-10")!.inDays, at("2026-11-10")!.prepStarted], ["open", 6, true]);
  assert.equal(at("2026-11-16")!.id, "started"); // a change today is already live, not next
  assert.deepEqual([at("2026-10-20")!.id, at("2026-10-20")!.inDays, at("2026-10-20")!.prepStarted], ["waitlist", 17, false]);
  assert.equal(at("2026-12-07"), undefined);
  assert.equal(at("2027-02-01"), undefined);
});

test("a cohort with no dates has no changes and no next", () => {
  const r = websiteStatus({ cohort: full({ launch: undefined, start: undefined, ic_close: undefined, standard_from: undefined, enrol_close: undefined }), today: "2026-11-01" });
  assert.deepEqual(r.changes, []);
  assert.equal(r.next, undefined);
  assert.equal(r.view.state, "no-dates");
});

test("each change says which task pages lead up to it", () => {
  const { changes } = websiteStatus({ cohort: full(), today: "2026-11-01" });
  const pages = (id: string) => changes.find((c) => c.id === id)!.pages;
  assert.deepEqual(pages("waitlist"), ["Waitlist LP"]);
  assert.ok(pages("open").includes("Dark LP") && pages("open").includes("Onboarding"));
  assert.deepEqual(pages("started"), ["Classes start"]);
  assert.deepEqual(pages("standard"), ["Standard pricing"]);
  assert.deepEqual(pages("close"), ["Enrolment close"]);
});

test("a moved task changes the prep start", () => {
  const moved = websiteStatus({
    cohort: full(), today: "2026-11-01",
    overrides: { "c1:waitlist-request": { date: "2026-11-02", reason: "Waiting for copy" } },
  });
  assert.equal(moved.changes.find((c) => c.id === "waitlist")!.prepStart, "2026-11-02");
  const plain = websiteStatus({ cohort: full(), today: "2026-11-01" });
  assert.equal(plain.changes.find((c) => c.id === "waitlist")!.prepStart, "2026-10-30");
});

test("checklist tick keys are stable and cannot clash with task keys", () => {
  assert.equal(checkKey("aise-c4", "open", 2), "aise-c4:check-open-2");
  assert.notEqual(checkKey("c1", "open", 0), checkKey("c1", "open", 1));
  assert.notEqual(checkKey("c1", "open", 0), checkKey("c1", "close", 0));
  // Task keys are "<cohort>:<step id>", and no step id starts with "check-".
  assert.ok(checkKey("c1", "open", 0).startsWith("c1:check-"));
});
