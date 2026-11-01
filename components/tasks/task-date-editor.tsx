"use client";

import { useId, useState, useTransition } from "react";
import { deleteTaskAction, moveTaskAction, resetMoveAction } from "@/app/(app)/tasks/actions";
import { fmtDay } from "@/lib/format";
import type { Task } from "@/lib/planner/engine.ts";
import type { MoveErrors } from "@/lib/planner/task-input.ts";

/**
 * Change one task's date, right under the task. A rule task needs a reason, and the
 * later steps on its page follow. A one-off task just takes the new date, and can be deleted.
 */
export function TaskDateEditor({ task, onClose }: { task: Task; onClose: () => void }) {
  const id = useId();
  const isCustom = task.key.startsWith("custom:");
  const [errors, setErrors] = useState<MoveErrors>({});
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  /** Run a save. Close on success, show the message on failure. */
  function run(save: () => Promise<{ error?: string; errors?: MoveErrors }>) {
    setError(undefined);
    setErrors({});
    startTransition(async () => {
      try {
        const res = await save();
        if (res.errors) setErrors(res.errors);
        else if (res.error) setError(res.error);
        else onClose();
      } catch {
        setError("Could not save. Try again.");
      }
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(() => moveTaskAction(task.key, String(f.get("date") ?? ""), String(f.get("reason") ?? "")));
  }

  return (
    <form
      onSubmit={onSubmit}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      noValidate
      aria-label={`Change date: ${task.text}`}
      className="animate-rise mt-3 space-y-3 rounded-xl border border-slate-200 bg-white p-3"
    >
      <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
        <div>
          <label htmlFor={`${id}-date`} className="mb-1 block text-xs font-medium">New date</label>
          <input
            id={`${id}-date`} name="date" type="date" defaultValue={task.date} autoFocus
            aria-invalid={errors.date ? true : undefined} aria-describedby={errors.date ? `${id}-date-e` : undefined}
            className="control"
          />
          {errors.date && <p id={`${id}-date-e`} role="alert" className="animate-rise mt-1 text-xs text-red-700">{errors.date}</p>}
        </div>
        {!isCustom && (
          <div>
            <label htmlFor={`${id}-reason`} className="mb-1 block text-xs font-medium">Why are you moving it?</label>
            <input
              id={`${id}-reason`} name="reason" type="text" defaultValue={task.override?.reason ?? ""}
              placeholder="For example: waiting for the design"
              aria-invalid={errors.reason ? true : undefined} aria-describedby={errors.reason ? `${id}-reason-e` : undefined}
              className="control"
            />
            {errors.reason && <p id={`${id}-reason-e`} role="alert" className="animate-rise mt-1 text-xs text-red-700">{errors.reason}</p>}
          </div>
        )}
      </div>
      {!isCustom && (
        <p className="text-xs text-slate-500">
          Later steps on this page follow the new date. Go-live dates never move. Any date works, including one in the past.
          {task.recommended && <> The rules give {fmtDay(task.recommended)}.</>}
        </p>
      )}
      {error && <p role="alert" className="animate-rise text-xs text-red-700">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit" disabled={pending}
          className="press inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-70"
        >
          {pending && <span className="icon-[heroicons--arrow-path] size-4 animate-spin motion-reduce:animate-none" />}
          {pending ? "Saving…" : "Save"}
        </button>
        {task.override && (
          <button
            type="button" disabled={pending} onClick={() => run(() => resetMoveAction(task.key))}
            className="press rounded-lg px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-60"
          >
            Use recommended{task.recommended ? ` (${fmtDay(task.recommended)})` : ""}
          </button>
        )}
        <button
          type="button" onClick={onClose}
          className="press rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Cancel
        </button>
        {isCustom && (
          <button
            type="button" disabled={pending}
            onClick={confirmDelete ? () => run(() => deleteTaskAction(task.key.slice("custom:".length))) : () => setConfirmDelete(true)}
            onBlur={() => setConfirmDelete(false)}
            className={`press ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
              confirmDelete ? "bg-red-600 text-white hover:bg-red-700" : "text-red-700 hover:bg-red-50"
            }`}
          >
            <span className="icon-[heroicons--trash] size-4" />
            {confirmDelete ? "Confirm delete" : "Delete task"}
          </button>
        )}
      </div>
    </form>
  );
}
