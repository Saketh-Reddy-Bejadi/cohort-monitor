import { test } from "node:test";
import assert from "node:assert/strict";
import { fmtDate, fmtDay, fmtRupees } from "../lib/format.ts";

test("fmtDay gives weekday, day and month", () => {
  assert.equal(fmtDay("2026-11-06"), "Fri 6 Nov");
  assert.equal(fmtDay("2026-11-01"), "Sun 1 Nov");
  assert.equal(fmtDay("2027-01-05"), "Tue 5 Jan");
  assert.equal(fmtDay(undefined), "Not set");
  assert.equal(fmtDay("bad"), "Not set");
});

test("fmtDate and fmtRupees", () => {
  assert.equal(fmtDate("2026-10-25"), "25 Oct 2026");
  assert.equal(fmtRupees(42000), "₹42,000");
  assert.equal(fmtRupees(undefined), "Not set");
});
