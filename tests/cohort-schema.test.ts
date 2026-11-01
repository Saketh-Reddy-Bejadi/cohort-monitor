import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCohort, slugify } from "../lib/planner/schema.ts";

const ok = (input: Record<string, unknown>) => {
  const r = parseCohort(input);
  assert.equal(r.ok, true, JSON.stringify(!r.ok && r.errors));
  return r.ok ? r.cohort : (undefined as never);
};
const errors = (input: Record<string, unknown>) => {
  const r = parseCohort(input);
  assert.equal(r.ok, false);
  return r.ok ? {} : r.errors;
};
const base = { name: "AISE C4", kind: "Live cohort" };

test("slugify", () => {
  assert.equal(slugify("AISE C4"), "aise-c4");
  assert.equal(slugify("  Data  Science / C-12! "), "data-science-c-12");
  assert.equal(slugify("***"), "");
});

test("minimal cohort: id from name, defaults, blanks are not set", () => {
  const c = ok({ ...base, launch: "", ic_price: "", poc: "  " });
  assert.equal(c.id, "aise-c4");
  assert.equal(c.status, "active");
  assert.equal(c.no_waitlist, false);
  assert.equal(c.launch, undefined);
  assert.equal(c.ic_price, undefined);
  assert.equal(c.poc, undefined);
});

test("explicit id must be a lowercase slug", () => {
  assert.equal(ok({ ...base, id: "aise-c5" }).id, "aise-c5");
  assert.ok(errors({ ...base, id: "AISE C5" }).id);
  assert.ok(errors({ ...base, id: "-x" }).id);
});

test("name and kind are required, kind and status must be known", () => {
  assert.ok(errors({ kind: "Live cohort" }).name);
  assert.ok(errors({ name: "x" }).kind);
  assert.ok(errors({ name: "x", kind: "Weekend" }).kind);
  assert.ok(errors({ ...base, status: "deleted" }).status);
  assert.ok(errors({ name: "***", kind: "Live cohort" }).name === undefined);
  assert.ok(errors({ name: "***", kind: "Live cohort" }).id);
});

test("dates must be real YYYY-MM-DD dates", () => {
  assert.equal(ok({ ...base, start: "2026-10-25" }).start, "2026-10-25");
  for (const bad of ["25/10/2026", "2026-13-01", "2026-02-30", "2026-1-5", "tomorrow"]) {
    assert.ok(errors({ ...base, start: bad }).start, bad);
  }
});

test("launch cannot be after enrolment close", () => {
  assert.ok(errors({ ...base, launch: "2026-11-13", enrol_close: "2026-11-12" }).enrol_close);
  ok({ ...base, launch: "2026-11-12", enrol_close: "2026-11-12" });
});

test("prices accept numbers and text with symbols and commas", () => {
  const c = ok({ ...base, ic_price: "₹42,000", standard_price: 54000, her_ic: "$1,299.50" });
  assert.equal(c.ic_price, 42000);
  assert.equal(c.standard_price, 54000);
  assert.equal(c.her_ic, 1299.5);
  for (const bad of ["abc", "-5", "1.234", "NaN", "Infinity"]) {
    assert.ok(errors({ ...base, ic_price: bad }).ic_price, bad);
  }
  assert.equal(ok({ ...base, ic_price: 0 }).ic_price, 0);
});

test("links must be http or https", () => {
  assert.equal(ok({ ...base, dark_url: "https://codebasics.io/x" }).dark_url, "https://codebasics.io/x");
  for (const bad of ["codebasics.io", "javascript:alert(1)", "ftp://x.com", "http://"]) {
    assert.ok(errors({ ...base, dark_beta: bad }).dark_beta, bad);
  }
});

test("no_waitlist accepts form and JSON values, and clashes with a waitlist date", () => {
  for (const v of [true, "true", "on", "1"]) assert.equal(ok({ ...base, no_waitlist: v }).no_waitlist, true);
  for (const v of [false, "false", "off", "0", "", undefined]) assert.equal(ok({ ...base, no_waitlist: v }).no_waitlist, false);
  assert.ok(errors({ ...base, no_waitlist: "maybe" }).no_waitlist);
  assert.ok(errors({ ...base, no_waitlist: true, waitlist_live: "2026-10-01" }).waitlist_live);
});

test("unknown keys are dropped, not stored", () => {
  const c = ok({ ...base, _id: "x", role: "admin", updated_by: "me" }) as Record<string, unknown>;
  assert.equal("_id" in c, false);
  assert.equal("role" in c, false);
  assert.equal("updated_by" in c, false);
});

test("text is trimmed and length limited; non-strings are rejected", () => {
  assert.equal(ok({ ...base, poc: "  Asha  " }).poc, "Asha");
  assert.ok(errors({ ...base, poc: "x".repeat(101) }).poc);
  assert.ok(errors({ ...base, poc: { a: 1 } }).poc);
  assert.ok(errors({ ...base, launch: 20261025 }).launch);
});

test("many errors are reported together, one per field", () => {
  const e = errors({ name: "", kind: "x", start: "bad", ic_price: "bad" });
  assert.deepEqual(Object.keys(e).sort(), ["ic_price", "kind", "name", "start"]);
});

test("price and enrolment dates must be in order", () => {
  assert.ok(errors({ ...base, launch: "2026-11-10", ic_close: "2026-11-01" }).ic_close);
  assert.ok(errors({ ...base, ic_close: "2026-11-10", standard_from: "2026-11-01" }).standard_from);
  assert.ok(errors({ ...base, standard_from: "2026-11-12", enrol_close: "2026-11-11" }).enrol_close);
  ok({ ...base, launch: "2026-11-01", ic_close: "2026-11-10", standard_from: "2026-11-11", enrol_close: "2026-11-12" });
});
