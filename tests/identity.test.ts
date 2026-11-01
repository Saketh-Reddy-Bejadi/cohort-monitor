import { test } from "node:test";
import assert from "node:assert/strict";
import { pickEmail, tenantMatches } from "../lib/identity.ts";

test("email falls back when the email claim is missing", () => {
  assert.equal(pickEmail({ preferred_username: "A@Codebasics.io" }, null), "a@codebasics.io");
  assert.equal(pickEmail({ email: "b@codebasics.io" }, null), "b@codebasics.io");
  assert.equal(pickEmail({}, "c@codebasics.io"), "c@codebasics.io");
  assert.equal(pickEmail(undefined, undefined), "");
  assert.equal(pickEmail({ preferred_username: "not-an-email" }, null), "");
});

test("tenant must match", () => {
  assert.equal(tenantMatches({ tid: "ABC" }, "abc"), true);
  assert.equal(tenantMatches({ tid: "other" }, "abc"), false);
  assert.equal(tenantMatches({}, "abc"), false);
  assert.equal(tenantMatches(undefined, "abc"), false);
});
