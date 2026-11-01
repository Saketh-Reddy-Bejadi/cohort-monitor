import { parseDate } from "./task-input.ts";

export type Holiday = { date: string; name?: string };
export type HolidayFieldErrors = { date?: string; name?: string };
export type HolidayInput = { date: unknown; name?: unknown };

export type HolidayChange =
  | { ok: true; holidays: Holiday[] }
  | { ok: false; errors: HolidayFieldErrors; message?: string };

const MAX_NAME = 60;
export const MAX_HOLIDAYS = 400;
const bySort = (a: Holiday, b: Holiday) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

/** One holiday from form input: a real date, and an optional name of up to 60 characters. */
function parseHoliday(input: HolidayInput, keepDate?: string): { ok: true; holiday: Holiday } | { ok: false; errors: HolidayFieldErrors } {
  const errors: HolidayFieldErrors = {};
  // An unchanged date is kept as stored, even if it is outside the range new dates must be in.
  const d = keepDate !== undefined && input.date === keepDate ? { ok: true as const, date: keepDate } : parseDate(input.date);
  if (!d.ok) errors.date = d.error;

  let name: string | undefined;
  if (input.name !== undefined && input.name !== null) {
    if (typeof input.name !== "string") errors.name = "Enter text";
    else {
      const t = input.name.trim();
      if (t.length > MAX_NAME) errors.name = `Keep the name to ${MAX_NAME} characters`;
      else if (t) name = t;
    }
  }
  if (errors.date || errors.name || !d.ok) return { ok: false, errors };
  return { ok: true, holiday: name ? { date: d.date, name } : { date: d.date } };
}

const TAKEN = "That date is already a holiday";

/** Add a holiday. The list stays sorted, and the list you pass in is never changed. */
export function addHoliday(list: Holiday[], input: HolidayInput): HolidayChange {
  const p = parseHoliday(input);
  if (!p.ok) return p;
  if (list.some((h) => h.date === p.holiday.date)) return { ok: false, errors: { date: TAKEN } };
  if (list.length >= MAX_HOLIDAYS) {
    return { ok: false, errors: {}, message: `The list is full (${MAX_HOLIDAYS} holidays). Remove one first.` };
  }
  return { ok: true, holidays: [...list, p.holiday].sort(bySort) };
}

/** Change the date and/or name of the holiday that is on `oldDate`. */
export function updateHoliday(list: Holiday[], oldDate: string, input: HolidayInput): HolidayChange {
  const p = parseHoliday(input, oldDate);
  if (!p.ok) return p;
  if (!list.some((h) => h.date === oldDate)) {
    return { ok: false, errors: {}, message: "This holiday no longer exists. It may have been removed." };
  }
  if (p.holiday.date !== oldDate && list.some((h) => h.date === p.holiday.date)) {
    return { ok: false, errors: { date: TAKEN } };
  }
  return { ok: true, holidays: list.map((h) => (h.date === oldDate ? p.holiday : h)).sort(bySort) };
}

/** Take a holiday out. Removing one that is already gone changes nothing. */
export function removeHoliday(list: Holiday[], date: string): Holiday[] {
  return list.filter((h) => h.date !== date);
}
