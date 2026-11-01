"use client";

import { useState, useTransition } from "react";
import { changeRoleAction } from "@/app/(app)/admin/actions";

export function RoleSelect({ email, role }: { email: string; role: "admin" | "user" }) {
  const [value, setValue] = useState(role);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function onChange(next: "admin" | "user") {
    const previous = value;
    setValue(next); // respond at once
    setError(undefined);
    startTransition(async () => {
      const res = await changeRoleAction(email, next);
      if (res.error) {
        setValue(previous);
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <select
          value={value}
          aria-label={`Role for ${email}`}
          disabled={pending}
          onChange={(e) => onChange(e.target.value as "admin" | "user")}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-60"
        >
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
        {pending && <span className="icon-[heroicons--arrow-path] size-4 animate-spin text-slate-400 motion-reduce:animate-none" />}
      </div>
      {error && (
        <p role="alert" className="animate-rise text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
