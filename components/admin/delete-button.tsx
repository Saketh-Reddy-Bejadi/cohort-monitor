"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

function Inner({ confirming, onArm }: { confirming: boolean; onArm: () => void }) {
  const { pending } = useFormStatus();
  return (
    <button
      type={confirming ? "submit" : "button"}
      onClick={confirming ? undefined : onArm}
      disabled={pending}
      className={`press inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
        confirming ? "bg-red-600 text-white hover:bg-red-700" : "text-red-700 hover:bg-red-50"
      } disabled:opacity-60`}
    >
      <span className={`${pending ? "icon-[heroicons--arrow-path] animate-spin motion-reduce:animate-none" : "icon-[heroicons--trash]"} size-4`} />
      {pending ? "Deleting…" : confirming ? "Confirm delete" : "Delete"}
    </button>
  );
}

/** Two steps: the first click asks, the second deletes. It cancels itself after 4 seconds. */
export function DeleteButton({ action, label }: { action: () => Promise<void>; label: string }) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(t);
  }, [confirming]);
  return (
    <form action={action} aria-label={`Delete ${label}`}>
      <Inner confirming={confirming} onArm={() => setConfirming(true)} />
    </form>
  );
}
