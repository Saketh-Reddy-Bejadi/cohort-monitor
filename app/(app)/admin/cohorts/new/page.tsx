import Link from "next/link";
import { Suspense } from "react";
import { CohortForm } from "@/components/admin/cohort-form";
import { requireAdmin } from "@/lib/session";
import { createCohortAction } from "../../actions";

async function NewCohort() {
  await requireAdmin();
  return <CohortForm action={createCohortAction} mode="create" initial={{ kind: "Live cohort", status: "active" }} />;
}

export default function NewCohortPage() {
  return (
    <section>
      <Link href="/admin/cohorts" className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-brand-700">
        <span className="icon-[heroicons--arrow-left] size-4" />
        All cohorts
      </Link>
      <h2 className="mb-4 text-lg font-bold">Add cohort</h2>
      <Suspense>
        <NewCohort />
      </Suspense>
    </section>
  );
}
