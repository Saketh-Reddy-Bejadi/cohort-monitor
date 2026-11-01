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
- **Only edit active files:** Don't modify unused/unreferenced files (e.g. unused scripts, blade components).

**Goal-driven execution.**
- **Test-Driven Dev & End-to-End Context**: When implementing a solution or solving a bug, approach development in a test-driven manner. Verify changes work by running tests and fix regression breaks. Maintain deep, end-to-end context of the codebase lifecycle: understand how data is passed, saved, cached, executed, and used. Be fully aware of which standards are followed, exactly what to fix, and what *not* to touch.
- Note out-of-scope issues—don't fix silently.

---

## Lazy Senior Dev Mode

Before writing code, stop at first rung:
1. Needed at all? (YAGNI)
2. Exists in codebase? Reuse helper, util, pattern.
3. Laravel/std-lib does it? Use it.
4. Installed dependency solves it? Use it (check `composer.json`/`package.json` first).
5. Can be one line? Make it one line.

**Rules:**
- **Avoid Duplication:** If same code, HTML, script used in multiple places, extract to helper function/Blade component and reuse.
- **Bug fix = root cause, not symptom:** grep callers of modified function; fix shared function once (one guard at source vs one per caller).

---

## Gotchas & Landmines

- **`Webinar` model is Course model:** Called "webinar" in code (model, table, routes), represents "course" on frontend. **Don't rename or create Course model.** Always use `Webinar` for course work.
- **`Bundle` model is Bootcamp model:** Called "bundle" in code, "bootcamp" on frontend.
- **`User` model:** Lives at `app/User.php` (not `app/Models/`). Legacy location—don't move.
- **Autoloaded Helpers:** `app/Helpers/helper.php`, `app/Mixins/Geo/Geo.php`, `app/Helpers/ApiHelper.php` (functions globally available).
- **Docker**: Run `./setup-local.sh` (interactive setup).
- **Composer installs may fail over unrelated security advisories:** the locked dependency tree carries many pre-existing ones, listed by id under `config.audit.ignore` in `composer.json`. If an operation fails naming a new advisory id, add just that id to the `ignore` list — composer's error message names it directly.
- **Don't manage those advisories via `policy.advisories.*`:** it's Composer's documented non-deprecated config for ignoring/blocking advisories, but it had no effect on blocking or on `composer audit` output when tested (Composer 2.9.1). Use the deprecated `audit.ignore` key instead, which does work. Never set `audit.block-insecure: false` — it silences all advisories, including future ones on packages nobody has touched yet.

## Tech Stack & Coding Standards

- **Database**: MySQL only. Database sessions (`SESSION_DRIVER=database`) and queues (`QUEUE_CONNECTION=database`) default. Cache prefix uses `{codebasics_cache}`.
- **Frontend**: Webpack/Mix (no Vite), Vue 2.x, jQuery 2.2.4, Bootstrap 4. Compiled to `public/assets/default/`.
- **PHP Style**: PSR-12 (4 spaces, `&&`/`||`, `[]`, single quotes), DocBlocks required, declared return types, `$fillable`/`$guarded` on Models.
- **Blade Templates**: In `resources/views/`. Use `{{ $variable }}` default (escaped); `{!! !!}` only for trusted content.

---

## Don't Touch

- **`vendor/`**, **`node_modules/`**: Managed by Composer/npm. Never edit directly.
- **`public/assets/`** compiled output: Edit source files in `resources/` instead.
- **`storage/`** runtime files: Don't commit contents.
- **`.env`** local config: Never commit. Edit `.env.example` only for new env vars (use options table or config files for settings).
- **`composer.lock`**: Only update via `composer update`. Don't edit manually.