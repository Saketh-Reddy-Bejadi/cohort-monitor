import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AddTaskPanel } from "@/components/tasks/add-task-panel";
import { fmtDay, fmtDayYear } from "@/lib/format";
import { buildOverview, firstName, greeting, relativeDays, type LaunchTile, type PageLine } from "@/lib/planner/overview.ts";
import { can } from "@/lib/roles.ts";
import { loadTasks } from "@/lib/planner/state";
import { DUE_LABELS, HORIZON_DAYS, ownerNames } from "@/lib/planner/tasks-view.ts";
import { hourIST } from "@/lib/planner/today.ts";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Overview" };

const chip = "rounded-full px-2 py-0.5 text-xs font-medium";

/** A tile in the hero: a number that links to the matching list of tasks. */
function Stat({ href, label, value, alert = false }: { href: string; label: string; value: number; alert?: boolean }) {
  const hot = alert && value > 0;
  return (
    <Link
      href={href}
      className={`press block rounded-2xl border p-4 transition-colors ${
        hot ? "border-red-200 bg-red-50 hover:bg-red-100" : "border-slate-200 bg-white hover:border-brand-600/40 hover:bg-brand-50"
      }`}
    >
      <p className={`text-3xl font-extrabold tabular-nums ${hot ? "text-red-700" : ""}`}>{value}</p>
      <p className={`mt-0.5 text-sm ${hot ? "text-red-700" : "text-slate-600"}`}>{label}</p>
    </Link>
  );
}

function lineHref(l: PageLine): string {
  return l.cohortId && l.page !== "One-off"
    ? `/tasks?cohort=${encodeURIComponent(l.cohortId)}&q=${encodeURIComponent(l.page)}`
    : `/tasks?q=${encodeURIComponent(l.text.slice(0, 100))}`;
}

