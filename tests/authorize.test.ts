import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, type RequestFacts } from "../lib/authorize-core.ts";
import type { Role } from "../lib/roles.ts";

const base: RequestFacts = {
  method: "GET",
  authorization: null,
  origin: null,
  host: "app.test",
  apiToken: "secret-token",
};
const as = (role: Role | null) => async () =>
  role ? { email: "x@codebasics.io", role } : null;
const post = { ...base, method: "PATCH", origin: "https://app.test" };

test("no session and no token is 401", async () => {
  const d = await decide(base, "read", as(null));
  assert.deepEqual([d.ok, !d.ok && d.status], [false, 401]);
});

test("token: valid reads and writes cohorts, cannot manage users or tick", async () => {
  const req = { ...base, authorization: "Bearer secret-token" };
  assert.equal((await decide(req, "read", as(null))).ok, true);
  assert.equal((await decide(req, "write-cohort", as(null))).ok, true);
  for (const a of ["manage-users", "tick-task"] as const) {
    const d = await decide(req, a, as(null));
    assert.deepEqual([d.ok, !d.ok && d.status], [false, 403], a);
  }
});

test("a bad token is 401 even with a valid cookie (no fallback)", async () => {
  const d = await decide({ ...base, authorization: "Bearer nope" }, "read", as("admin"));
  assert.deepEqual([d.ok, !d.ok && d.status], [false, 401]);
});

test("cookie: changing data needs a matching Origin", async () => {
  const noOrigin = await decide({ ...post, origin: null }, "manage-users", as("admin"));
  assert.deepEqual([noOrigin.ok, !noOrigin.ok && noOrigin.error], [false, "Bad origin"]);
  const evil = await decide({ ...post, origin: "https://evil.test" }, "manage-users", as("admin"));
  assert.equal(evil.ok, false);
  assert.equal((await decide(post, "manage-users", as("admin"))).ok, true);
});

test("cookie: reads need no Origin", async () => {
  assert.equal((await decide(base, "read", as("user"))).ok, true);
});

test("cookie: role matrix", async () => {
  assert.equal((await decide(post, "manage-users", as("user"))).ok, false);
  assert.equal((await decide(post, "write-cohort", as("user"))).ok, false);
  assert.equal((await decide(post, "tick-task", as("user"))).ok, true);
  assert.equal((await decide(post, "manage-users", as("owner"))).ok, true);
});

test("session is not looked up when a token header is present", async () => {
  let called = false;
  await decide({ ...base, authorization: "Bearer secret-token" }, "read", async () => {
    called = true;
    return null;
  });
  assert.equal(called, false);
});
