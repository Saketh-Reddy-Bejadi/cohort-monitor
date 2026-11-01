/** Today's date in India, as YYYY-MM-DD, whatever time zone the server runs in. */
export function todayIST(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** The hour in India, 0 to 23. For the greeting. */
export function hourIST(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  return Number(parts.find((p) => p.type === "hour")!.value);
}
