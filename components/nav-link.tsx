"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, icon, children }: { href: string; icon: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`press flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
        active ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      <span className={`${icon} size-5 shrink-0`} />
      {children}
    </Link>
  );
}
