"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="press flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-80"
    >
      {pending && (
        <span className="icon-[heroicons--arrow-path] size-5 animate-spin motion-reduce:animate-none" />
      )}
      {pending ? "Opening Microsoft…" : children}
    </button>
  );
}
