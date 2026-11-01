import { Suspense } from "react";
import { requireUser } from "@/lib/session";

// Layouts do not protect their pages. Every page that shows data must check
// the user itself, before it reads anything.
async function OverviewContent() {
  await requireUser();
  return <h1 className="text-2xl font-extrabold">Overview</h1>;
}

export default function Overview() {
  return (
    <Suspense>
      <OverviewContent />
    </Suspense>
  );
}
