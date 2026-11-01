import { addDays } from "./dates.ts";
import type { Anchor } from "./rules.ts";
import type { Cohort } from "./types.ts";

/**
 * When the waitlist page goes live: the cohort's own date if set, otherwise
 * 10 days before launch for a Live cohort. None when the waitlist is off.
 */
export function waitlistDate(c: Cohort): string | undefined {
  if (c.no_waitlist) return undefined;
  if (c.waitlist_live) return c.waitlist_live;
  return c.kind === "Live cohort" && c.launch ? addDays(c.launch, -10) : undefined;
}

/** The date a step counts from. Empty when the cohort does not have it. */
export function anchorDate(c: Cohort, anchor: Anchor): string | undefined {
  switch (anchor) {
    case "launch": return c.launch;
    case "standard": return c.standard_from;
    case "close": return c.enrol_close;
    case "start": return c.start;
    case "started": return c.start ? addDays(c.start, 1) : undefined;
    case "waitlist": return waitlistDate(c);
  }
}
