import { Suspense } from "react";
import { signOutAction } from "@/app/actions";
import { NavLink } from "@/components/nav-link";
import { SidebarShell } from "@/components/sidebar-shell";
import { can } from "@/lib/roles.ts";
import { requireUser } from "@/lib/session";

// Text that disappears when the sidebar is collapsed (desktop only).
const hideCollapsed = "md:group-data-[collapsed=true]/sb:hidden";

async function Sidebar() {
  const user = await requireUser();
  const isAdmin = can({ kind: "user", role: user.role }, "admin-panel");
  return (
    <>
      <nav id="sidebar-nav" aria-label="Main" className="animate-rise flex gap-1 px-3 md:flex-col">
        <NavLink href="/" icon="icon-[heroicons--squares-2x2]">Overview</NavLink>
        <NavLink href="/tasks" icon="icon-[heroicons--clipboard-document-check]">Tasks</NavLink>
        {isAdmin && <NavLink href="/admin" icon="icon-[heroicons--shield-check]">Admin</NavLink>}
      </nav>
      <div className="hidden flex-1 md:block" />
      <div className="animate-rise flex items-center justify-between gap-3 border-t border-slate-200/70 px-4 py-1 text-sm md:block md:py-4 md:group-data-[collapsed=true]/sb:flex md:group-data-[collapsed=true]/sb:flex-col md:group-data-[collapsed=true]/sb:items-center md:group-data-[collapsed=true]/sb:px-0">
        <div className={`${hideCollapsed} min-w-0`}>
          <p className="truncate font-semibold" title={user.email}>{user.email}</p>
          {/* You see your own role as it is. Only the owner is ever "owner". */}
          <p className="capitalize text-slate-500 md:mb-3">{user.role}</p>
        </div>
        {/* Collapsed: a small circle with your initial stands in for the email. */}
        <span
          title={`${user.email} (${user.role})`}
          className="mb-2 hidden size-9 items-center justify-center rounded-full bg-brand-50 text-sm font-bold uppercase text-brand-700 md:group-data-[collapsed=true]/sb:flex"
        >
          {user.email[0]}
        </span>
        <form action={signOutAction}>
          <button
            type="submit"
            title="Sign out"
            aria-label="Sign out"
            className="press flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 text-slate-600 hover:bg-brand-50 hover:text-brand-700 md:group-data-[collapsed=true]/sb:px-1.5"
          >
            <span className="icon-[heroicons--arrow-left-start-on-rectangle] size-5 shrink-0" />
            <span className={`hidden md:inline ${hideCollapsed}`}>Sign out</span>
          </button>
        </form>
      </div>
    </>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <SidebarShell>
        <Suspense fallback={<div className="h-24" />}>
          <Sidebar />
        </Suspense>
      </SidebarShell>
      <main className="animate-rise min-w-0 flex-1 p-6">{children}</main>
    </div>
  );
}
