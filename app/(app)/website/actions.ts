"use server";

import { refresh } from "next/cache";
import { authorizeAction } from "@/lib/action-auth";
import { loadTasks } from "@/lib/planner/state";
import { setDone } from "@/lib/planner/store";
import { checkKey, websiteStatus } from "@/lib/planner/website.ts";

/** Tick or untick one item of a website checklist. Any signed-in person can. */
export async function toggleChecklistAction(
  cohortId: string, changeId: string, index: number, done: boolean,
): Promise<{ error?: string }> {
  const { user } = await authorizeAction("tick-task");
  if (typeof cohortId !== "string" || typeof changeId !== "string" || typeof done !== "boolean" || !Number.isInteger(index)) {
    return { error: "Bad request." };
  }
  // Only real checklist items can be ticked, so nobody can fill the database with made-up keys.
  const { cohorts, today, holidays, overrides } = await loadTasks();
  const cohort = cohorts.find((c) => c.id === cohortId && c.status === "active");
  if (!cohort) return { error: "That cohort no longer exists." };
  const change = websiteStatus({ cohort, today, holidays, overrides }).changes.find((c) => c.id === changeId);
  if (!change || index < 0 || index >= change.checklist.length) return { error: "That checklist item no longer exists." };
  await setDone(checkKey(cohortId, change.id, index), done, user.email);
  refresh();
  return {};
}
