import { test } from "node:test";
import assert from "node:assert/strict";
import { sameOrigin, tokenMatches } from "../lib/request-checks.ts";

test("bearer token", () => {
  assert.equal(tokenMatches("Bearer secret-token", "secret-token"), true);
  assert.equal(tokenMatches("Bearer wrong-token!", "secret-token"), false);
  assert.equal(tokenMatches("Bearer short", "secret-token"), false);
  assert.equal(tokenMatches("bearer secret-token", "secret-token"), true);
  assert.equal(tokenMatches("secret-token", "secret-token"), false);
  assert.equal(tokenMatches(null, "secret-token"), false);
  assert.equal(tokenMatches("Bearer ", ""), false);
  assert.equal(tokenMatches("Bearer x", undefined), false);
});

test("origin check", () => {
  assert.equal(sameOrigin("http://localhost:3100", "localhost:3100"), true);
  assert.equal(sameOrigin("https://evil.com", "localhost:3100"), false);
  assert.equal(sameOrigin("https://localhost:3100.evil.com", "localhost:3100"), false);
  assert.equal(sameOrigin(null, "localhost:3100"), false);
  assert.equal(sameOrigin("http://localhost:3100", null), false);
  assert.equal(sameOrigin("not a url", "localhost:3100"), false);
});
