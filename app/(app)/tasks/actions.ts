"use server";

import { refresh } from "next/cache";
import { authorizeAction } from "@/lib/action-auth";
import { loadTasks } from "@/lib/planner/state";
import { setDone } from "@/lib/planner/store";

/** Tick or untick a task. Any signed-in person can. */
export async function toggleTaskAction(key: string, done: boolean): Promise<{ error?: string }> {
  const { user } = await authorizeAction("tick-task");
  if (typeof key !== "string" || typeof done !== "boolean") return { error: "Bad request." };
  // Only real tasks can be ticked, so nobody can fill the database with made-up keys.
  const { tasks } = await loadTasks();
  if (!tasks.some((t) => t.key === key)) return { error: "That task no longer exists." };
  await setDone(key, done, user.email);
  refresh();
  return {};
}
