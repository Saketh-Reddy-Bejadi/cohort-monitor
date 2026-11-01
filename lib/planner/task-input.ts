import { isRealDate } from "./schema.ts";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MIN_DATE = "2020-01-01";
const MAX_DATE = "2100-12-31";

/** Trimmed text, undefined when blank, an Error when it is not text at all. */
function text(v: unknown): string | undefined | Error {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") return new Error("Enter text");
  const t = v.trim();
  return t === "" ? undefined : t;
}

/** A real date in a sensible range, so a typed year like 0026 is caught. */
function checkDate(v: unknown): { date: string } | { error: string } {
  const t = text(v);
  if (t instanceof Error || t === undefined) return { error: "Pick a date" };
  if (!isRealDate(t) || t < MIN_DATE || t > MAX_DATE) return { error: "Use a real date between 2020 and 2100" };
  return { date: t };
}

/** Just a date, for moving a one-off task. */
export function parseDate(v: unknown): { ok: true; date: string } | { ok: false; error: string } {
  const d = checkDate(v);
  return "error" in d ? { ok: false, error: d.error } : { ok: true, date: d.date };
}

export type MoveErrors = { date?: string; reason?: string };

/** A moved date needs the new date and a reason, so the team can see why it moved. */
export function parseMove(
  input: Record<string, unknown>,
): { ok: true; date: string; reason: string } | { ok: false; errors: MoveErrors } {
  const errors: MoveErrors = {};
  const d = checkDate(input.date);
  if ("error" in d) errors.date = d.error;

  const reason = text(input.reason);
  if (reason instanceof Error || reason === undefined) errors.reason = "Say why you are moving it";
  else if (reason.length > 200) errors.reason = "Use 200 characters or fewer";

  if (errors.date || errors.reason) return { ok: false, errors };
  return { ok: true, date: (d as { date: string }).date, reason: reason as string };
}

export type CustomErrors = { title?: string; date?: string; cohortId?: string; owner?: string };
export type CustomInput = { title: string; date: string; cohortId?: string; owner?: string };

/** A one-off task: a title and a date, with an optional cohort and owner. */
export function parseCustom(
  input: Record<string, unknown>,
): { ok: true; task: CustomInput } | { ok: false; errors: CustomErrors } {
  const errors: CustomErrors = {};

  const title = text(input.title);
  if (title instanceof Error || title === undefined) errors.title = "Enter a title";
  else if (title.length > 120) errors.title = "Use 120 characters or fewer";

  const d = checkDate(input.date);
  if ("error" in d) errors.date = d.error;

  const cohortId = text(input.cohortId);
  if (cohortId instanceof Error || (cohortId !== undefined && (!SLUG.test(cohortId) || cohortId.length > 60))) {
    errors.cohortId = "Pick a cohort from the list";
  }

  const owner = text(input.owner);
  if (owner instanceof Error) errors.owner = owner.message;
  else if (owner !== undefined && owner.length > 100) errors.owner = "Use 100 characters or fewer";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    task: {
      title: title as string,
      date: (d as { date: string }).date,
      cohortId: cohortId as string | undefined,
      owner: owner as string | undefined,
    },
  };
}
