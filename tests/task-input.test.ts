import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCustom, parseDate, parseMove } from "../lib/planner/task-input.ts";

const moveOk = (i: Record<string, unknown>) => {
  const r = parseMove(i);
  assert.equal(r.ok, true, JSON.stringify(!r.ok && r.errors));
  return r.ok ? r : (undefined as never);
};
const moveBad = (i: Record<string, unknown>) => {
  const r = parseMove(i);
  assert.equal(r.ok, false);
  return r.ok ? {} : r.errors;
};

test("a move needs a real date and a reason; the reason is trimmed", () => {
  assert.deepEqual(moveOk({ date: "2026-11-12", reason: "  Waiting for design  " }), {
    ok: true, date: "2026-11-12", reason: "Waiting for design",
  });
});

test("move dates must be real and sensible", () => {
  for (const bad of ["12/11/2026", "2026-02-30", "2026-13-01", "tomorrow", "", "0026-11-12", "2101-01-01", "1999-12-31"]) {
    assert.ok(moveBad({ date: bad, reason: "x" }).date, bad);
  }
  assert.equal(moveOk({ date: "2100-12-31", reason: "x" }).date, "2100-12-31");
  assert.equal(moveOk({ date: "2020-01-01", reason: "x" }).date, "2020-01-01");
});

test("a move needs a reason of 1 to 200 characters", () => {
  assert.ok(moveBad({ date: "2026-11-12" }).reason);
  assert.ok(moveBad({ date: "2026-11-12", reason: "   " }).reason);
  assert.ok(moveBad({ date: "2026-11-12", reason: "x".repeat(201) }).reason);
  assert.equal(moveOk({ date: "2026-11-12", reason: "x".repeat(200) }).reason.length, 200);
});

test("non-text input is an error, not a crash", () => {
  const e = moveBad({ date: 20261112, reason: { a: 1 } });
  assert.ok(e.date && e.reason);
  assert.ok(moveBad({ date: null, reason: null }).date);
});

test("both move errors are reported together", () => {
  assert.deepEqual(Object.keys(moveBad({ date: "bad", reason: "" })).sort(), ["date", "reason"]);
});

const customOk = (i: Record<string, unknown>) => {
  const r = parseCustom(i);
  assert.equal(r.ok, true, JSON.stringify(!r.ok && r.errors));
  return r.ok ? r.task : (undefined as never);
};
const customBad = (i: Record<string, unknown>) => {
  const r = parseCustom(i);
  assert.equal(r.ok, false);
  return r.ok ? {} : r.errors;
};

test("a one-off task needs a title and a date; cohort and owner are optional", () => {
  assert.deepEqual(customOk({ title: "  Send brochure ", date: "2026-11-12" }), {
    title: "Send brochure", date: "2026-11-12", cohortId: undefined, owner: undefined,
  });
  assert.deepEqual(customOk({ title: "Send brochure", date: "2026-11-12", cohortId: "aise-c4", owner: "  Asha  " }), {
    title: "Send brochure", date: "2026-11-12", cohortId: "aise-c4", owner: "Asha",
  });
});

test("blank cohort and owner mean none", () => {
  const t = customOk({ title: "x", date: "2026-11-12", cohortId: "", owner: "   " });
  assert.equal(t.cohortId, undefined);
  assert.equal(t.owner, undefined);
});

test("one-off task errors", () => {
  assert.ok(customBad({ date: "2026-11-12" }).title);
  assert.ok(customBad({ title: "   ", date: "2026-11-12" }).title);
  assert.ok(customBad({ title: "x".repeat(121), date: "2026-11-12" }).title);
  assert.ok(customBad({ title: "x" }).date);
  assert.ok(customBad({ title: "x", date: "2026-02-30" }).date);
  assert.ok(customBad({ title: "x", date: "2026-11-12", cohortId: "AISE C4" }).cohortId);
  assert.ok(customBad({ title: "x", date: "2026-11-12", cohortId: { $ne: "" } }).cohortId);
  assert.ok(customBad({ title: "x", date: "2026-11-12", owner: "x".repeat(101) }).owner);
  assert.deepEqual(Object.keys(customBad({ title: "", date: "bad", cohortId: "BAD ID", owner: "x".repeat(101) })).sort(),
    ["cohortId", "date", "owner", "title"]);
});

test("parseDate is just the date check", () => {
  assert.deepEqual(parseDate(" 2026-11-12 "), { ok: true, date: "2026-11-12" });
  for (const bad of ["", "2026-02-30", "0026-01-01", 5, null, undefined]) assert.equal(parseDate(bad).ok, false, String(bad));
});
