"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/select";
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
      try {
        const res = await changeRoleAction(email, next);
        if (res.error) {
          setValue(previous);
          setError(res.error);
        }
      } catch {
        setValue(previous);
        setError("Could not change the role. Try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Select
          compact
          value={value}
          aria-label={`Role for ${email}`}
          disabled={pending}
          onChange={(e) => onChange(e.target.value as "admin" | "user")}
          className="w-28"
        >
          <option value="user">user</option>
          <option value="admin">admin</option>
        </Select>
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
