"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Select } from "@/components/ui/select";
import { DUE_LABELS, type Filters, type StatusFilter } from "@/lib/planner/tasks-view.ts";

type Counts = Record<StatusFilter, number>;
const SEGMENTS: { id: StatusFilter; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "overdue", label: "Overdue" },
  { id: "done", label: "Done" },
  { id: "all", label: "All" },
];

export function TaskFilters({
  cohorts, owners, counts, current,
}: {
  cohorts: { id: string; name: string }[];
  owners: string[];
  counts: Counts;
  current: Required<Pick<Filters, "status">> & Omit<Filters, "status">;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(current.q ?? "");
  // Follow the address bar when it changes from outside, such as the back button.
  const [seenQ, setSeenQ] = useState(current.q ?? "");
  if ((current.q ?? "") !== seenQ) {
    setSeenQ(current.q ?? "");
    setQ(current.q ?? "");
  }

  /** The address bar holds the filters, so a view can be shared or bookmarked. */
  function go(next: Partial<Filters>) {
    const f = { ...current, ...next };
    const p = new URLSearchParams();
    if (f.status !== "open") p.set("status", f.status);
    if (f.cohort) p.set("cohort", f.cohort);
    if (f.owner) p.set("owner", f.owner);
    if (f.q) p.set("q", f.q);
    if (f.due) p.set("due", f.due);
    const qs = p.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname));
  }

  const filtered = current.cohort || current.owner || current.q || current.due;
  return (
    <div className={`mb-5 space-y-3 transition-opacity ${pending ? "opacity-60" : ""}`}>
      <div role="group" aria-label="Status" className="flex flex-wrap gap-2">
        {SEGMENTS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={current.status === s.id}
            onClick={() => go({ status: s.id })}
            className={`press rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              current.status === s.id ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {s.label} <span className="opacity-70">{counts[s.id]}</span>
          </button>
        ))}
        {current.due && (
          <button
            type="button" onClick={() => go({ due: undefined })}
            aria-label={`${DUE_LABELS[current.due]}. Remove this filter`}
            className="press inline-flex items-center gap-1.5 rounded-full border border-brand-600 bg-brand-50 px-3.5 py-1.5 text-sm font-medium text-brand-700"
          >
            {DUE_LABELS[current.due]}
            <span className="icon-[heroicons--x-mark] size-4" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <form
          role="search"
          onSubmit={(e) => { e.preventDefault(); go({ q: q.trim() || undefined }); }}
          className="col-span-2 sm:min-w-[12rem] sm:flex-1"
        >
          <input
            type="search" value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => q.trim() !== (current.q ?? "") && go({ q: q.trim() || undefined })}
            placeholder="Search tasks" aria-label="Search tasks" className="control"
          />
        </form>
        <Select
          aria-label="Cohort" value={current.cohort ?? ""} className="sm:w-48"
          onChange={(e) => go({ cohort: e.target.value || undefined })}
        >
          <option value="">All cohorts</option>
          {current.cohort && !cohorts.some((c) => c.id === current.cohort) && <option value={current.cohort}>{current.cohort}</option>}
          {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select
          aria-label="Owner" value={current.owner ?? ""} className="sm:w-44"
          onChange={(e) => go({ owner: e.target.value || undefined })}
        >
          <option value="">Everyone</option>
          {current.owner && !owners.includes(current.owner) && <option value={current.owner}>{current.owner}</option>}
          {owners.map((o) => <option key={o} value={o}>{o}</option>)}
        </Select>
        {filtered && (
          <button
            type="button" onClick={() => { setQ(""); go({ cohort: undefined, owner: undefined, q: undefined, due: undefined }); }}
            className="press col-span-2 rounded-lg px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 sm:col-span-1"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
