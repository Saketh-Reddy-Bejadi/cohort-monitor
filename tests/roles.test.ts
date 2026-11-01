import { test } from "node:test";
import assert from "node:assert/strict";
import {
  can,
  canDeleteCustom,
  roleChangeOutcome,
  isAllowedEmail,
  publicRole,
  resolveRole,
  resolveTarget,
  type Actor,
} from "../lib/roles.ts";

test("only the company domain is allowed", () => {
  assert.equal(isAllowedEmail("a@codebasics.io", "codebasics.io"), true);
  assert.equal(isAllowedEmail("A@CodeBasics.io", "@codebasics.io"), true);
  assert.equal(isAllowedEmail("a@evil.com", "codebasics.io"), false);
  assert.equal(isAllowedEmail("a@codebasics.io.evil.com", "codebasics.io"), false);
  assert.equal(isAllowedEmail("a@sub.codebasics.io", "codebasics.io"), false);
  assert.equal(isAllowedEmail("", "codebasics.io"), false);
  assert.equal(isAllowedEmail(null, "codebasics.io"), false);
  assert.equal(isAllowedEmail("a@codebasics.io", ""), false);
});

test("owner email always resolves to owner", () => {
  assert.equal(resolveRole("Me@codebasics.io", "user", "me@codebasics.io"), "owner");
  assert.equal(resolveRole("x@codebasics.io", "admin", "me@codebasics.io"), "admin");
  assert.equal(resolveRole("x@codebasics.io", "owner", "me@codebasics.io"), "user");
  assert.equal(resolveRole("x@codebasics.io", undefined, ""), "user");
});

test("owner is shown as admin", () => {
  assert.equal(publicRole("owner"), "admin");
  assert.equal(publicRole("admin"), "admin");
  assert.equal(publicRole("user"), "user");
});

test("role matrix", () => {
  const user: Actor = { kind: "user", role: "user" };
  const admin: Actor = { kind: "user", role: "admin" };
  const owner: Actor = { kind: "user", role: "owner" };
  const token: Actor = { kind: "token" };
  const rows = [
    ["read", [true, true, true, true]],
    ["tick-task", [true, true, true, false]],
    ["change-task", [true, true, true, false]],
    ["admin-panel", [false, true, true, false]],
    ["write-cohort", [false, true, true, true]],
    ["delete-cohort", [false, true, true, false]],
    ["manage-users", [false, true, true, false]],
  ] as const;
  for (const [action, expected] of rows) {
    assert.deepEqual(
      [user, admin, owner, token].map((a) => can(a, action)),
      [...expected],
      action,
    );
  }
});

test("role changes", () => {
  const user: Actor = { kind: "user", role: "user" };
  const admin: Actor = { kind: "user", role: "admin" };
  const normal = { role: "user" as const };
  assert.equal(roleChangeOutcome(admin, normal, "admin"), "apply");
  assert.equal(roleChangeOutcome(admin, normal, "owner"), "bad-role");
  assert.equal(roleChangeOutcome(admin, normal, "root"), "bad-role");
  assert.equal(roleChangeOutcome(admin, null, "admin"), "not-found");
  assert.equal(roleChangeOutcome(user, normal, "admin"), "forbidden");
  assert.equal(roleChangeOutcome({ kind: "token" }, normal, "admin"), "forbidden");
});

test("owner cannot be picked out", () => {
  const admin: Actor = { kind: "user", role: "admin" };
  // A bad role gives the same answer for the owner as for anyone.
  assert.equal(roleChangeOutcome(admin, { role: "owner" }, "root"), "bad-role");
  assert.equal(roleChangeOutcome(admin, { role: "admin" }, "root"), "bad-role");
  // A valid change on the owner changes nothing and is not an error.
  assert.equal(roleChangeOutcome(admin, { role: "owner" }, "user"), "noop");
});

test("owner who never signed in looks the same as a signed-in owner", () => {
  const admin: Actor = { kind: "user", role: "admin" };
  const owner = "Me@codebasics.io";
  const target = resolveTarget(null, "me@codebasics.io", owner);
  assert.equal(roleChangeOutcome(admin, target, "user"), "noop");
  assert.equal(resolveTarget(null, "x@codebasics.io", owner), null);
  assert.equal(resolveTarget(null, "me@codebasics.io", ""), null);
  const found = { role: "user" as const };
  assert.equal(resolveTarget(found, "x@codebasics.io", owner), found);
});

test("a one-off task is deleted by its creator or an admin, never by the token", () => {
  const user: Actor = { kind: "user", role: "user" };
  const admin: Actor = { kind: "user", role: "admin" };
  const owner: Actor = { kind: "user", role: "owner" };
  assert.equal(canDeleteCustom(user, "a@codebasics.io", "a@codebasics.io"), true);
  assert.equal(canDeleteCustom(user, " A@CodeBasics.io ", "a@codebasics.io"), true);
  assert.equal(canDeleteCustom(user, "b@codebasics.io", "a@codebasics.io"), false);
  assert.equal(canDeleteCustom(admin, "b@codebasics.io", "a@codebasics.io"), true);
  assert.equal(canDeleteCustom(owner, "b@codebasics.io", "a@codebasics.io"), true);
  assert.equal(canDeleteCustom({ kind: "token" }, "a@codebasics.io", "a@codebasics.io"), false);
});
