"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { authorizeAction } from "@/lib/action-auth";
import { parseCohort } from "@/lib/planner/schema.ts";
import { changeHolidays, createCohort, deleteCohort, replaceCohort } from "@/lib/planner/store";
import { addHoliday, removeHoliday, updateHoliday, type HolidayFieldErrors } from "@/lib/planner/holidays.ts";
import { changeUserRole } from "@/lib/users";
import type { CohortErrors } from "@/lib/planner/types.ts";

export type FormState = {
  errors?: CohortErrors;
  values?: Record<string, string>;
  message?: string;
};

function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

export async function createCohortAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await authorizeAction("write-cohort");
  const values = formValues(formData);
  const parsed = parseCohort(values);
  if (!parsed.ok) return { errors: parsed.errors, values };
  if (!(await createCohort(parsed.cohort, user.email))) {
    return { errors: { id: "A cohort with this id already exists" }, values };
  }
  redirect("/admin/cohorts");
}

export async function updateCohortAction(id: string, loadedAt: string | undefined, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await authorizeAction("write-cohort");
  // The id comes from the page address, never from the form, so it cannot be changed here.
  const values = { ...formValues(formData), id };
  const parsed = parseCohort(values);
  if (!parsed.ok) return { errors: parsed.errors, values };
  const saved = await replaceCohort(parsed.cohort, user.email, loadedAt);
  if (saved === "missing") return { message: "This cohort no longer exists. It may have been deleted.", values };
  if (saved === "stale") {
    return { message: "Someone else saved this cohort after you opened it. Reload the page to see their changes, then edit again.", values };
  }
  redirect("/admin/cohorts");
}

export async function deleteCohortAction(id: string): Promise<void> {
  await authorizeAction("delete-cohort");
  await deleteCohort(id);
  refresh();
}

const ROLE_MESSAGES = {
  self: "You cannot change your own role.",
  "bad-role": "Role must be admin or user.",
  "not-found": "That user was not found.",
} as const;

export async function changeRoleAction(email: string, role: string): Promise<{ error?: string }> {
  const { user, actor } = await authorizeAction("manage-users");
  const outcome = await changeUserRole(actor, user.email, email, role);
  if (outcome === "apply" || outcome === "noop") {
    refresh();
    return {};
  }
  // authorizeAction already checked this, so it only guards against the two drifting apart.
  if (outcome === "forbidden") redirect("/");
  return { error: ROLE_MESSAGES[outcome] };
}

export type HolidayResult = { errors?: HolidayFieldErrors; message?: string };

async function saveHolidayChange(
  by: string,
  op: Parameters<typeof changeHolidays>[1],
): Promise<HolidayResult> {
  const res = await changeHolidays(by, op);
  if (!res.ok) return { errors: res.errors, message: res.message };
  refresh();
  return {};
}

/** Add one holiday. Admins and the owner only. */
export async function addHolidayAction(date: string, name: string): Promise<HolidayResult> {
  const { user } = await authorizeAction("write-holidays");
  return saveHolidayChange(user.email, (list) => addHoliday(list, { date, name }));
}

/** Change the date or name of the holiday that is on `oldDate`. */
export async function updateHolidayAction(oldDate: string, date: string, name: string): Promise<HolidayResult> {
  const { user } = await authorizeAction("write-holidays");
  if (typeof oldDate !== "string") return { message: "Bad request." };
  return saveHolidayChange(user.email, (list) => updateHoliday(list, oldDate, { date, name }));
}

export async function removeHolidayAction(date: string): Promise<HolidayResult> {
  const { user } = await authorizeAction("write-holidays");
  if (typeof date !== "string") return { message: "Bad request." };
  return saveHolidayChange(user.email, (list) => ({ ok: true, holidays: removeHoliday(list, date) }));
}
