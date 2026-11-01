const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-25" to "25 Oct 2026". No time zone maths, so it never shifts a day. */
export function fmtDate(iso: string | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  const month = m ? MONTHS[Number(m[2]) - 1] : undefined;
  return m && month ? `${Number(m[3])} ${month} ${m[1]}` : "Not set";
}

export function fmtRupees(n: number | undefined): string {
  return n === undefined ? "Not set" : `₹${n.toLocaleString("en-IN")}`;
}

/** A moment in India time, for example "1 Nov 2026, 8:15 pm". */
export function fmtMoment(d: Date | undefined): string {
  if (!d) return "Never";
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-11-06" to "Fri 6 Nov". Short, for lists where the year is clear. */
export function fmtDay(iso: string | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return "Not set";
  const dow = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
  return `${DAYS[dow]} ${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}`;
}

/** "2026-11-08" to "Sun 8 Nov 2026". For lists that run over more than one year. */
export function fmtDayYear(iso: string | undefined): string {
  const m = /^(\d{4})-/.exec(iso ?? "");
  return m ? `${fmtDay(iso)} ${m[1]}` : "Not set";
}
