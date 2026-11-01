import type { Metadata } from "next";
import { Suspense } from "react";
import { HolidaysForm } from "@/components/admin/holidays-form";
import { formatHolidays } from "@/lib/planner/holidays.ts";
import { getHolidaysDoc } from "@/lib/planner/store";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Holidays" };

async function Holidays() {
  await requireAdmin();
  const { holidays, updated_at } = await getHolidaysDoc();
  return <HolidaysForm initialText={formatHolidays(holidays)} loadedAt={updated_at} />;
}

export default function HolidaysAdminPage() {
  return (
    <section>
      <h2 className="text-lg font-bold">Holidays</h2>
      <p className="mb-4 mt-1 text-sm text-slate-600">
        Weekends already count as days off. List the other days here.
      </p>
      <Suspense fallback={<div className="h-64 max-w-xl animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />}>
        <Holidays />
      </Suspense>
    </section>
  );
}
