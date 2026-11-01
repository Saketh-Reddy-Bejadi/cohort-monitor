"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { addTaskAction, type AddTaskState } from "@/app/(app)/tasks/actions";
import { Select } from "@/components/ui/select";

function AddTaskForm({
  cohorts, owners, today, onSaved, onCancel,
}: {
  cohorts: { id: string; name: string }[];
  owners: string[];
  today: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState<AddTaskState, FormData>(addTaskAction, {});
  const errors = state.errors ?? {};
  const value = (name: string, fallback = "") => state.values?.[name] ?? fallback;

  useEffect(() => {
    // onSaved gets a new identity on every parent render, so this runs often; it is safe only
    // because onSaved (close) does nothing once the panel is already closing.
    if (state.saved) onSaved();
  }, [state.saved, onSaved]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    // Not using the form action prop, so React does not wipe the fields on an error.
    startTransition(() => formAction(data));
  }

  const err = (name: keyof typeof errors) =>
    errors[name] && (
      <p id={`task-${name}-error`} role="alert" className="animate-rise mt-1 text-xs text-red-700">{errors[name]}</p>
    );
  const aria = (name: keyof typeof errors) => ({
    "aria-invalid": errors[name] ? (true as const) : undefined,
    "aria-describedby": errors[name] ? `task-${name}-error` : undefined,
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-5">
      <div>
        <label htmlFor="task-title" className="mb-1 block text-sm font-medium">What needs doing?</label>
        <input
          id="task-title" name="title" type="text" autoFocus defaultValue={value("title")}
          placeholder="For example: Send the brochure to the team" className="control" {...aria("title")}
        />
        {err("title")}
      </div>
      <div>
        <label htmlFor="task-date" className="mb-1 block text-sm font-medium">Due date</label>
        <input id="task-date" name="date" type="date" defaultValue={value("date", today)} className="control" {...aria("date")} />
        {err("date")}
      </div>
      <div>
        <label htmlFor="task-cohort" className="mb-1 block text-sm font-medium">Cohort <span className="font-normal text-slate-500">(optional)</span></label>
        <Select id="task-cohort" name="cohortId" defaultValue={value("cohortId")} className="w-full" {...aria("cohortId")}>
          <option value="">No cohort</option>
          {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        {err("cohortId")}
      </div>
      <div>
        <label htmlFor="task-owner" className="mb-1 block text-sm font-medium">Owner <span className="font-normal text-slate-500">(optional)</span></label>
        <input
          id="task-owner" name="owner" type="text" list="task-owners" defaultValue={value("owner")}
          placeholder="Pick a name or type one" className="control" {...aria("owner")}
        />
        <datalist id="task-owners">{owners.map((o) => <option key={o} value={o} />)}</datalist>
        {err("owner")}
      </div>
      <div className="mt-auto flex items-center gap-3 pt-2">
        <button
          type="submit" disabled={pending}
          className="press inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-70"
        >
          {pending && <span className="icon-[heroicons--arrow-path] size-4 animate-spin motion-reduce:animate-none" />}
          {pending ? "Adding…" : "Add task"}
        </button>
        <button type="button" onClick={onCancel} className="press rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
      </div>
    </form>
  );
}

/** The "Add task" button and its side panel. The panel leaves the way it came in. */
export function AddTaskPanel({
  cohorts, owners, today,
}: {
  cohorts: { id: string; name: string }[];
  owners: string[];
  today: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // A new number each time the panel opens, so the form starts empty.
  const [session, setSession] = useState(0);

  function open() {
    const d = ref.current;
    if (!d || d.open) return;
    d.removeAttribute("data-closing");
    setSession((n) => n + 1);
    d.showModal();
  }

  function close() {
    const d = ref.current;
    if (!d?.open || d.hasAttribute("data-closing")) return;
    d.setAttribute("data-closing", "");
    setTimeout(() => {
      d.close();
      d.removeAttribute("data-closing");
    }, 200);
  }

  return (
    <>
      <button
        type="button" onClick={open}
        className="press inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        <span className="icon-[heroicons--plus] size-4" />
        Add task
      </button>
      <dialog
        ref={ref} className="panel" aria-labelledby="add-task-title"
        onCancel={(e) => { e.preventDefault(); close(); }} // Esc leaves with the same motion as the button
        onClick={(e) => { if (e.target === ref.current) close(); }} // a click on the dimmed area closes it
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 id="add-task-title" className="text-lg font-bold">Add a task</h2>
            <button type="button" onClick={close} aria-label="Close" className="press flex size-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100">
              <span className="icon-[heroicons--x-mark] size-5" />
            </button>
          </div>
          <AddTaskForm key={session} cohorts={cohorts} owners={owners} today={today} onSaved={close} onCancel={close} />
        </div>
      </dialog>
    </>
  );
}
