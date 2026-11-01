"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Select } from "@/components/ui/select";

/**
 * One dropdown to choose the cohort, so the page does not grow with the number of cohorts.
 * Each option shows the id and the name.
 */
export function CohortPicker({ options, selectedId }: { options: { id: string; name: string }[]; selectedId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className={`w-full transition-opacity sm:w-80 ${pending ? "opacity-60" : ""}`}>
      <label htmlFor="cohort-picker" className="mb-1 block text-xs font-medium text-slate-600">Cohort</label>
      <Select
        id="cohort-picker" value={selectedId} className="w-full"
        onChange={(e) => startTransition(() => router.push(`/website?cohort=${encodeURIComponent(e.target.value)}`))}
      >
        {options.map((o) => <option key={o.id} value={o.id}>{o.id} · {o.name}</option>)}
      </Select>
    </div>
  );
}
