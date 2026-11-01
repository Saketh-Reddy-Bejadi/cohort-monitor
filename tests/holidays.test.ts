import { test } from "node:test";
import assert from "node:assert/strict";
import { formatHolidays, parseHolidays } from "../lib/planner/holidays.ts";

const ok = (text: string) => {
  const r = parseHolidays(text);
  assert.equal(r.ok, true, JSON.stringify(!r.ok && r.errors));
  return r.ok ? r.holidays : [];
};
const bad = (text: string) => {
  const r = parseHolidays(text);
  assert.equal(r.ok, false);
  return r.ok ? [] : r.errors;
};

test("one date per line, optional name, blank lines and extra spaces ignored, sorted", () => {
  assert.deepEqual(ok("2026-12-25  Christmas Day  \n\n2026-11-08 Diwali\n  2026-11-09\n"), [
    { date: "2026-11-08", name: "Diwali" },
    { date: "2026-11-09" },
    { date: "2026-12-25", name: "Christmas Day" },
  ]);
});

test("Windows line endings work", () => {
  assert.equal(ok("2026-11-08 Diwali\r\n2026-11-09\r\n").length, 2);
});

test("empty text is an empty list", () => {
  assert.deepEqual(ok(""), []);
  assert.deepEqual(ok("  \n \n"), []);
});

test("the same date twice is kept once, with the first name", () => {
  assert.deepEqual(ok("2026-11-08 Diwali\n2026-11-08 Other"), [{ date: "2026-11-08", name: "Diwali" }]);
});

test("bad lines are reported with their line number, all at once", () => {
  const e = bad("2026-11-08 Diwali\n2026-02-30 x\ntomorrow\n11/08/2026");
  assert.deepEqual(e.map((x) => x.line), [2, 3, 4]);
  assert.ok(e.every((x) => x.message.length > 0));
});

test("names are limited and the list is capped", () => {
  assert.equal(bad(`2026-11-08 ${"x".repeat(61)}`)[0].line, 1);
  const many = Array.from({ length: 401 }, (_, i) => `${2026 + Math.floor(i / 366)}-01-01`).join("\n");
  assert.ok(bad(many).length > 0);
});

test("format and parse round trip", () => {
  const list = [{ date: "2026-11-08", name: "Diwali" }, { date: "2026-11-09" }];
  assert.equal(formatHolidays(list), "2026-11-08 Diwali\n2026-11-09");
  assert.deepEqual(ok(formatHolidays(list)), list);
  assert.equal(formatHolidays([]), "");
});
