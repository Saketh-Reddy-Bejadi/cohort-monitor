import { test } from "node:test";
import assert from "node:assert/strict";
import { sameOrigin, tokenMatches } from "../lib/request-checks.ts";

const T = "secret-token-secret-token-secret-token";

test("bearer token", () => {
  assert.equal(tokenMatches(`Bearer ${T}`, T), true);
  assert.equal(tokenMatches(`Bearer ${T.slice(0, -1)}!`, T), false);
  assert.equal(tokenMatches("Bearer short", T), false);
  assert.equal(tokenMatches(`bearer ${T}`, T), true);
  assert.equal(tokenMatches(T, T), false);
  assert.equal(tokenMatches(null, T), false);
  assert.equal(tokenMatches("Bearer ", ""), false);
  assert.equal(tokenMatches("Bearer x", undefined), false);
  assert.equal(tokenMatches("Bearer change-me-long-random-string", "change-me-long-random-string"), false);
});

test("origin check", () => {
  assert.equal(sameOrigin("http://localhost:3100", "localhost:3100"), true);
  assert.equal(sameOrigin("https://evil.com", "localhost:3100"), false);
  assert.equal(sameOrigin("https://localhost:3100.evil.com", "localhost:3100"), false);
  assert.equal(sameOrigin(null, "localhost:3100"), false);
  assert.equal(sameOrigin("http://localhost:3100", null), false);
  assert.equal(sameOrigin("not a url", "localhost:3100"), false);
});
