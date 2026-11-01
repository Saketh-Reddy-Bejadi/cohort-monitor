import type { SelectHTMLAttributes } from "react";

/**
 * A dropdown with our own closed look: one height with the other fields, and a
 * chevron with room around it. The list that opens is the browser's own, so it
 * stays accessible and works well on phones.
 */
export function Select({
  className = "",
  compact = false,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { compact?: boolean }) {
  return (
    <span className={`select-wrap relative inline-block ${className}`}>
      <select {...props} className={`control select-control ${compact ? "!min-h-9 !py-1.5" : ""}`}>
        {children}
      </select>
      <span
        aria-hidden
        className="icon-[heroicons--chevron-down] pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
      />
    </span>
  );
}