function Lines({ lines }: { lines: PageLine[] }) {
  return (
    <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
      {lines.map((l) => (
        <li key={l.key}>
          <Link href={lineHref(l)} className="press flex items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-50">
            <span
              aria-hidden
              className={`mt-1.5 size-2.5 shrink-0 rounded-full ${l.status === "overdue" ? "bg-red-500" : l.status === "today" ? "bg-brand-600" : "bg-slate-300"}`}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{l.cohortName ? `${l.cohortName} · ${l.page}` : "One-off task"}</span>
              <span className="block truncate text-sm text-slate-600">{l.text}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <span className={`text-xs font-medium ${l.status === "overdue" ? "text-red-700" : "text-slate-500"}`}>
                {l.status === "overdue" ? `Since ${fmtDay(l.date)}` : fmtDay(l.date)}
              </span>
              {l.goLive && <span className={`${chip} bg-amber-50 text-amber-800`}>Go-live</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Tile({ l }: { l: LaunchTile }) {
  const when = l.state === "launched" ? `Launched ${relativeDays(l.inDays)}` : l.state === "today" ? "Launches today" : `Launches ${relativeDays(l.inDays)}`;
  return (
    <li>
      <Link
        href={`/tasks?cohort=${encodeURIComponent(l.id)}`}
        className={`press block h-full rounded-2xl border p-4 transition-colors ${
          l.state === "today" ? "border-brand-600 bg-brand-50" : l.state === "launched" ? "border-slate-200 bg-slate-50 hover:bg-slate-100" : "border-slate-200 bg-white hover:border-brand-600/40 hover:bg-brand-50"
        }`}
      >
        <p className="font-bold">{l.name}</p>
        <p className="text-sm text-slate-600">{fmtDayYear(l.launch)}</p>
        <p className={`mt-2 text-sm font-medium ${l.state === "launched" ? "text-slate-500" : "text-brand-700"}`}>{when}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {l.open} open{l.overdue > 0 && <span className="font-medium text-red-700"> · {l.overdue} overdue</span>}
        </p>
      </Link>
    </li>
  );
}

function Section({ title, hint, children }: { title: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="min-w-0">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-bold">{title}</h2>
        {hint}
      </div>
      {children}
    </section>
  );
}

function Quiet({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center">
      <span className={`${icon} mx-auto size-7 text-slate-400`} />
      <p className="mt-2 font-semibold">{title}</p>
      <p className="mt-0.5 text-sm text-slate-600">{body}</p>
    </div>
  );
}

// Layouts do not protect their pages. Every page that shows data must check
// the user itself, before it reads anything. Doing it first also makes the page
// dynamic, so the clock below is allowed.
async function OverviewContent() {
  const user = await requireUser();
  const { tasks, cohorts, today } = await loadTasks();
  const o = buildOverview({ tasks, cohorts, today });
  const isAdmin = can({ kind: "user", role: user.role }, "admin-panel");
  const active = cohorts.filter((c) => c.status === "active");

  return (
    <div className="space-y-8">
      <header className="animate-rise rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold">{greeting(hourIST())}, {firstName(user.name)}</h1>
            <p className="mt-2 text-slate-700">
              {o.nextLaunch ? (
                <>
                  Next launch: <strong>{o.nextLaunch.name}</strong> {relativeDays(o.nextLaunch.inDays)}
                  <span className="text-slate-500"> · {fmtDayYear(o.nextLaunch.launch)}</span>
                </>
              ) : (
                "No upcoming launches yet. Add a launch date to a cohort."
              )}
            </p>
            <p className="mt-1 text-sm text-slate-500">Today is {fmtDay(today)}. Dates are India dates.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AddTaskPanel
              cohorts={active.map((c) => ({ id: c.id, name: c.name }))}
              owners={ownerNames(tasks, cohorts)}
              today={today}
            />
            {isAdmin && (
              <Link
                href="/admin/cohorts/new"
                className="press inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                <span className="icon-[heroicons--plus] size-4" />
                Cohort
              </Link>
            )}
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat href="/tasks?status=overdue" label="Overdue" value={o.counts.overdue} alert />
          <Stat href="/tasks?due=today" label={DUE_LABELS.today} value={o.counts.today} />
          <Stat href="/tasks?due=week" label={DUE_LABELS.week} value={o.counts.thisWeek} />
          <Stat href="/tasks?due=golive" label={DUE_LABELS.golive} value={o.counts.goLives14} />
        </div>
      </header>

      <Section title="Launch dates" hint={<span className="text-xs text-slate-500">Last 21 days and everything ahead</span>}>
        {o.launches.length === 0 ? (
          <Quiet
            icon="icon-[heroicons--rocket-launch]" title="No launch dates yet"
            body={isAdmin ? "Add a launch date to a cohort in Admin and it shows up here." : "An admin can add launch dates to a cohort."}
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{o.launches.map((l) => <Tile key={l.id} l={l} />)}</ul>
        )}
      </Section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Section title="Needs attention" hint={<span className="text-xs text-slate-500">Overdue and due today</span>}>
          {o.attention.length === 0 ? (
            <Quiet icon="icon-[heroicons--check-circle]" title="Nothing needs attention" body="No task is overdue or due today." />
          ) : (
            <Lines lines={o.attention} />
          )}
        </Section>
        <Section title="Coming up" hint={<span className="text-xs text-slate-500">Next {HORIZON_DAYS} days</span>}>
          {o.upcoming.length === 0 ? (
            <Quiet icon="icon-[heroicons--clock]" title="Nothing coming up" body={`No task is due in the next ${HORIZON_DAYS} days.`} />
          ) : (
            <>
              <Lines lines={o.upcoming} />
              {o.upcomingMore > 0 && (
                <Link href="/tasks" className="press mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50">
                  {o.upcomingMore} more pages. See all open tasks
                  <span className="icon-[heroicons--arrow-right] size-4" />
                </Link>
              )}
            </>
          )}
        </Section>
      </div>
    </div>
  );
}

export default function Overview() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-slate-100 motion-reduce:animate-none" />}>
      <OverviewContent />
    </Suspense>
  );
}
