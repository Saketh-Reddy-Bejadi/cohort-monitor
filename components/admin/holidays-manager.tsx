"use client";

import { useEffect, useId, useState, useTransition } from "react";
import {
  addHolidayAction, removeHolidayAction, updateHolidayAction, type HolidayResult,
} from "@/app/(app)/admin/actions";
import { fmtDayYear } from "@/lib/format";
import { isWeekend } from "@/lib/planner/dates.ts";
import type { Holiday, HolidayFieldErrors } from "@/lib/planner/holidays.ts";

const SAVED = "Saved. Task dates now use this list.";

/** Run one save. Reports field errors or a message, or calls onOk when it worked. */
function useSave(onOk: () => void) {
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<HolidayFieldErrors>({});
  const [message, setMessage] = useState<string>();

  function run(save: () => Promise<HolidayResult>) {
    setErrors({});
    setMessage(undefined);
    start(async () => {
      try {
        const res = await save();
        if (res.errors && Object.keys(res.errors).length > 0) setErrors(res.errors);
        else if (res.message) setMessage(res.message);
        else onOk();
      } catch {
        setMessage("Could not save. Try again.");
      }
    });
  }
  return { pending, errors, message, run, clear: () => { setErrors({}); setMessage(undefined); } };
}

function Fields({
  idBase, date, name, onDate, onName, errors, autoFocus,
}: {
  idBase: string; date: string; name: string;
  onDate: (v: string) => void; onName: (v: string) => void;
  errors: HolidayFieldErrors; autoFocus?: boolean;
}) {
  return (
    <>
      <div>
        <label htmlFor={`${idBase}-date`} className="mb-1 block text-xs font-medium">Date</label>
        <input
          id={`${idBase}-date`} type="date" value={date} onChange={(e) => onDate(e.target.value)} autoFocus={autoFocus}
          aria-invalid={errors.date ? true : undefined} aria-describedby={errors.date ? `${idBase}-date-e` : undefined}
          className="control"
        />
        {errors.date && <p id={`${idBase}-date-e`} role="alert" className="animate-rise mt-1 text-xs text-red-700">{errors.date}</p>}
      </div>
      <div>
        <label htmlFor={`${idBase}-name`} className="mb-1 block text-xs font-medium">
          Name <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <input
          id={`${idBase}-name`} type="text" value={name} onChange={(e) => onName(e.target.value)}
          placeholder="For example: Diwali" maxLength={80}
          aria-invalid={errors.name ? true : undefined} aria-describedby={errors.name ? `${idBase}-name-e` : undefined}
          className="control"
        />
        {errors.name && <p id={`${idBase}-name-e`} role="alert" className="animate-rise mt-1 text-xs text-red-700">{errors.name}</p>}
      </div>
    </>
  );
}

function Spinner() {
  return <span className="icon-[heroicons--arrow-path] size-4 animate-spin motion-reduce:animate-none" />;
}

