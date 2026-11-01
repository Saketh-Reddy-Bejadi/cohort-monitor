import { test } from "node:test";
import assert from "node:assert/strict";
import { doneKeyPattern } from "../lib/planner/engine.ts";

test("the pattern matches only keys of that cohort", () => {
  const re = new RegExp(doneKeyPattern("aise-c4"));
  assert.ok(re.test("aise-c4:launch"));
  assert.ok(!re.test("aise-c40:launch"));
  assert.ok(!re.test("custom:aise-c4:x"));
});

test("characters in a cohort id are not read as a pattern", () => {
  const re = new RegExp(doneKeyPattern("a.b"));
  assert.ok(re.test("a.b:step"));
  assert.ok(!re.test("axb:step"));
  assert.doesNotThrow(() => new RegExp(doneKeyPattern("a(b[")));
});
