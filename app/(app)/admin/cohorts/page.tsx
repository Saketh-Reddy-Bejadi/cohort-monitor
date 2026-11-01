import Link from "next/link";
import { Suspense } from "react";
import { DeleteButton } from "@/components/admin/delete-button";
import { fmtDate, fmtRupees } from "@/lib/format";
import { listCohorts } from "@/lib/planner/store";
import { requireAdmin } from "@/lib/session";
import { deleteCohortAction } from "../actions";

async function CohortTable() {
  await requireAdmin();
  const cohorts = await listCohorts();
  if (cohorts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center">
        <p className="font-semibold">No cohorts yet</p>
        <p className="mt-1 text-sm text-slate-600">Add the first one to start tracking its launch.</p>
      </div>
    );
  }
  return (
    <div className="animate-rise overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full min-w-[820px] text-left text-sm">
        <caption className="sr-only">All cohorts</caption>
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {["Cohort", "Kind", "Status", "Launch", "Classes start", "Standard price", "Enrolment closes", ""].map((h, i) => (
              <th key={i} scope="col" className="px-4 py-3 font-semibold">
                {h || <span className="sr-only">Actions</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {cohorts.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50/60">
              <td className="px-4 py-3">
                <p className="font-semibold">{c.name}</p>
                <p className="text-xs text-slate-500">{c.program || c.id}</p>
              </td>
              <td className="px-4 py-3">{c.kind}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                  {c.status}
                </span>
              </td>
              <td className="px-4 py-3">{fmtDate(c.launch)}</td>
              <td className="px-4 py-3">{fmtDate(c.start)}</td>
              <td className="px-4 py-3">{fmtRupees(c.standard_price)}</td>
              <td className="px-4 py-3">{fmtDate(c.enrol_close)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <Link
                    href={`/admin/cohorts/${c.id}`}
                    className="press inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
                  >
                    <span className="icon-[heroicons--pencil-square] size-4" />
                    Edit
                  </Link>
                  <DeleteButton action={deleteCohortAction.bind(null, c.id)} label={c.name} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CohortsAdminPage() {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Cohorts</h2>
        <Link
          href="/admin/cohorts/new"
          className="press inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <span className="icon-[heroicons--plus] size-4" />
          Add cohort
        </Link>
      </div>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />}>
        <CohortTable />
      </Suspense>
    </section>
  );
}
