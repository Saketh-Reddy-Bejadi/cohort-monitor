import { authorize } from "@/lib/api-auth";
import { parseCohort } from "@/lib/planner/schema.ts";
import { listCohorts, upsertCohort } from "@/lib/planner/store";

export async function GET(request: Request) {
  const result = await authorize(request, "read");
  if (result instanceof Response) return result;
  return Response.json({ cohorts: await listCohorts() });
}

/** Create or fully replace a cohort by id. Blank fields are cleared, so send every field you want kept. */
export async function POST(request: Request) {
  const result = await authorize(request, "write-cohort");
  if (result instanceof Response) return result;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Send a JSON object" }, { status: 400 });
  }
  const parsed = parseCohort(body);
  if (!parsed.ok) return Response.json({ errors: parsed.errors }, { status: 400 });

  await upsertCohort(parsed.cohort, result.email ?? "api-token");
  return Response.json({ cohort: parsed.cohort });
}
