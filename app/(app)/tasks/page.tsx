import type { Metadata } from "next";
import { Suspense } from "react";
import { AddTaskPanel } from "@/components/tasks/add-task-panel";
import { TaskFilters } from "@/components/tasks/task-filters";
import { TaskRow } from "@/components/tasks/task-row";
import { fmtDay } from "@/lib/format";
import { loadTasks } from "@/lib/planner/state";
import { groupTasks, ownersOf, parseFilters, summarize } from "@/lib/planner/tasks-view.ts";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Tasks" };

async function TasksContent({ searchParams }: { searchParams: PageProps<"/tasks">["searchParams"] }) {
  await requireUser(); // first: this is what makes the page dynamic, so the clock below is allowed
  const filters = parseFilters(await searchParams);
  const { tasks, cohorts, today } = await loadTasks();
  const { visible, counts } = summarize(tasks, filters);
  const groups = groupTasks(visible, today);
  const narrowed = filters.cohort || filters.owner || filters.q;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Today is {fmtDay(today)}. Dates are India dates.</p>
        <AddTaskPanel
          cohorts={cohorts.filter((c) => c.status === "active").map((c) => ({ id: c.id, name: c.name }))}
          owners={[...new Set([...ownersOf(tasks), ...cohorts.flatMap((c) => [c.poc, c.pm])].filter((x): x is string => !!x))].sort()}
          today={today}
        />
      </div>
      {(cohorts.length > 0 || tasks.length > 0) && (
        <TaskFilters
          cohorts={cohorts.map((c) => ({ id: c.id, name: c.name }))}
          owners={ownersOf(tasks)}
          counts={counts}
          current={filters}
        />
      )}
      {cohorts.length === 0 && tasks.length === 0 ? (
        <Empty title="No cohorts yet" body="An admin can add one in Admin, and its tasks will show up here. You can also add a one-off task." />
      ) : groups.length === 0 ? (
        narrowed || filters.status !== "open" ? (
          <Empty title="No tasks match" body="Try another status or clear the filters." />
        ) : (
          <Empty title="Nothing open" body="You are all caught up. Add dates to a cohort to get more tasks." />
        )
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h2 className="mb-1 flex items-baseline gap-2 text-sm font-bold">
                {g.label}
                <span className="text-xs font-medium text-slate-400">{g.tasks.length}</span>
              </h2>
              <ul className="rounded-2xl border border-slate-200 px-4">
                {g.tasks.map((t) => <TaskRow key={t.key} task={t} />)}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="animate-rise rounded-2xl border border-dashed border-slate-300 p-10 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{body}</p>
    </div>
  );
}

export default function TasksPage(props: PageProps<"/tasks">) {
  return (
    <section>
      <h1 className="mb-1 text-2xl font-extrabold">Tasks</h1>
      <Suspense fallback={<div className="mt-4 h-48 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />}>
        <TasksContent searchParams={props.searchParams} />
      </Suspense>
    </section>
  );
}
