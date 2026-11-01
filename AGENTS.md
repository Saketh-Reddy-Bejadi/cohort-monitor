<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md

## Behavioral Principles

**Think before coding. Don't assume. Don't hide confusion. Surface tradeoffs.**
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present options—don't pick silently.
- If simpler approach exists, say so. Push back when warranted.
- If unclear, stop. Name confusion. Ask.

**Simplicity first. Minimum working code. Nothing speculative.**
- No features beyond asked.
- No abstractions for single-use code.
- No unrequested "flexibility" or "configurability".
- No new dependencies if avoidable.
- Deletion > addition. Boring > clever.
- Shortest working diff wins (understand problem first).

**Surgical changes. Touch only what you must.**
- Don't "improve" adjacent code, comments, formatting.
- Don't refactor unbroken code.
- Match existing style, even if disliked.
- Preserve unrelated comments/docstrings.
- **Only edit active files:** Don't modify unused/unreferenced files (e.g. unused scripts, components).

**Goal-driven execution.**
- **Test-Driven Dev & End-to-End Context**: When implementing a solution or solving a bug, approach development in a test-driven manner. Verify changes work by running tests and fix regression breaks. Maintain deep, end-to-end context of the codebase lifecycle: understand how data is passed, saved, cached, executed, and used. Be fully aware of which standards are followed, exactly what to fix, and what *not* to touch.
- Note out-of-scope issues—don't fix silently.

---

## Lazy Senior Dev Mode

Before writing code, stop at first rung:
1. Needed at all? (YAGNI)
2. Exists in codebase? Reuse helper, util, pattern.
3. Next.js/React/std-lib does it? Use it.
4. Installed dependency solves it? Use it (check `package.json` first).
5. Can be one line? Make it one line.

**Rules:**
- **Avoid Duplication:** If same code or markup used in multiple places, extract to a helper in `lib/` or a component in `components/` and reuse.
- **Bug fix = root cause, not symptom:** grep callers of modified function; fix shared function once (one guard at source vs one per caller).

---

## Tech Stack & Coding Standards

- **Framework**: Next.js (App Router, `proxy.ts`), React, TypeScript. Auth via Auth.js (`next-auth`) with Microsoft sign-in.
- **Database**: MongoDB (`mongodb` driver, client in `lib/db.ts`).
- **Styling**: Tailwind CSS 4 in `app/globals.css`.
- **Tests**: `npm test` (Node built-in test runner, `tests/*.test.ts`). Keep authorization logic in pure functions so it stays testable.
- **Lint**: `npm run lint`.

---

## Don't Touch

- **`node_modules/`**, **`.next/`**: Managed by npm / build output. Never edit directly.
- **`.env`** local config: Never commit. Edit `.env.example` only for new env vars.
- **`package-lock.json`**: Only change via npm. Don't edit manually.
