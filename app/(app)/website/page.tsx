import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TaskRow } from "@/components/tasks/task-row";
import { Checklist } from "@/components/website/checklist";
import { CohortPicker } from "@/components/website/cohort-picker";
import { fmtDay, fmtDayYear } from "@/lib/format";
import { daysBetween } from "@/lib/planner/dates.ts";
import { can } from "@/lib/roles.ts";
import { loadTasks } from "@/lib/planner/state";
import type { Cohort } from "@/lib/planner/types.ts";
import {
  buildRows, checklistTicks, cohortOptions, pickChange, pickRow, prepText, relativeDays, stepStates, tasksForChange, type StepState,
} from "@/lib/planner/website-view.ts";
import type { SiteState } from "@/lib/planner/website.ts";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Website status" };

const DOT: Record<SiteState, string> = {
  "no-dates": "bg-slate-300", archived: "bg-slate-300", "not-listed": "bg-slate-300",
  waitlist: "bg-amber-500", open: "bg-emerald-500", closed: "bg-slate-500",
};

const PAGES = [
  ["Homepage card", "home"], ["Waitlist LP", "waitlist"], ["Bootcamp detail page", "native"], ["Dark LP", "dark"],
] as const;

const STEP: Record<StepState, { label: string; icon: string; tone: string }> = {
  live: { label: "Live", icon: "icon-[heroicons--check-circle]", tone: "text-emerald-700" },
  next: { label: "Next", icon: "icon-[heroicons--clock]", tone: "text-brand-700" },
  later: { label: "Later", icon: "icon-[heroicons--calendar-days]", tone: "text-slate-500" },
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const link = (c: Cohort, page: string, env: "beta" | "url") => c[`${page}_${env}` as keyof Cohort] as string | undefined;

function PageLinks({ cohort }: { cohort: Cohort }) {
  const set = PAGES.filter(([, k]) => link(cohort, k, "beta") || link(cohort, k, "url"));
  if (set.length === 0) return <p className="text-sm text-slate-500">No page links yet.</p>;
  const a = "press inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50";
  return (
    <dl className="space-y-2">
      {set.map(([label, k]) => (
        <div key={k} className="flex items-center justify-between gap-3">
          <dt className="text-sm text-slate-600">{label}</dt>
          <dd className="flex shrink-0 gap-1.5">
            {(["beta", "url"] as const).map((env) => {
              const href = link(cohort, k, env);
              return href ? (
                <a key={env} href={href} target="_blank" rel="noopener noreferrer" className={a}>
                  {env === "beta" ? "Beta" : "Live"}
                  <span className="icon-[heroicons--arrow-top-right-on-square] size-3.5" />
                </a>
              ) : (
                <span key={env} className="whitespace-nowrap rounded-lg px-2.5 py-1 text-xs text-slate-400">{env === "beta" ? "No beta" : "No live"}</span>
              );
            })}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** The title and description, with the cohort picker on the right. */
function Header({ picker }: { picker?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 flex-1 basis-72">
        <h1 className="text-2xl font-extrabold">Website status</h1>
        <p className="mt-1 text-sm text-slate-600">
          What a cohort&apos;s website should say today, and what has to change next. Pick a cohort to see its checklist.
        </p>
      </div>
      {picker}
    </div>
  );
}

// Layouts do not protect their pages. Every page that shows data must check
// the user itself, before it reads anything. Doing it first also makes the page
// dynamic, so the clock below is allowed.
async function WebsiteContent({ searchParams }: { searchParams: PageProps<"/website">["searchParams"] }) {
  const user = await requireUser();
  const sp = await searchParams;
  const { tasks, cohorts, today, holidays, overrides, done } = await loadTasks();
  const isAdmin = can({ kind: "user", role: user.role }, "admin-panel");

  const rows = buildRows({ cohorts, today, holidays, overrides });
  const row = pickRow(rows, first(sp.cohort));
  if (!row) {
    return (
      <>
        <Header />
        <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center">
        <p className="font-semibold">No active cohorts yet</p>
        <p className="mt-1 text-sm text-slate-600">
          {isAdmin ? "Add a cohort in Admin to see what its website should show." : "An admin can add a cohort."}
        </p>
        </div>
      </>
    );
  }
  const chosen = pickChange(row, first(sp.change));
  const c = row.cohort;

  return (
    <>
      <Header picker={<CohortPicker options={cohortOptions(rows)} selectedId={c.id} />} />

      <section id="detail" aria-label={`${c.name} website status`} className="animate-rise scroll-mt-6 rounded-3xl border border-slate-200 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold">{c.name}</h2>
            <p className="text-sm text-slate-600">{c.kind}{c.program ? ` · ${c.program}` : ""}</p>
            <p className="mt-2 text-sm">
              {row.next ? (
                <>
                  <span className="font-semibold">Next change: {row.next.label}</span>
                  <span className="text-slate-600"> · {fmtDay(row.next.date)} · {relativeDays(row.next.inDays)} · </span>
                  <span className={row.next.prepStarted ? "font-medium text-brand-700" : "text-slate-600"}>{prepText(row.next)}</span>
                </>
              ) : (
                <span className="text-slate-600">{row.changes.length > 0 ? "No more website changes are scheduled." : "No dates yet."}</span>
              )}
            </p>
          </div>
          {isAdmin && (
            <Link
              href={`/admin/cohorts/${encodeURIComponent(c.id)}`}
              className="press inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-medium hover:bg-slate-50"
            >
              <span className="icon-[heroicons--pencil-square] size-4" />
              Edit cohort
            </Link>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="min-w-0 rounded-2xl bg-brand-50 p-4">
            <h3 className="mb-2 text-sm font-bold">The site should show today</h3>
            <p className="flex items-start gap-2 text-sm font-medium">
              <span aria-hidden className={`mt-1.5 size-2.5 shrink-0 rounded-full ${DOT[row.view.state]}`} />
              {row.view.enrolment}
            </p>
            {row.view.price && <p className="ml-4.5 mt-1 text-sm text-slate-700">{row.view.price}</p>}
            {row.view.classes && <p className="ml-4.5 mt-1 text-sm text-slate-700">{row.view.classes}</p>}
          </div>
          <div className="min-w-0">
            <h3 className="mb-2 text-sm font-bold">Page links</h3>
            <PageLinks cohort={c} />
          </div>
        </div>

        {row.changes.length === 0 || !chosen ? (
          <p className="mt-6 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">
            No dates yet, so there are no website changes to plan.{isAdmin ? " Add dates to the cohort." : " An admin can add dates."}
          </p>
        ) : (
          <>
            <h3 className="mb-2 mt-6 text-sm font-bold">The five website changes</h3>
            <ol className="flex gap-2 overflow-x-auto pb-1">
              {stepStates(row, today).map(({ change, state }) => {
                const s = STEP[state];
                const isChosen = change.id === chosen.id;
                return (
                  <li key={change.id} className="min-w-36 flex-1">
                    <Link
                      href={`/website?cohort=${encodeURIComponent(c.id)}&change=${change.id}#detail`}
                      aria-current={isChosen ? "step" : undefined}
                      className={`press block h-full rounded-2xl border p-3 transition-colors ${
                        isChosen ? "border-brand-600 bg-brand-50 ring-2 ring-brand-600/20" : "border-slate-200 hover:border-brand-600/40 hover:bg-slate-50"
                      }`}
                    >
                      <span className={`flex items-center gap-1.5 text-xs font-medium ${s.tone}`}>
                        <span className={`${s.icon} size-4`} />
                        {s.label}
                      </span>
                      <span className="mt-1 block text-sm font-semibold">{change.label}</span>
                      <span className="block text-xs text-slate-500">{fmtDay(change.date)}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>

            <div className="mt-4 rounded-2xl border border-slate-200 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-base font-bold">{chosen.label}</h3>
                <p className="text-sm text-slate-600">
                  {fmtDayYear(chosen.date)} · {chosen.date <= today ? "live since then" : relativeDays(daysBetween(today, chosen.date))}
                </p>
              </div>
              <p className="mt-1 text-sm text-slate-600">{prepText({ prepStart: chosen.prepStart, prepStarted: chosen.prepStart <= today })}</p>

              <div className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-2">
                <section className="min-w-0" aria-label="Checklist">
                  <h4 className="mb-2 text-sm font-bold">Check on the website</h4>
                  <Checklist cohortId={c.id} changeId={chosen.id} ticks={checklistTicks(done, c.id, chosen)} />
                </section>
                <section className="min-w-0" aria-label="Tasks for this change">
                  <h4 className="mb-1 text-sm font-bold">Tasks for this change</h4>
                  {(() => {
                    const list = tasksForChange(tasks, c.id, chosen);
                    return list.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-600">No tasks lead up to this change.</p>
                    ) : (
                      <ul className="rounded-2xl border border-slate-200 px-4">
                        {list.map((t) => <TaskRow key={t.key} task={t} />)}
                      </ul>
                    );
                  })()}
                </section>
              </div>
            </div>
          </>
        )}
      </section>
    </>
  );
}

export default function WebsiteStatusPage(props: PageProps<"/website">) {
  return (
    <section>
      <Suspense
        fallback={
          <>
            <Header picker={<div className="h-[3.75rem] w-full animate-pulse rounded-lg bg-slate-100 sm:w-80 motion-reduce:animate-none" />} />
            <div className="h-64 animate-pulse rounded-3xl bg-slate-100 motion-reduce:animate-none" />
          </>
        }
      >
        <WebsiteContent searchParams={props.searchParams} />
      </Suspense>
    </section>
  );
}
