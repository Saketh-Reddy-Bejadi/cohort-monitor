"use client";

import { startTransition, useOptimistic, useState } from "react";
import { toggleTaskAction } from "@/app/(app)/tasks/actions";
import { TaskDateEditor } from "@/components/tasks/task-date-editor";
import { Checkbox } from "@/components/ui/checkbox";
import type { Task } from "@/lib/planner/engine.ts";
import { fmtDay, fmtMoment } from "@/lib/format";

const chip = "rounded-full px-2 py-0.5 text-xs font-medium";

export function TaskRow({ task }: { task: Task }) {
  const [done, setDone] = useOptimistic(task.status === "done");
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState(false);

  function onChange(next: boolean) {
    setError(undefined);
    startTransition(async () => {
      setDone(next); // respond at once; it snaps back by itself if the save fails
      try {
        const res = await toggleTaskAction(task.key, next);
        if (res.error) setError(res.error);
      } catch {
        setError("Could not save. Try again.");
      }
    });
  }

  const status = done ? "done" : task.status;
  return (
    <li className="animate-rise -mx-3 flex gap-3 rounded-xl border-b border-slate-100 px-3 py-3 transition-colors last:border-0 hover:bg-slate-50">
      <Checkbox
        checked={done}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={`Mark done: ${task.text}`}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${done ? "text-slate-400 line-through" : ""}`}>{task.text}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          {task.cohortName ? (
            <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">{task.cohortName}</span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">General</span>
          )}
          <span>{task.page} · {task.label}</span>
          <time dateTime={task.date} className={status === "overdue" ? "font-semibold text-red-700" : ""}>
            {fmtDay(task.date)}
          </time>
          {task.owner && <span>{task.owner}</span>}
          {!done && (
            <button
              type="button" onClick={() => setEditing((v) => !v)} aria-expanded={editing}
              aria-label={`Change date: ${task.text}`}
              className="press -my-1 inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-medium text-brand-700 hover:bg-brand-50"
            >
              <span className="icon-[heroicons--calendar-days] size-3.5" />
              Change
            </button>
          )}
          {status === "overdue" && <span className={`${chip} bg-red-50 text-red-700`}>Overdue</span>}
          {status === "today" && <span className={`${chip} bg-brand-50 text-brand-700`}>Today</span>}
          {task.goLive && <span className={`${chip} bg-amber-50 text-amber-800`}>Go-live</span>}
          {task.tags.map((t) => <span key={t} className={`${chip} bg-amber-50 text-amber-800`}>{t}</span>)}
          {task.override && (
            <span className={`${chip} bg-slate-100 text-slate-700`} title={task.override.reason}>
              Moved{task.recommended ? ` from ${fmtDay(task.recommended)}` : ""}
            </span>
          )}
        </div>
        {task.notes.map((n) => <p key={n} className="mt-1 text-xs text-amber-800">{n}</p>)}
        {done && task.done?.by && (
          <p className="mt-1 text-xs text-slate-400">
            Done by {task.done.by}{task.done.at ? `, ${fmtMoment(new Date(task.done.at))}` : ""}
          </p>
        )}
        {error && <p role="alert" className="animate-rise mt-1 text-xs text-red-700">{error}</p>}
        {editing && !done && <TaskDateEditor task={task} onClose={() => setEditing(false)} />}
      </div>
    </li>
  );
}
