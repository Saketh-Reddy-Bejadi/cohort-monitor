import { Suspense } from "react";
import { NavLink } from "@/components/nav-link";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div>
      <h1 className="text-2xl font-extrabold">Admin</h1>
      <Suspense fallback={<div className="mb-6 mt-4 h-10" />}>
        <nav aria-label="Admin sections" className="mb-6 mt-4 flex flex-wrap gap-2">
          <NavLink href="/admin/cohorts" icon="icon-[heroicons--academic-cap]">Cohorts</NavLink>
          <NavLink href="/admin/users" icon="icon-[heroicons--user-group]">Users</NavLink>
          <NavLink href="/admin/holidays" icon="icon-[heroicons--calendar-days]">Holidays</NavLink>
        </nav>
      </Suspense>
      {children}
    </div>
  );
}
