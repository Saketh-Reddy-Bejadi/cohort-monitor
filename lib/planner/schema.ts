import {
  DATE_FIELDS, KINDS, NUMBER_FIELDS, STATUSES, TEXT_FIELDS, URL_FIELDS,
  type Cohort, type CohortErrors, type Kind, type Status,
} from "./types.ts";

export type ParseResult =
  | { ok: true; cohort: Cohort }
  | { ok: false; errors: CohortErrors };

const MAX_TEXT = 100;
const MAX_URL = 500;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Blank text becomes undefined. A value that is not text is an error. */
function text(v: unknown): string | undefined | Error {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") return new Error("Enter text");
  const t = v.trim();
  return t === "" ? undefined : t;
}

function isRealDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function parseNumber(v: unknown): number | undefined | Error {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "number") {
    return Number.isFinite(v) && v >= 0 ? v : new Error("Enter a number, 0 or more");
  }
  if (typeof v !== "string") return new Error("Enter a number");
  const t = v.replace(/[₹$,\s]/g, "");
  if (t === "") return undefined;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return new Error("Enter a number, for example 42000");
  return Number(t);
}

function parseUrl(s: string): boolean {
  if (s.length > MAX_URL) return false;
  try {
    const u = new URL(s);
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.length > 0;
  } catch {
    return false;
  }
}

function parseBool(v: unknown): boolean | Error {
  if (v === true || v === "true" || v === "on" || v === "1") return true;
  if (v === false || v === undefined || v === null || v === "" || v === "false" || v === "off" || v === "0") {
    return false;
  }
  return new Error("Use yes or no");
}

/**
 * Turn form or JSON input into a cohort. Only known fields are read, so
 * extra keys can never be stored. Every bad field is reported, one message each.
 */
export function parseCohort(input: Record<string, unknown>): ParseResult {
  const errors: CohortErrors = {};
  const out: Record<string, unknown> = {};
  const fail = (k: keyof Cohort, m: string) => { errors[k] ??= m; };

  const name = text(input.name);
  if (name instanceof Error || name === undefined) fail("name", "Enter a name");
  else if (name.length > MAX_TEXT) fail("name", `Use ${MAX_TEXT} characters or fewer`);
  else out.name = name;

  const rawId = text(input.id);
  if (rawId instanceof Error) fail("id", rawId.message);
  else if (rawId !== undefined) {
    if (!SLUG.test(rawId) || rawId.length > 60) fail("id", "Use lowercase letters, numbers and single hyphens, for example aise-c4");
    else out.id = rawId;
  } else if (typeof out.name === "string") {
    const slug = slugify(out.name).slice(0, 60);
    if (!slug) fail("id", "Add letters or numbers to the name, or enter an id");
    else out.id = slug;
  }

  const kind = text(input.kind);
  if (kind instanceof Error || kind === undefined || !KINDS.includes(kind as Kind)) fail("kind", "Pick a kind");
  else out.kind = kind;

  const status = text(input.status) ?? "active";
  if (status instanceof Error || !STATUSES.includes(status as Status)) fail("status", "Pick active or archived");
  else out.status = status;

  for (const f of TEXT_FIELDS) {
    const v = text(input[f]);
    if (v instanceof Error) fail(f, v.message);
    else if (v !== undefined && v.length > MAX_TEXT) fail(f, `Use ${MAX_TEXT} characters or fewer`);
    else if (v !== undefined) out[f] = v;
  }

  for (const f of DATE_FIELDS) {
    const v = text(input[f]);
    if (v instanceof Error) fail(f, "Pick a date");
    else if (v !== undefined && !isRealDate(v)) fail(f, "Use a real date, YYYY-MM-DD");
    else if (v !== undefined) out[f] = v;
  }

  for (const f of NUMBER_FIELDS) {
    const v = parseNumber(input[f]);
    if (v instanceof Error) fail(f, v.message);
    else if (v !== undefined) out[f] = v;
  }

  for (const f of URL_FIELDS) {
    const v = text(input[f]);
    if (v instanceof Error) fail(f, v.message);
    else if (v !== undefined && !parseUrl(v)) fail(f, "Enter a full link starting with https://");
    else if (v !== undefined) out[f] = v;
  }

  const noWaitlist = parseBool(input.no_waitlist);
  if (noWaitlist instanceof Error) fail("no_waitlist", noWaitlist.message);
  else {
    out.no_waitlist = noWaitlist;
    if (noWaitlist && out.waitlist_live) fail("waitlist_live", "Clear this date or untick No waitlist");
  }

  // Dates that are set are real here, and YYYY-MM-DD strings compare in date order.
  // Each one must not be before the one set before it in this list.
  const ORDER = [
    ["launch", "launch"], ["ic_close", "IC close"], ["standard_from", "standard price start"], ["enrol_close", "enrolment close"],
  ] as const;
  let prev: (typeof ORDER)[number] | undefined;
  for (const cur of ORDER) {
    const v = out[cur[0]];
    if (typeof v !== "string") continue;
    const p = prev && out[prev[0]];
    if (prev && typeof p === "string" && v < p) fail(cur[0], `Cannot be before ${prev[1]}`);
    prev = cur;
  }

  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, cohort: out as Cohort };
}
