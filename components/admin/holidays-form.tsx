"use client";

import { startTransition, useActionState, useState } from "react";
import { saveHolidaysAction, type HolidayState } from "@/app/(app)/admin/actions";

export function HolidaysForm({ initialText, loadedAt }: { initialText: string; loadedAt: string }) {
  const [state, formAction, pending] = useActionState<HolidayState, FormData>(saveHolidaysAction, {});
  const errors = state.errors ?? [];
  const [edited, setEdited] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEdited(false);
    const data = new FormData(e.currentTarget);
    // Not using the form action prop, so React does not wipe the text on an error.
    startTransition(() => formAction(data));
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-3">
      <input type="hidden" name="loadedAt" value={state.loadedAt ?? loadedAt} />
      <label htmlFor="holidays" className="block text-sm font-medium">Holidays</label>
      <textarea
        id="holidays" name="holidays" rows={12} defaultValue={state.text ?? initialText}
        aria-invalid={errors.length > 0 ? true : undefined} aria-describedby="holidays-help"
        spellCheck={false} onChange={() => setEdited(true)}
        className="control font-mono"
        placeholder={"2026-11-08 Diwali\n2026-12-25 Christmas Day"}
      />
      <p id="holidays-help" className="text-xs text-slate-500">
        One holiday per line: a date as YYYY-MM-DD, then an optional name. Tasks that fall on a
        holiday move back to the previous working day. Go-live tasks keep their date.
      </p>
      {errors.length > 0 && (
        <ul role="alert" className="animate-rise space-y-1 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {errors.map((e) => <li key={e.line}>Line {e.line}: {e.message}</li>)}
        </ul>
      )}
      {state.message && (
        <p role="alert" className="animate-rise rounded-xl bg-red-50 p-3 text-sm text-red-700">{state.message}</p>
      )}
      {state.saved && !edited && errors.length === 0 && (
        <p role="status" className="animate-rise flex items-center gap-2 text-sm text-emerald-700">
          <span className="icon-[heroicons--check-circle] size-5" />
          Saved. Task dates now use this list.
        </p>
      )}
      <button
        type="submit" disabled={pending}
        className="press inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-70"
      >
        {pending && <span className="icon-[heroicons--arrow-path] size-4 animate-spin motion-reduce:animate-none" />}
        {pending ? "Saving…" : "Save holidays"}
      </button>
    </form>
  );
}
