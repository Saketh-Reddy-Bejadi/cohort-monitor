import { test } from "node:test";
import assert from "node:assert/strict";
import { todayIST } from "../lib/planner/today.ts";

test("today is the India date, whatever the server's time zone", () => {
  assert.equal(todayIST(new Date("2026-11-01T18:29:00Z")), "2026-11-01"); // 23:59 in India
  assert.equal(todayIST(new Date("2026-11-01T18:30:00Z")), "2026-11-02"); // midnight in India
  assert.equal(todayIST(new Date("2026-11-01T20:00:00Z")), "2026-11-02");
  assert.equal(todayIST(new Date("2026-12-31T20:00:00Z")), "2027-01-01");
  assert.match(todayIST(), /^\d{4}-\d{2}-\d{2}$/);
});

import { hourIST } from "../lib/planner/today.ts";

test("hourIST is the India hour, 0 to 23", () => {
  assert.equal(hourIST(new Date("2026-11-01T18:29:00Z")), 23);
  assert.equal(hourIST(new Date("2026-11-01T18:30:00Z")), 0); // midnight in India
  assert.equal(hourIST(new Date("2026-11-01T03:30:00Z")), 9);
  assert.equal(hourIST(new Date("2026-11-01T06:29:00Z")), 11);
  assert.equal(hourIST(new Date("2026-11-01T06:30:00Z")), 12);
  assert.ok(hourIST() >= 0 && hourIST() <= 23);
});
