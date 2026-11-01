"use server";

import { refresh } from "next/cache";
import { authorizeAction } from "@/lib/action-auth";
import { canDeleteCustom } from "@/lib/roles.ts";
import { loadTasks } from "@/lib/planner/state";
import {
  clearOverride, createCustom, deleteCustom, getCohort, getCustom, setDone, setOverride, updateCustomDate,
} from "@/lib/planner/store";
import { parseCustom, parseDate, parseMove, type CustomErrors, type MoveErrors } from "@/lib/planner/task-input.ts";

const GONE = "That task no longer exists.";

/** Tick or untick a task. Any signed-in person can. */
export async function toggleTaskAction(key: string, done: boolean): Promise<{ error?: string }> {
  const { user } = await authorizeAction("tick-task");
  if (typeof key !== "string" || typeof done !== "boolean") return { error: "Bad request." };
  // Only real tasks can be ticked, so nobody can fill the database with made-up keys.
  const { tasks } = await loadTasks();
  if (!tasks.some((t) => t.key === key)) return { error: GONE };
  await setDone(key, done, user.email);
  refresh();
  return {};
}

export type MoveResult = { error?: string; errors?: MoveErrors };

/**
 * Move one task to a new date. A rule task needs a reason and the later steps on
 * its page follow. A one-off task just takes the new date.
 */
export async function moveTaskAction(key: string, date: string, reason: string): Promise<MoveResult> {
  const { user } = await authorizeAction("change-task");
  if (typeof key !== "string") return { error: "Bad request." };
  const { tasks } = await loadTasks();
  const task = tasks.find((t) => t.key === key);
  if (!task) return { error: GONE };
  if (task.done?.done === true) return { error: "This task is done. Untick it to change its date." };

  if (key.startsWith("custom:")) {
    const d = parseDate(date);
    if (!d.ok) return { errors: { date: d.error } };
    if (!(await updateCustomDate(key.slice("custom:".length), d.date))) return { error: GONE };
    refresh();
    return {};
  }

  const parsed = parseMove({ date, reason });
  if (!parsed.ok) return { errors: parsed.errors };
  if (task.override && parsed.date === task.recommended) {
    // Moved back to the date the rules give, so the move is not needed any more.
    await clearOverride(key);
  } else if (!task.override && parsed.date === task.date) {
    return { errors: { date: "That is already the date. Pick a different one." } };
  } else {
    await setOverride(key, parsed.date, parsed.reason, user.email);
  }
  refresh();
  return {};
}

/** Go back to the date the rules give. */
export async function resetMoveAction(key: string): Promise<{ error?: string }> {
  await authorizeAction("change-task");
  if (typeof key !== "string") return { error: "Bad request." };
  // No task lookup, unlike the other actions: this only deletes by key, so a made-up key does nothing.
  await clearOverride(key);
  refresh();
  return {};
}

export type AddTaskState = { errors?: CustomErrors; values?: Record<string, string>; saved?: boolean };

/** Add a one-off task. Any signed-in person can. */
export async function addTaskAction(_prev: AddTaskState, formData: FormData): Promise<AddTaskState> {
  const { user } = await authorizeAction("change-task");
  const values: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") values[k] = v;

  const parsed = parseCustom(values);
  if (!parsed.ok) return { errors: parsed.errors, values };
  if (parsed.task.cohortId) {
    const cohort = await getCohort(parsed.task.cohortId);
    if (!cohort) return { errors: { cohortId: "That cohort no longer exists" }, values };
    if (cohort.status === "archived") return { errors: { cohortId: "That cohort is archived" }, values };
  }
  await createCustom(parsed.task, user.email);
  refresh();
  return { saved: true };
}

/** Delete a one-off task. Rule tasks cannot be deleted: change the cohort's dates instead. */
export async function deleteTaskAction(id: string): Promise<{ error?: string }> {
  const { user, actor } = await authorizeAction("change-task");
  if (typeof id !== "string") return { error: "Bad request." };
  const task = await getCustom(id);
  if (!task) return { error: GONE };
  // The person who added it, or an admin.
  if (!canDeleteCustom(actor, user.email, task.by)) {
    return { error: "Only the person who added this task, or an admin, can delete it." };
  }
  await deleteCustom(id);
  refresh();
  return {};
}
