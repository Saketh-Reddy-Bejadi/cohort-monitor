// India dates as YYYY-MM-DD text. All maths is in UTC on whole days,
// so the server's time zone can never shift a date.

const DAY = 86_400_000;
const NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Milliseconds for a real calendar date. Throws on bad text, 13th months and 31 February. */
function toMs(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (m) {
    const t = new Date(0);
    t.setUTCFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3])); // not Date.UTC, which maps years 0-99 to 19xx
    if (t.toISOString().slice(0, 10) === iso) return t.getTime();
  }
  throw new RangeError(`Not a valid date (YYYY-MM-DD): ${JSON.stringify(iso)}`);
}

export function addDays(iso: string, days: number): string {
  return new Date(toMs(iso) + days * DAY).toISOString().slice(0, 10);
}

export function weekday(iso: string): (typeof NAMES)[number] {
  return NAMES[new Date(toMs(iso)).getUTCDay()];
}

export function isWeekend(iso: string): boolean {
  const d = new Date(toMs(iso)).getUTCDay();
  return d === 0 || d === 6;
}

export function isWorkday(iso: string, holidays: ReadonlySet<string>): boolean {
  return !isWeekend(iso) && !holidays.has(iso);
}

/** The same day if it is a working day, otherwise the closest working day before it. */
export function prevWorkday(iso: string, holidays: ReadonlySet<string>): string {
  let d = iso;
  while (!isWorkday(d, holidays)) d = addDays(d, -1);
  return d;
}

/** Whole days from `from` to `to`. Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toMs(to) - toMs(from)) / DAY);
}

/** Working days after `from` up to and including `to`. Zero when `to` is not later. */
export function workdaysBetween(from: string, to: string, holidays: ReadonlySet<string>): number {
  let n = 0;
  for (let d = addDays(from, 1); d <= to; d = addDays(d, 1)) if (isWorkday(d, holidays)) n++;
  return n;
}

/** The date `n` working days after `iso`. `n` of 0 gives `iso` itself. */
export function addWorkdays(iso: string, n: number, holidays: ReadonlySet<string>): string {
  let d = iso;
  for (let left = n; left > 0; ) {
    d = addDays(d, 1);
    if (isWorkday(d, holidays)) left--;
  }
  return d;
}
