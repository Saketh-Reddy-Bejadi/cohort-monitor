import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, isWorkday, prevWorkday, weekday } from "../lib/planner/dates.ts";
import { fmtDate } from "../lib/format.ts";

test("addDays crosses months, years and leap days", () => {
  assert.equal(addDays("2026-11-16", -9), "2026-11-07");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2027-03-01", -1), "2027-02-28");
  assert.equal(addDays("2028-03-01", -1), "2028-02-29");
  assert.equal(addDays("2026-11-16", 0), "2026-11-16");
});

test("weekday names", () => {
  assert.equal(weekday("2026-11-01"), "Sun");
  assert.equal(weekday("2026-11-07"), "Sat");
  assert.equal(weekday("2026-11-16"), "Mon");
});

test("weekends and holidays are not working days", () => {
  const h = new Set(["2026-11-13"]);
  assert.equal(isWorkday("2026-11-12", h), true);
  assert.equal(isWorkday("2026-11-13", h), false); // holiday
  assert.equal(isWorkday("2026-11-14", h), false); // Saturday
  assert.equal(isWorkday("2026-11-15", h), false); // Sunday
});

test("prevWorkday: same day when it is a working day, else back to one", () => {
  const none = new Set<string>();
  assert.equal(prevWorkday("2026-11-13", none), "2026-11-13");
  assert.equal(prevWorkday("2026-11-07", none), "2026-11-06"); // Sat to Fri
  assert.equal(prevWorkday("2026-11-15", none), "2026-11-13"); // Sun to Fri
  assert.equal(prevWorkday("2026-11-15", new Set(["2026-11-13"])), "2026-11-12"); // Fri is a holiday
});

import { daysBetween } from "../lib/planner/dates.ts";

test("daysBetween counts whole days, negative when going back", () => {
  assert.equal(daysBetween("2026-11-10", "2026-11-16"), 6);
  assert.equal(daysBetween("2026-11-16", "2026-11-10"), -6);
  assert.equal(daysBetween("2026-11-10", "2026-11-10"), 0);
  assert.equal(daysBetween("2026-12-30", "2027-01-02"), 3);
});

test("a bad date throws a clear error instead of NaN or a shifted date", () => {
  for (const bad of ["", "tomorrow", "2026-13-01", "2026-02-31", "2026-1-5", "0099-01-01x"]) {
    assert.throws(() => addDays(bad, 1), /Not a valid date/, bad);
  }
});

test("years below 100 are not mapped to 19xx", () => {
  assert.equal(addDays("0050-01-01", 1), "0050-01-02");
});

test("fmtDate shows Not set for a bad month", () => {
  assert.equal(fmtDate("2026-10-25"), "25 Oct 2026");
  assert.equal(fmtDate("2026-13-01"), "Not set");
  assert.equal(fmtDate("2026-00-01"), "Not set");
});
