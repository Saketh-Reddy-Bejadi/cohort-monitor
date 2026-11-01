"use client";

import Link from "next/link";
import { createContext, startTransition, useActionState, useContext } from "react";
import type { CohortErrors } from "@/lib/planner/types.ts";
import type { FormState } from "@/app/(app)/admin/actions";
import { KINDS, STATUSES, type Cohort } from "@/lib/planner/types.ts";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;
type Initial = Partial<Record<keyof Cohort, string | number | boolean>>;

const inputClass =
  "w-full rounded-lg border bg-white px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-600 aria-[invalid=true]:border-red-500 border-slate-300 disabled:bg-slate-50 disabled:text-slate-500";

type Ctx = { errors: CohortErrors; value: (name: keyof Cohort) => string };
const FormCtx = createContext<Ctx>({ errors: {}, value: () => "" });

function Field({
  name, label, type = "text", hint, inputMode,
}: {
  name: keyof Cohort; label: string; type?: string; hint?: string;
  inputMode?: "decimal" | "text" | "url";
}) {
  const { errors, value } = useContext(FormCtx);
  const err = errors[name];
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">{label}</label>
      <input
        id={name} name={name} type={type} inputMode={inputMode}
        defaultValue={value(name)} aria-invalid={err ? true : undefined}
        aria-describedby={err ? `${name}-error` : hint ? `${name}-hint` : undefined}
        className={inputClass}
      />
      {err ? (
        <p id={`${name}-error`} role="alert" className="animate-rise mt-1 text-xs text-red-700">{err}</p>
      ) : hint ? (
        <p id={`${name}-hint`} className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

function Select({ name, label, options }: { name: keyof Cohort; label: string; options: readonly string[] }) {
  const { errors, value } = useContext(FormCtx);
  const err = errors[name];
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">{label}</label>
      <select
        id={name} name={name} defaultValue={value(name)} aria-invalid={err ? true : undefined}
        aria-describedby={err ? `${name}-error` : undefined} className={inputClass}
      >
        {name === "kind" && <option value="">Pick a kind</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      {err && <p id={`${name}-error`} role="alert" className="animate-rise mt-1 text-xs text-red-700">{err}</p>}
    </div>
  );
}

export function CohortForm({
  action,
  initial,
  mode,
}: {
  action: Action;
  initial: Initial;
  mode: "create" | "edit";
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const errors = state.errors ?? {};

  // Show what the person typed after an error, otherwise the saved value.
  const value = (name: keyof Cohort) => String(state.values?.[name] ?? initial[name] ?? "");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    // Not using the form action prop, so React does not wipe the fields on an error.
    startTransition(() => formAction(data));
  }

  const section = (title: string, children: React.ReactNode, note?: string) => (
    <fieldset className="rounded-2xl border border-slate-200 p-5">
      <legend className="px-2 text-sm font-bold tracking-tight">{title}</legend>
      {note && <p className="mb-3 text-xs text-slate-500">{note}</p>}
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );

  const pages = [
    ["Homepage card", "home"], ["Waitlist LP", "waitlist"],
    ["Bootcamp detail page", "native"], ["Dark LP", "dark"],
  ] as const;

  return (
    <FormCtx.Provider value={{ errors, value }}>
    <form onSubmit={onSubmit} noValidate className="max-w-3xl space-y-5">
      {state.message && (
        <p role="alert" className="animate-rise flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <span className="icon-[heroicons--exclamation-triangle] mt-0.5 size-5 shrink-0" />
          {state.message}
        </p>
      )}
      {Object.keys(errors).length > 0 && (
        <p role="alert" className="animate-rise flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <span className="icon-[heroicons--exclamation-circle] mt-0.5 size-5 shrink-0" />
          Fix the {Object.keys(errors).length} highlighted field{Object.keys(errors).length > 1 ? "s" : ""} and save again.
        </p>
      )}

      {section("Basics", <>
        <Field name="name" label="Name" hint="For example AISE C4" />
        {mode === "create" ? (
          <Field name="id" label="Id" hint="Leave blank to make it from the name" />
        ) : (
          <div>
            <p className="mb-1 text-sm font-medium">Id</p>
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{String(initial.id)}</p>
          </div>
        )}
        <Field name="program" label="Program" />
        <Select name="kind" label="Kind" options={KINDS} />
        <Select name="status" label="Status" options={STATUSES} />
      </>)}

      {section("Dates", <>
        <Field name="launch" label="Enrolments open" type="date" />
        <Field name="start" label="Classes start" type="date" />
        <Field name="ic_close" label="Inner circle price ends" type="date" />
        <Field name="standard_from" label="Standard price starts" type="date" />
        <Field name="enrol_close" label="Enrolment closes" type="date" />
        <Field name="waitlist_live" label="Waitlist goes live" type="date" hint="Leave blank to use the default" />
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input
            type="checkbox" name="no_waitlist" defaultChecked={value("no_waitlist") === "true" || value("no_waitlist") === "on"}
            className="size-4 accent-brand-600"
          />
          No waitlist for this cohort
        </label>
        {errors.no_waitlist && <p role="alert" className="text-xs text-red-700">{errors.no_waitlist}</p>}
      </>, "All dates are India dates. Leave a date blank if it is not set yet.")}

      {section("Prices", <>
        <Field name="ic_price" label="Inner circle price, India (₹)" inputMode="decimal" />
        <Field name="standard_price" label="Standard price, India (₹)" inputMode="decimal" />
        <Field name="her_ic" label="HER inner circle (US$)" inputMode="decimal" />
        <Field name="her_std" label="HER standard (US$)" inputMode="decimal" />
        <Field name="ler_ic" label="LER inner circle (US$)" inputMode="decimal" />
        <Field name="ler_std" label="LER standard (US$)" inputMode="decimal" />
      </>)}

      {section("People", <>
        <Field name="poc" label="Product Owner" />
        <Field name="pm" label="Program Manager" />
      </>)}

      {section("Page links", pages.flatMap(([label, key]) => [
        <Field key={`${key}_beta`} name={`${key}_beta` as keyof Cohort} label={`${label}, beta`} type="url" inputMode="url" />,
        <Field key={`${key}_url`} name={`${key}_url` as keyof Cohort} label={`${label}, live`} type="url" inputMode="url" />,
      ]), "Full links, starting with https://")}

      <div className="flex items-center gap-3">
        <button
          type="submit" disabled={pending}
          className="press inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-70"
        >
          {pending && <span className="icon-[heroicons--arrow-path] size-4 animate-spin motion-reduce:animate-none" />}
          {pending ? "Saving…" : mode === "create" ? "Add cohort" : "Save changes"}
        </button>
        <Link href="/admin/cohorts" className="press rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Cancel
        </Link>
      </div>
    </form>
    </FormCtx.Provider>
  );
}