function HolidayRow({ holiday, past, onSaved }: { holiday: Holiday; past: boolean; onSaved: () => void }) {
  const idBase = useId();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(holiday.date);
  const [name, setName] = useState(holiday.name ?? "");
  const [confirming, setConfirming] = useState(false);
  const save = useSave(() => { setEditing(false); onSaved(); });
  const remove = useSave(onSaved);
  const busy = save.pending || remove.pending;

  function startEdit() {
    setDate(holiday.date);
    setName(holiday.name ?? "");
    save.clear();
    setEditing(true);
  }

  if (editing) {
    return (
      <li className="animate-rise border-b border-slate-100 py-3 last:border-0">
        <form
          noValidate
          onSubmit={(e) => { e.preventDefault(); save.run(() => updateHolidayAction(holiday.date, date, name)); }}
          onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
          aria-label={`Edit holiday on ${fmtDayYear(holiday.date)}`}
          className="space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
            <Fields idBase={idBase} date={date} name={name} onDate={setDate} onName={setName} errors={save.errors} autoFocus />
          </div>
          {save.message && <p role="alert" className="animate-rise text-xs text-red-700">{save.message}</p>}
          <div className="flex gap-2">
            <button
              type="submit" disabled={busy}
              className="press inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-70"
            >
              {save.pending && <Spinner />}
              {save.pending ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="press rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-100 py-2.5 last:border-0">
      <div className={`min-w-0 flex-1 ${past ? "text-slate-500" : ""}`}>
        <p className="text-sm font-medium">{fmtDayYear(holiday.date)}</p>
        <p className="text-xs text-slate-500">
          {holiday.name ?? "No name"}
          {isWeekend(holiday.date) && (
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-slate-600" title="A weekend is already a day off, so this changes nothing">
              Weekend
            </span>
          )}
        </p>
        {remove.message && <p role="alert" className="animate-rise mt-1 text-xs text-red-700">{remove.message}</p>}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button" onClick={startEdit} disabled={busy} aria-label={`Edit ${fmtDayYear(holiday.date)}`}
          className="press inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-60"
        >
          <span className="icon-[heroicons--pencil-square] size-4" />
          Edit
        </button>
        <button
          type="button" disabled={busy}
          aria-label={`${confirming ? "Confirm remove" : "Remove"} ${fmtDayYear(holiday.date)}`}
          onClick={confirming ? () => { setConfirming(false); remove.run(() => removeHolidayAction(holiday.date)); } : () => setConfirming(true)}
          onBlur={() => setConfirming(false)}
          className={`press inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
            confirming ? "bg-red-600 text-white hover:bg-red-700" : "text-red-700 hover:bg-red-50"
          }`}
        >
          {remove.pending ? <Spinner /> : <span className="icon-[heroicons--trash] size-4" />}
          {remove.pending ? "Removing…" : confirming ? "Confirm remove" : "Remove"}
        </button>
      </div>
    </li>
  );
}

export function HolidaysManager({ holidays, today }: { holidays: Holiday[]; today: string }) {
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [notice, setNotice] = useState(0); // a new number each save, so the message shows again
  const add = useSave(() => { setDate(""); setName(""); setNotice((n) => n + 1); });

  // The "Saved" message goes away by itself.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(0), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const upcoming = holidays.filter((h) => h.date >= today);
  const past = holidays.filter((h) => h.date < today).reverse(); // most recent first

  return (
    <div className="max-w-2xl space-y-6">
      <form
        noValidate
        onSubmit={(e) => { e.preventDefault(); add.run(() => addHolidayAction(date, name)); }}
        aria-label="Add a holiday"
        className="rounded-2xl border border-slate-200 p-4"
      >
        <h3 className="mb-3 text-sm font-bold">Add a holiday</h3>
        <div className="grid gap-3 sm:grid-cols-[11rem_1fr_auto] sm:items-start">
          <Fields idBase="add-holiday" date={date} name={name} onDate={setDate} onName={setName} errors={add.errors} />
          <button
            type="submit" disabled={add.pending}
            className="press inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-70 sm:mt-[1.375rem]"
          >
            {add.pending ? <Spinner /> : <span className="icon-[heroicons--plus] size-4" />}
            {add.pending ? "Adding…" : "Add holiday"}
          </button>
        </div>
        {add.message && <p role="alert" className="animate-rise mt-3 text-sm text-red-700">{add.message}</p>}
      </form>

      <div aria-live="polite" className="min-h-5">
        {notice > 0 && (
          <p key={notice} className="animate-rise flex items-center gap-2 text-sm text-emerald-700">
            <span className="icon-[heroicons--check-circle] size-5" />
            {SAVED}
          </p>
        )}
      </div>

      <section aria-label="Upcoming holidays">
        <h3 className="mb-1 flex items-baseline gap-2 text-sm font-bold">
          Upcoming <span className="text-xs font-medium text-slate-400">{upcoming.length}</span>
        </h3>
        {upcoming.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
            <p className="font-semibold">No upcoming holidays</p>
            <p className="mt-1 text-sm text-slate-600">Weekends already count as days off. Add the other days above.</p>
          </div>
        ) : (
          <ul className="rounded-2xl border border-slate-200 px-4">
            {upcoming.map((h) => <HolidayRow key={h.date} holiday={h} past={false} onSaved={() => setNotice((n) => n + 1)} />)}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold">
            <span className="icon-[heroicons--chevron-down] size-4 text-slate-500 transition-transform group-open:rotate-180" />
            Past holidays <span className="text-xs font-medium text-slate-400">{past.length}</span>
          </summary>
          <ul className="mt-1 rounded-2xl border border-slate-200 px-4">
            {past.map((h) => <HolidayRow key={h.date} holiday={h} past onSaved={() => setNotice((n) => n + 1)} />)}
          </ul>
        </details>
      )}
    </div>
  );
}
