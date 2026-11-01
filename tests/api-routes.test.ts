import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function routes(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return routes(p);
    return n === "route.ts" ? [p] : [];
  });
}

// Auth.js handles its own routes. Every other API route must call authorize().
test("every API route calls authorize()", () => {
  for (const file of routes("app/api")) {
    if (file.includes("[...nextauth]")) continue;
    assert.match(readFileSync(file, "utf8"), /\bauthorize\(/, `${file} does not call authorize()`);
  }
});
