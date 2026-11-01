import { isRealDate } from "./schema.ts";

export type Holiday = { date: string; name?: string };
export type HolidayLineError = { line: number; message: string };

const MAX_LINES = 400;
const MAX_NAME = 60;

/**
 * Turn the text box into a holiday list. One holiday per line: a date, then an
 * optional name. Blank lines are ignored, a repeated date is kept once.
 */
export function parseHolidays(
  text: string,
): { ok: true; holidays: Holiday[] } | { ok: false; errors: HolidayLineError[] } {
  const errors: HolidayLineError[] = [];
  const byDate = new Map<string, Holiday>();
  let used = 0;

  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (++used > MAX_LINES) {
      if (used === MAX_LINES + 1) errors.push({ line, message: `Use ${MAX_LINES} lines or fewer` });
      return;
    }
    const m = /^(\S+)(?:\s+(.+))?$/.exec(trimmed)!;
    const [, date, name] = m;
    if (!isRealDate(date)) {
      errors.push({ line, message: "Start the line with a real date, YYYY-MM-DD" });
    } else if (name && name.trim().length > MAX_NAME) {
      errors.push({ line, message: `Keep the name to ${MAX_NAME} characters` });
    } else if (!byDate.has(date)) {
      byDate.set(date, name ? { date, name: name.trim() } : { date });
    }
  });

  if (errors.length > 0) return { ok: false, errors };
  const holidays = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  return { ok: true, holidays };
}

export function formatHolidays(list: Holiday[]): string {
  return list.map((h) => (h.name ? `${h.date} ${h.name}` : h.date)).join("\n");
}
