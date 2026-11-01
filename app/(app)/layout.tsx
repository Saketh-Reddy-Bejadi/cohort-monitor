import { Suspense } from "react";
import { signOutAction } from "@/app/actions";
import { Logo } from "@/components/logo";
import { publicRole } from "@/lib/roles.ts";
import { requireUser } from "@/lib/session";

async function Account() {
  const user = await requireUser();
  return (
    <div className="animate-rise border-t border-slate-200/70 p-4 text-sm">
      <p className="truncate font-semibold" title={user.email}>
        {user.email}
      </p>
      <p className="mb-3 capitalize text-slate-500">{publicRole(user.role)}</p>
      <form action={signOutAction}>
        <button
          type="submit"
          className="press -ml-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-slate-600 hover:bg-brand-50 hover:text-brand-700"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="material sticky top-0 z-10 flex w-full flex-col border-b border-slate-200/70 md:h-screen md:w-[232px] md:border-b-0 md:border-r">
        <div className="p-4">
          <Logo size={36} />
        </div>
        <div className="hidden flex-1 md:block" />
        <Suspense fallback={<div className="h-24 border-t border-slate-200/70" />}>
          <Account />
        </Suspense>
      </aside>
      <main className="animate-rise flex-1 p-6">{children}</main>
    </div>
  );
}
