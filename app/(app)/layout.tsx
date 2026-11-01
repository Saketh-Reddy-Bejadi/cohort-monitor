import { Suspense } from "react";
import { signOutAction } from "@/app/actions";
import { Logo } from "@/components/logo";
import { NavLink } from "@/components/nav-link";
import { can } from "@/lib/roles.ts";
import { requireUser } from "@/lib/session";

async function Sidebar() {
  const user = await requireUser();
  const isAdmin = can({ kind: "user", role: user.role }, "write-cohort");
  return (
    <>
      <nav aria-label="Main" className="animate-rise flex gap-1 px-3 md:flex-col">
        <NavLink href="/" icon="icon-[heroicons--squares-2x2]">Overview</NavLink>
        {isAdmin && <NavLink href="/admin" icon="icon-[heroicons--shield-check]">Admin</NavLink>}
      </nav>
      <div className="hidden flex-1 md:block" />
      <div className="animate-rise border-t border-slate-200/70 p-4 text-sm">
        <p className="truncate font-semibold" title={user.email}>{user.email}</p>
        {/* You see your own role as it is. Only the owner is ever "owner". */}
        <p className="mb-3 capitalize text-slate-500">{user.role}</p>
        <form action={signOutAction}>
          <button
            type="submit"
            className="press -ml-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-slate-600 hover:bg-brand-50 hover:text-brand-700"
          >
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="material sticky top-0 z-10 flex w-full flex-col gap-3 border-b border-slate-200/70 md:h-screen md:w-[232px] md:border-b-0 md:border-r">
        <div className="p-4 pb-0">
          <Logo size={36} />
        </div>
        <Suspense fallback={<div className="h-24" />}>
          <Sidebar />
        </Suspense>
      </aside>
      <main className="animate-rise min-w-0 flex-1 p-6">{children}</main>
    </div>
  );
}
