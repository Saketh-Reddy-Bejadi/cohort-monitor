"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { authorizeAction } from "@/lib/action-auth";
import { parseCohort } from "@/lib/planner/schema.ts";
import { createCohort, deleteCohort, replaceCohort, saveHolidays } from "@/lib/planner/store";
import { parseHolidays, type HolidayLineError } from "@/lib/planner/holidays.ts";
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

export type HolidayState = { text?: string; errors?: HolidayLineError[]; saved?: boolean; message?: string; loadedAt?: string };

export async function saveHolidaysAction(_prev: HolidayState, formData: FormData): Promise<HolidayState> {
  const { user } = await authorizeAction("write-holidays");
  const raw = formData.get("holidays");
  const text = typeof raw === "string" ? raw : "";
  const parsed = parseHolidays(text);
  if (!parsed.ok) return { text, errors: parsed.errors };
  const loadedAt = formData.get("loadedAt");
  const savedAt = await saveHolidays(parsed.holidays, user.email, typeof loadedAt === "string" ? loadedAt : "");
  if (!savedAt) {
    return { text, message: "Someone else saved the holidays after you opened this page. Reload to see their changes, then edit again." };
  }
  refresh();
  return { text, saved: true, loadedAt: savedAt };
}
