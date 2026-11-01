"use client";

import { startTransition, useOptimistic, useState } from "react";
import { toggleChecklistAction } from "@/app/(app)/website/actions";
import { Checkbox } from "@/components/ui/checkbox";
import { fmtMoment } from "@/lib/format";
import type { CheckTick } from "@/lib/planner/website-view.ts";
import type { ChangeId } from "@/lib/planner/website.ts";

function Item({ cohortId, changeId, index, tick }: { cohortId: string; changeId: ChangeId; index: number; tick: CheckTick }) {
  const [done, setDone] = useOptimistic(tick.done);
  const [error, setError] = useState<string>();

  function onChange(next: boolean) {
    setError(undefined);
    startTransition(async () => {
      setDone(next); // respond at once; it snaps back by itself if the save fails
      try {
        const res = await toggleChecklistAction(cohortId, changeId, index, next);
        if (res.error) setError(res.error);
      } catch {
        setError("Could not save. Try again.");
      }
    });
  }

  return (
    <li className="py-2">
      <label className="flex cursor-pointer items-start gap-3">
        <Checkbox checked={done} onChange={(e) => onChange(e.target.checked)} className="mt-0.5" />
        <span className="min-w-0 flex-1">
          <span className={`block text-sm ${done ? "text-slate-400 line-through" : ""}`}>{tick.text}</span>
          {done && tick.by && (
            <span className="block text-xs text-slate-400">
              Checked by {tick.by}{tick.at ? `, ${fmtMoment(new Date(tick.at))}` : ""}
            </span>
          )}
        </span>
      </label>
      {error && <p role="alert" className="animate-rise ml-8 mt-1 text-xs text-red-700">{error}</p>}
    </li>
  );
}

/** The things to check on the website for one change. Ticks are shared with the whole team. */
export function Checklist({ cohortId, changeId, ticks }: { cohortId: string; changeId: ChangeId; ticks: CheckTick[] }) {
  const doneCount = ticks.filter((t) => t.done).length;
  return (
    <div>
      <div className="mb-2 flex items-center gap-3">
        <div
          role="progressbar" aria-label="Checklist progress" aria-valuemin={0} aria-valuemax={ticks.length} aria-valuenow={doneCount}
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"
        >
          <div
            className="h-full rounded-full bg-brand-600 transition-[width] duration-300"
            style={{ width: `${ticks.length ? (doneCount / ticks.length) * 100 : 0}%` }}
          />
        </div>
        <span className="text-xs font-medium text-slate-500">{doneCount} of {ticks.length} checked</span>
      </div>
      <ul className="divide-y divide-slate-100">
        {ticks.map((t, i) => <Item key={`${changeId}-${i}`} cohortId={cohortId} changeId={changeId} index={i} tick={t} />)}
      </ul>
    </div>
  );
}
