import type { Metadata } from "next";
import { Suspense } from "react";
import { HolidaysManager } from "@/components/admin/holidays-manager";
import { getHolidays } from "@/lib/planner/store";
import { todayIST } from "@/lib/planner/today.ts";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Holidays" };

async function Holidays() {
  await requireAdmin(); // first: this makes the page dynamic, so the clock below is allowed
  return <HolidaysManager holidays={await getHolidays()} today={todayIST()} />;
}

export default function HolidaysAdminPage() {
  return (
    <section>
      <h2 className="text-lg font-bold">Holidays</h2>
      <p className="mb-4 mt-1 text-sm text-slate-600">
        Weekends already count as days off. Pick the other days here. Tasks that fall on a holiday move
        back to the previous working day. Go-live tasks keep their date.
      </p>
      <Suspense fallback={<div className="h-64 max-w-2xl animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />}>
        <Holidays />
      </Suspense>
    </section>
  );
}
