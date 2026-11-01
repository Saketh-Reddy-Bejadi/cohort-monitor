import { can } from "@/lib/roles.ts";
import { authorize } from "@/lib/api-auth";
import { parseCohort } from "@/lib/planner/schema.ts";
import { listCohorts, replaceCohort, upsertCohort, withoutAuthor } from "@/lib/planner/store";

const MAX_BODY = 20_000;

export async function GET(request: Request) {
  const result = await authorize(request, "read");
  if (result instanceof Response) return result;
  const cohorts = await listCohorts();
  return Response.json({ cohorts: can(result.actor, "write-cohort") ? cohorts : cohorts.map(withoutAuthor) });
}

/**
 * Create or fully replace a cohort by id. Blank fields are cleared, so send every field you want kept.
 * To avoid overwriting someone else's save, send the `updated_at` you last read: the
 * replace then only goes through if the cohort is unchanged (409 if not, 404 if deleted).
 */
export async function POST(request: Request) {
  const result = await authorize(request, "write-cohort");
  if (result instanceof Response) return result;

  // A real cohort is a few kilobytes, so refuse anything much bigger.
  const raw = await request.text();
  if (raw.length > MAX_BODY) return Response.json({ error: "Body too large" }, { status: 413 });
  const body = (() => { try { return JSON.parse(raw); } catch { return null; } })();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Send a JSON object" }, { status: 400 });
  }
  const parsed = parseCohort(body);
  if (!parsed.ok) return Response.json({ errors: parsed.errors }, { status: 400 });

  const by = result.email ?? "api-token";
  const loadedAt = body.updated_at;
  if (loadedAt !== undefined) {
    if (typeof loadedAt !== "string" || Number.isNaN(Date.parse(loadedAt))) {
      return Response.json({ error: "updated_at must be a date string" }, { status: 400 });
    }
    const saved = await replaceCohort(parsed.cohort, by, loadedAt);
    if (saved === "missing") return Response.json({ error: "Cohort not found" }, { status: 404 });
    if (saved === "stale") return Response.json({ error: "Cohort changed since updated_at. Read it again." }, { status: 409 });
  } else {
    await upsertCohort(parsed.cohort, by);
  }
  return Response.json({ cohort: parsed.cohort });
}
