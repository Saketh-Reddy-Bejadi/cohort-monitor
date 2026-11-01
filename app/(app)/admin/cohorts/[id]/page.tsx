import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CohortForm } from "@/components/admin/cohort-form";
import { getCohort } from "@/lib/planner/store";
import { requireAdmin } from "@/lib/session";
import { updateCohortAction } from "../../actions";

async function EditCohort({ params }: { params: PageProps<"/admin/cohorts/[id]">["params"] }) {
  await requireAdmin();
  const { id } = await params;
  const cohort = await getCohort(id);
  if (!cohort) notFound();
  return (
    <>
      <h2 className="mb-4 text-lg font-bold">Edit {cohort.name}</h2>
      <CohortForm action={updateCohortAction.bind(null, cohort.id, cohort.updated_at)} mode="edit" initial={cohort} />
    </>
  );
}

export default function EditCohortPage(props: PageProps<"/admin/cohorts/[id]">) {
  return (
    <section>
      <Link href="/admin/cohorts" className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-brand-700">
        <span className="icon-[heroicons--arrow-left] size-4" />
        All cohorts
      </Link>
      <Suspense>
        <EditCohort params={props.params} />
      </Suspense>
    </section>
  );
}
