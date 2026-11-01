import { can } from "@/lib/roles.ts";
import { authorize } from "@/lib/api-auth";
import { deleteCohort, getCohort, withoutAuthor } from "@/lib/planner/store";

export async function GET(request: Request, ctx: RouteContext<"/api/cohorts/[id]">) {
  const result = await authorize(request, "read");
  if (result instanceof Response) return result;
  const { id } = await ctx.params;
  const cohort = await getCohort(id);
  return cohort
    ? Response.json({ cohort: can(result.actor, "write-cohort") ? cohort : withoutAuthor(cohort) })
    : Response.json({ error: "Cohort not found" }, { status: 404 });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/cohorts/[id]">) {
  const result = await authorize(request, "delete-cohort");
  if (result instanceof Response) return result;
  const { id } = await ctx.params;
  return (await deleteCohort(id))
    ? Response.json({ ok: true })
    : Response.json({ error: "Cohort not found" }, { status: 404 });
}
