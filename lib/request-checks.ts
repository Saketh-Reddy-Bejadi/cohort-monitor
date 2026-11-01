import { createHash, timingSafeEqual } from "node:crypto";

/** Shorter API tokens are refused, so a placeholder from .env.example cannot work. */
export const MIN_TOKEN_LENGTH = 32;

const sha256 = (v: string) => createHash("sha256").update(v).digest();

/**
 * True when `header` is `Bearer <expected>` (scheme is case-insensitive). An empty
 * or too short token never matches. Both sides are hashed first, so the compare
 * takes the same time whatever the length.
 */
export function tokenMatches(header: string | null, expected: string | undefined): boolean {
  const m = /^bearer (.+)$/i.exec(header ?? "");
  if (!expected || expected.length < MIN_TOKEN_LENGTH || !m) return false;
  return timingSafeEqual(sha256(m[1]), sha256(expected));
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
