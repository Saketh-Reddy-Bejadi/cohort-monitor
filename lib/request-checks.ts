import { timingSafeEqual } from "node:crypto";

/** True when `header` is `Bearer <expected>` (scheme is case-insensitive). An empty token never matches. */
export function tokenMatches(header: string | null, expected: string | undefined): boolean {
  const m = /^bearer (.+)$/i.exec(header ?? "");
  if (!expected || !m) return false;
  const a = Buffer.from(m[1]);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** A data-changing cookie request must carry an Origin that matches the host. */
export function sameOrigin(origin: string | null, host: string | null): boolean {
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
