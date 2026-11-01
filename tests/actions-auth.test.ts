import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

/** Drop comments and string contents so a mention of authorizeAction() in either cannot count. */
function stripNoise(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g, '""');
}

/** Every exported action (function or arrow const) with its source, up to the next export. */
function actionsOf(src: string): { name: string; body: string }[] {
  const parts = stripNoise(src).split(/^export (?=async function |const \w+\s*(?::[^=]+)?=\s*async)/m).slice(1);
  return parts.map((body) => ({ name: /^(?:async function |const )(\w+)/.exec(body)?.[1] ?? "?", body }));
}

// Server actions can be called directly. Every action in the signed-in area must
// check the user first, before it awaits anything else.
// (app/actions.ts is the public sign in and sign out, so it is not here.)
test("every server action in app/(app) calls authorizeAction() before any other await", () => {
  const actionFiles = files("app/(app)").filter(
    (f) => /\.tsx?$/.test(f) && /^["']use server["']/.test(readFileSync(f, "utf8").trimStart()),
  );
  assert.ok(actionFiles.length >= 2, "expected the admin and tasks action files");
  for (const f of actionFiles) {
    const actions = actionsOf(readFileSync(f, "utf8"));
    assert.ok(actions.length > 0, `${f} exports no actions`);
    for (const { name, body } of actions) {
      const call = body.indexOf("authorizeAction(");
      assert.ok(call >= 0, `${f}: ${name} does not call authorizeAction()`);
      const before = body.slice(0, call).replace(/await\s+$/, "");
      assert.ok(!before.includes("await"), `${f}: ${name} awaits something before authorizeAction()`);
    }
  }
});
