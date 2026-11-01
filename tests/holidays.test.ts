import { test } from "node:test";
import assert from "node:assert/strict";
import { addHoliday, MAX_HOLIDAYS, removeHoliday, updateHoliday, type Holiday } from "../lib/planner/holidays.ts";

const base: Holiday[] = [{ date: "2026-11-08", name: "Diwali" }, { date: "2026-12-25", name: "Christmas Day" }];

const addOk = (list: Holiday[], date: unknown, name?: unknown) => {
  const r = addHoliday(list, { date, name });
  assert.equal(r.ok, true, JSON.stringify(!r.ok && r.errors));
  return r.ok ? r.holidays : [];
};
const addBad = (list: Holiday[], date: unknown, name?: unknown) => {
  const r = addHoliday(list, { date, name });
  assert.equal(r.ok, false);
  return r.ok ? {} : r.errors;
};

test("add keeps the list sorted by date, with or without a name", () => {
  assert.deepEqual(addOk(base, "2026-11-20", "Founders Day"), [
    { date: "2026-11-08", name: "Diwali" },
    { date: "2026-11-20", name: "Founders Day" },
    { date: "2026-12-25", name: "Christmas Day" },
  ]);
  assert.deepEqual(addOk([], "2026-11-20"), [{ date: "2026-11-20" }]);
  assert.deepEqual(addOk(base, "2026-01-26", "  Republic Day  ")[0], { date: "2026-01-26", name: "Republic Day" });
});

test("add does not change the list it was given", () => {
  const copy = structuredClone(base);
  addOk(base, "2026-11-20", "x");
  assert.deepEqual(base, copy);
});

test("a blank name means no name", () => {
  assert.deepEqual(addOk([], "2026-11-20", "   "), [{ date: "2026-11-20" }]);
  assert.deepEqual(addOk([], "2026-11-20", ""), [{ date: "2026-11-20" }]);
});

test("add: the date must be real and in range", () => {
  for (const bad of ["", "2026-02-30", "12/11/2026", "0026-11-20", "2101-01-01", null, undefined, 5]) {
    assert.ok(addBad(base, bad).date, String(bad));
  }
});

test("add: a date that is already a holiday is refused", () => {
  assert.match(addBad(base, "2026-11-08", "Again").date ?? "", /already/i);
});

test("add: names are limited to 60 characters and must be text", () => {
  assert.ok(addBad(base, "2026-11-20", "x".repeat(61)).name);
  assert.equal(addOk([], "2026-11-20", "x".repeat(60))[0].name?.length, 60);
  assert.ok(addBad(base, "2026-11-20", { a: 1 }).name);
});

test("add: both field errors are reported together", () => {
  const r = addHoliday(base, { date: "bad", name: "x".repeat(61) });
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.ok ? {} : r.errors).sort(), ["date", "name"]);
});

const upOk = (list: Holiday[], oldDate: string, date: unknown, name?: unknown) => {
  const r = updateHoliday(list, oldDate, { date, name });
  assert.equal(r.ok, true, JSON.stringify(!r.ok && r.errors));
  return r.ok ? r.holidays : [];
};

test("update can change the name, the date, or both, and keeps the order", () => {
  assert.deepEqual(upOk(base, "2026-11-08", "2026-11-08", "Deepavali")[0], { date: "2026-11-08", name: "Deepavali" });
  assert.deepEqual(upOk(base, "2026-11-08", "2026-12-30", "Diwali").map((h) => h.date), ["2026-12-25", "2026-12-30"]);
  assert.deepEqual(upOk(base, "2026-12-25", "2026-12-26", "Boxing Day").at(-1), { date: "2026-12-26", name: "Boxing Day" });
  assert.deepEqual(upOk(base, "2026-11-08", "2026-11-08", ""), [{ date: "2026-11-08" }, base[1]]);
});

test("update: moving onto another holiday's date is refused; keeping your own date is fine", () => {
  const r = updateHoliday(base, "2026-11-08", { date: "2026-12-25", name: "x" });
  assert.equal(r.ok, false);
  assert.match(r.ok ? "" : r.errors.date ?? "", /already/i);
  assert.equal(updateHoliday(base, "2026-11-08", { date: "2026-11-08", name: "x" }).ok, true);
});

test("update: a holiday that is gone gives a clear message, and bad input is refused", () => {
  const gone = updateHoliday(base, "2026-01-01", { date: "2026-01-02", name: "x" });
  assert.equal(gone.ok, false);
  assert.match(gone.ok ? "" : gone.message ?? "", /no longer exists/i);
  const bad = updateHoliday(base, "2026-11-08", { date: "2026-02-30", name: "x" });
  assert.equal(bad.ok, false);
  assert.ok(bad.ok ? "" : bad.errors.date);
});

test("remove takes one date out, and is harmless when it is already gone", () => {
  assert.deepEqual(removeHoliday(base, "2026-11-08"), [{ date: "2026-12-25", name: "Christmas Day" }]);
  assert.deepEqual(removeHoliday(base, "2030-01-01"), base);
  assert.deepEqual(removeHoliday([], "2026-11-08"), []);
});

test("the list is capped, and a full list still allows edits and removals", () => {
  const full: Holiday[] = Array.from({ length: MAX_HOLIDAYS }, (_, i) => ({
    date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
  }));
  const r = addHoliday(full, { date: "2030-01-01" });
  assert.equal(r.ok, false);
  assert.match(!r.ok ? (r.message ?? "") : "", /full/);
  assert.equal(updateHoliday(full, full[0].date, { date: full[0].date, name: "x" }).ok, true);
  assert.equal(removeHoliday(full, full[0].date).length, MAX_HOLIDAYS - 1);
});

test("renaming a stored holiday outside the allowed years works, moving it to such a date does not", () => {
  const old: Holiday[] = [{ date: "2019-05-01", name: "Old" }];
  assert.equal(updateHoliday(old, "2019-05-01", { date: "2019-05-01", name: "Renamed" }).ok, true);
  assert.equal(updateHoliday(old, "2019-05-01", { date: "2019-05-02", name: "Old" }).ok, false);
});
