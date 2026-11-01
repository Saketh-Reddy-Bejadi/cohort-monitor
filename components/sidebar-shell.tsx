"use client";

import { useSyncExternalStore } from "react";
import { Logo } from "./logo";

const KEY = "sidebar-collapsed";
const listeners = new Set<() => void>();
let memory = false; // used when browser storage is blocked

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb); // keep other tabs in step
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function read(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    if (v !== null) return v === "1";
  } catch {}
  return memory;
}

function write(value: boolean) {
  memory = value;
  try {
    localStorage.setItem(KEY, value ? "1" : "0");
  } catch {}
  listeners.forEach((l) => l());
}

/**
 * The sidebar frame. Children (the server-rendered nav and account) style
 * themselves from `data-collapsed` with `group-data-*` classes, so they need no props.
 * On a phone the sidebar is a top bar and never collapses.
 */
export function SidebarShell({ children }: { children: React.ReactNode }) {
  const collapsed = useSyncExternalStore(subscribe, read, () => false);
  return (
    <aside
      data-collapsed={collapsed}
      className="group/sb material z-10 flex md:sticky md:top-0 w-full flex-col gap-3 border-b border-slate-200/70 transition-[width] duration-250 ease-(--ease-settle) md:h-screen md:w-[232px] md:border-b-0 md:border-r md:data-[collapsed=true]:w-[72px]"
    >
      <div className="flex items-center justify-between gap-2 p-4 pb-0 md:group-data-[collapsed=true]/sb:flex-col md:group-data-[collapsed=true]/sb:px-0">
        <Logo size={36} />
        <button
          type="button"
          onClick={() => write(!collapsed)}
          aria-expanded={!collapsed}
          aria-controls="sidebar-nav"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="press hidden size-9 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600 md:flex"
        >
          <span
            className={`${collapsed ? "icon-[heroicons--chevron-double-right]" : "icon-[heroicons--chevron-double-left]"} size-5`}
          />
        </button>
      </div>
      {children}
    </aside>
  );
}
