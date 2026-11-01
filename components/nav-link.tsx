"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Inside the sidebar (a `group/sb` with `data-collapsed`), the label hides and
 * only the icon stays when the sidebar is collapsed. Elsewhere it is a normal link.
 */
export function NavLink({ href, icon, children }: { href: string; icon: string; children: string }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      title={children}
      aria-current={active ? "page" : undefined}
      className={`press flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors md:group-data-[collapsed=true]/sb:justify-center md:group-data-[collapsed=true]/sb:gap-0 ${
        active ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      <span className={`${icon} size-5 shrink-0`} />
      <span className="overflow-hidden whitespace-nowrap transition-[opacity,width] duration-200 ease-(--ease-settle) md:group-data-[collapsed=true]/sb:w-0 md:group-data-[collapsed=true]/sb:opacity-0">
        {children}
      </span>
    </Link>
  );
}
