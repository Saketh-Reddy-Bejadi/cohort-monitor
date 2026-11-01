import { can } from "@/lib/roles.ts";
import { authorize } from "@/lib/api-auth";
import { parseCohort } from "@/lib/planner/schema.ts";
import { listCohorts, upsertCohort, withoutAuthor } from "@/lib/planner/store";

const MAX_BODY = 20_000;

export async function GET(request: Request) {
  const result = await authorize(request, "read");
  if (result instanceof Response) return result;
  const cohorts = await listCohorts();
  return Response.json({ cohorts: can(result.actor, "write-cohort") ? cohorts : cohorts.map(withoutAuthor) });
}

/** Create or fully replace a cohort by id. Blank fields are cleared, so send every field you want kept. */
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

  await upsertCohort(parsed.cohort, result.email ?? "api-token");
  return Response.json({ cohort: parsed.cohort });
}
